"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, type ActionResult } from "./types";

/**
 * 招待コード（合言葉）を照合し、正しければ現在のユーザーを有効化する。
 *
 * セキュリティ:
 *  - コードの照合はサーバー(env)で行う。クライアントには出さない。
 *  - is_approved の更新は service_role 経由（RLS をバイパス）でのみ実施。
 *    ユーザー自身が profiles を更新できないようにしてあるため、
 *    コードを知らない限り有効化できない。
 */
export async function approveWithCodeAction(
  code: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "ログインが必要です" };
    }

    const expected = process.env.APP_INVITE_CODE?.trim();
    if (!expected) {
      return {
        ok: false,
        error: "サーバーに招待コードが設定されていません（管理者に連絡）",
      };
    }

    if (code.trim() !== expected) {
      return { ok: false, error: "合言葉が違います" };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", user.id);
    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err);
  }
}
