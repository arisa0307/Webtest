-- ============================================================================
-- image_url（画像1枚）→ image_urls（複数枚）への移行
-- Supabase SQL Editor に貼り付けて実行してください。再実行しても安全です。
-- ============================================================================

-- 1) 新しい列を追加
alter table public.questions
  add column if not exists image_urls text[] not null default '{}';

-- 2) 旧 image_url の値を移行（既に移行済みのものは触らない）
update public.questions
  set image_urls = array[image_url]
  where image_url is not null and image_urls = '{}';

-- 3) 旧列を削除
alter table public.questions drop column if exists image_url;

-- 4) API（PostgREST）のスキーマキャッシュを更新
notify pgrst, 'reload schema';
