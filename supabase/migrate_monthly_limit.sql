-- ============================================================================
-- AI 上限を「1日20回・月$5」→「月あたりの回数（既定 500回/月）」に変更
-- Supabase SQL Editor に貼り付けて実行してください。再実行しても安全です。
-- 上限を変えたい場合は 2か所の 500 を書き換えてください。
-- ============================================================================

-- 予算判定関数を作り直す（引数が変わるので旧版を削除してから作成）
drop function if exists public.claim_ai_budget(text, numeric);
drop function if exists public.claim_ai_budget(text);
create function public.claim_ai_budget(p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monthly_count int;
  v_monthly_limit constant int := 500;   -- ← 月あたりの上限
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

-- 利用状況関数（戻り値の形が変わるので削除してから作成）
drop function if exists public.ai_usage_status();
create function public.ai_usage_status()
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
    500;   -- ← 月あたりの上限（上と同じ値に）
$$;

-- API のスキーマキャッシュを更新
notify pgrst, 'reload schema';
