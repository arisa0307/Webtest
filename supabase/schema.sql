-- ============================================================================
-- Web test — Supabase スキーマ
-- Supabase Dashboard → SQL Editor に貼り付けて実行してください。
-- 何度実行しても安全なように、可能な限り冪等に書いています。
-- ============================================================================

-- 必要な拡張機能 ------------------------------------------------------------
-- pg_trgm: 日本語を含む部分一致検索を GIN インデックスで高速化する。
--   （標準の to_tsvector は日本語を語に分割できないため、trigram を採用）
create extension if not exists pg_trgm;

-- ============================================================================
-- profiles : auth.users と 1:1。管理者フラグを持つ。
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  is_admin    boolean not null default false,
  -- 招待コード（合言葉）を入力して有効化されたユーザーだけ true。
  -- false の間はアプリを利用できない（/join に誘導される）。
  is_approved boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 既存テーブルへの再適用用（冪等）
alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- 新規ユーザー登録時に profiles を自動作成するトリガー ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 管理者判定ヘルパー（RLS ポリシーで使用） --------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ============================================================================
-- books : 1冊 = 科目 × 先生
-- ============================================================================
create table if not exists public.books (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null,
  teacher    text,
  title      text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- questions : 問題本体
-- ============================================================================
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references public.books (id) on delete cascade,
  question        text not null,
  choices         text,                       -- 選択肢（SPI等の多肢選択。任意）
  answer          text,
  explanation     text,
  image_urls      text[] not null default '{}',    -- 問題画像のURL（複数ページ対応）
  has_graph       boolean not null default false, -- 画像にグラフ/図が含まれるか

  -- 重複防止用に正規化したテキスト（アプリ側で生成して格納）
  normalized_text text not null,
  -- 検索用。question/choices/answer/explanation を結合して小文字化（生成列）
  search_text     text generated always as (
    lower(
      coalesce(question, '') || ' ' ||
      coalesce(choices, '') || ' ' ||
      coalesce(answer, '') || ' ' ||
      coalesce(explanation, '')
    )
  ) stored,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 既存テーブルへの再適用用（冪等）
alter table public.questions
  add column if not exists has_graph boolean not null default false;
alter table public.questions
  add column if not exists image_urls text[] not null default '{}';

-- 旧 image_url（単数）→ image_urls（複数）へ移行してから列を削除
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions'
      and column_name = 'image_url'
  ) then
    update public.questions
      set image_urls = array[image_url]
      where image_url is not null and image_urls = '{}';
    alter table public.questions drop column image_url;
  end if;
end $$;

-- 同一ブック内で normalized_text が完全一致する問題は登録できない
create unique index if not exists questions_book_normalized_uniq
  on public.questions (book_id, normalized_text);

-- 全文（部分一致）検索を高速化する trigram GIN インデックス
create index if not exists questions_search_text_trgm
  on public.questions using gin (search_text gin_trgm_ops);

create index if not exists questions_book_id_idx
  on public.questions (book_id);

-- updated_at 自動更新 -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ブック内の問題検索 RPC ----------------------------------------------------
-- p_query が空なら全件。部分一致は search_text に対して。
-- p_sort: 'poster' で投稿者名順、それ以外は新しい順。
-- 投稿者名(poster_name)も併せて返す。
-- （戻り値の形を変えるため旧版を drop してから作成）
drop function if exists public.search_questions(uuid, text);
drop function if exists public.search_questions(uuid, text, text);
create or replace function public.search_questions(
  p_book_id uuid,
  p_query text,
  p_sort text default 'newest'
)
returns table (
  id uuid,
  book_id uuid,
  question text,
  choices text,
  answer text,
  explanation text,
  image_urls text[],
  has_graph boolean,
  normalized_text text,
  search_text text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  poster_name text
)
language sql
stable
as $$
  select
    q.id, q.book_id, q.question, q.choices, q.answer, q.explanation,
    q.image_urls, q.has_graph, q.normalized_text, q.search_text,
    q.created_by, q.created_at, q.updated_at,
    coalesce(nullif(btrim(p.display_name), ''), p.email, '名無し') as poster_name
  from public.questions q
  left join public.profiles p on p.id = q.created_by
  where q.book_id = p_book_id
    and (
      p_query is null
      or btrim(p_query) = ''
      or q.search_text ilike '%' || lower(btrim(p_query)) || '%'
    )
  order by
    case when p_sort = 'poster'
      then coalesce(nullif(btrim(p.display_name), ''), p.email, '名無し')
    end asc nulls last,
    q.created_at desc;
$$;

