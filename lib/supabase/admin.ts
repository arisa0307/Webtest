import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * service_role キーを使う管理用クライアント。RLS をバイパスする。
 * サーバー専用。招待コードによる有効化（is_approved 更新）など、
 * ユーザー自身には許可しない操作にのみ使う。
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
