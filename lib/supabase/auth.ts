import { createClient } from "@/lib/supabase/server";

/**
 * ログイン必須のサーバー処理で使う。未ログインなら例外を投げる。
 * 併せてプロフィール（管理者フラグ等）も返す。
 */
export async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("ログインが必要です");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, is_approved")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

/** 現在のユーザーが管理者かどうか。未ログインなら false。 */
export async function isCurrentUserAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return data?.is_admin ?? false;
}
