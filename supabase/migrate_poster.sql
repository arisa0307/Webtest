-- ============================================================================
-- 検索RPCを「投稿者名つき＋並び替え対応」に更新
-- Supabase SQL Editor に貼り付けて実行してください。再実行しても安全です。
-- ============================================================================

drop function if exists public.search_questions(uuid, text);
drop function if exists public.search_questions(uuid, text, text);
create function public.search_questions(
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

notify pgrst, 'reload schema';
