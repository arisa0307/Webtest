/**
 * Supabase URL はプロジェクトルートのみ。
 * 例: https://xxxxxxxx.supabase.co
 * （/rest/v1 は付けない — 付いていると PGRST125 Invalid path になる）
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}