-- 重複候補の取得（登録前の AI 重複判定に使う上位 N 件） --------------------
create or replace function public.duplicate_candidates(
  p_book_id uuid,
  p_text text,
  p_limit int default 10
)
returns setof public.questions
language sql
stable
as $$
  select *
  from public.questions
  where book_id = p_book_id
  order by similarity(search_text, lower(p_text)) desc
  limit greatest(p_limit, 1);
$$;

-- ============================================================================
-- ai_usage : OpenAI 利用量。日次20回・月額$5の上限管理に使う。
-- ============================================================================
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  kind       text not null,          -- 'format' | 'duplicate'
  cost_usd   numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at);

-- AI 利用の月あたり上限を消費できるか判定し、可能なら記録する（原子的）。
-- 当月の回数が上限（既定 500回/月）以上なら false を返し、呼び出し側で AI なし登録に切替える。
-- 集計の境界は Asia/Tokyo の暦月で行う。上限を変えたい場合は v_monthly_limit を変更。
-- （旧 2引数版から作り直すため、先に drop する）
drop function if exists public.claim_ai_budget(text, numeric);
drop function if exists public.claim_ai_budget(text);
create or replace function public.claim_ai_budget(p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monthly_count int;
  v_monthly_limit constant int := 500;
begin
  select count(*) into v_monthly_count
  from public.ai_usage
  where date_trunc('month', created_at at time zone 'Asia/Tokyo')
        = date_trunc('month', now() at time zone 'Asia/Tokyo');

  if v_monthly_count >= v_monthly_limit then
    return false;
  end if;

  insert into public.ai_usage (user_id, kind, cost_usd)
  values (auth.uid(), p_kind, 0);

  return true;
end;
$$;

-- 当月の利用状況を返す（UI 表示用） ----------------------------------------
-- （戻り値の形を変えるため、先に drop する）
drop function if exists public.ai_usage_status();
create or replace function public.ai_usage_status()
returns table (monthly_count int, monthly_limit int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.ai_usage
       where date_trunc('month', created_at at time zone 'Asia/Tokyo')
             = date_trunc('month', now() at time zone 'Asia/Tokyo')),
    500;
$$;

-- ============================================================================
-- Row Level Security
-- 方針: ログインユーザーは閲覧・登録・編集が可能。削除は管理者のみ。
-- ============================================================================
alter table public.profiles  enable row level security;
alter table public.books     enable row level security;
alter table public.questions enable row level security;
alter table public.ai_usage  enable row level security;

-- profiles -----------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- profiles の更新ポリシーは「あえて作らない」。
-- is_approved / is_admin をユーザー自身が書き換えられないようにするため、
-- 更新はサーバー(service_role)経由でのみ行う（招待コード照合は Next.js 側）。
drop policy if exists "profiles_update_self" on public.profiles;

-- books --------------------------------------------------------------------
drop policy if exists "books_select" on public.books;
create policy "books_select" on public.books
  for select to authenticated using (true);

drop policy if exists "books_insert" on public.books;
create policy "books_insert" on public.books
  for insert to authenticated with check (true);

drop policy if exists "books_update" on public.books;
create policy "books_update" on public.books
  for update to authenticated using (true) with check (true);

drop policy if exists "books_delete_admin" on public.books;
create policy "books_delete_admin" on public.books
  for delete to authenticated using (public.is_admin());

-- questions ----------------------------------------------------------------
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select to authenticated using (true);

drop policy if exists "questions_insert" on public.questions;
create policy "questions_insert" on public.questions
  for insert to authenticated with check (true);

drop policy if exists "questions_update" on public.questions;
create policy "questions_update" on public.questions
  for update to authenticated using (true) with check (true);

drop policy if exists "questions_delete_admin" on public.questions;
create policy "questions_delete_admin" on public.questions
  for delete to authenticated using (public.is_admin());

-- ai_usage : 直接アクセスは不可（claim_ai_budget / ai_usage_status 経由のみ）。
-- RLS 有効・ポリシーなし = 一般ユーザーからの直接 select/insert は拒否。
-- （security definer 関数からの操作は RLS をバイパスする）

-- ============================================================================
-- Storage : question-images バケット（公開）
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "qimg_read" on storage.objects;
create policy "qimg_read" on storage.objects
  for select using (bucket_id = 'question-images');

drop policy if exists "qimg_insert" on storage.objects;
create policy "qimg_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'question-images');

drop policy if exists "qimg_delete_admin" on storage.objects;
create policy "qimg_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin());

-- ============================================================================
-- 初期管理者の設定（登録後に手動実行してください）
-- 管理者は招待コード入力なしで使えるよう is_approved も true にします。
--   update public.profiles set is_admin = true, is_approved = true
--   where email = 'you@example.com';
-- ============================================================================
