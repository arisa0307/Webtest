import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AiKind } from "./types";

/**
 * AI 利用の月あたり上限（既定 500回/月）を消費できるか判定し、可能なら記録する。
 * 上限超過時は false を返す。呼び出し側は false なら「AI なし」で続行する。
 */
export async function claimAiBudget(kind: AiKind): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_ai_budget", {
    p_kind: kind,
  });
  if (error) {
    // 予算管理に失敗した場合は安全側に倒して AI を使わない
    return false;
  }
  return data === true;
}

/** 当月の利用状況（UI 表示用）。 */
export async function getAiUsageStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_usage_status");
  if (error || !data || data.length === 0) return null;
  return data[0];
}
