-- ============================================================================
-- リセット用。中途半端に作られたテーブルを一度すべて削除する。
-- これを実行したあと、改めて schema.sql を実行してください。
-- ※ 本物のデータが入っている場合は実行しないこと（全削除されます）。
-- ============================================================================

drop table if exists public.ai_usage  cascade;
drop table if exists public.questions cascade;
drop table if exists public.books     cascade;
drop table if exists public.profiles  cascade;

drop function if exists public.search_questions(uuid, text)        cascade;
drop function if exists public.duplicate_candidates(uuid, text, int) cascade;
drop function if exists public.claim_ai_budget(text, numeric)      cascade;
drop function if exists public.ai_usage_status()                   cascade;
drop function if exists public.handle_new_user()                   cascade;
drop function if exists public.is_admin()                          cascade;
drop function if exists public.set_updated_at()                    cascade;
