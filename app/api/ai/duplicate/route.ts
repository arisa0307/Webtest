import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { questionRepository } from "@/lib/repositories/questionRepository";
import { claimAiBudget } from "@/lib/ai/budget";
import { getAiProvider } from "@/lib/ai/gemini";
import type { DuplicateMatch } from "@/lib/types";

export const runtime = "nodejs";

/** 類似度がこの値以上なら「重複の可能性」として表示する(仕様14) */
const DUPLICATE_THRESHOLD = 90;

type DuplicateResponse =
  | { ok: true; matches: DuplicateMatch[]; usedAi: true }
  | { ok: true; matches: []; usedAi: false; reason: "budget" | "error" };

/**
 * 登録前の重複判定(仕様14)。
 * 1) 全文検索で候補10件を取得 2) OpenAI で類似度判定 3) 90%以上を返す。
 * 候補が無ければ AI を使わずに空で返す。予算超過/エラー時も登録は止めない。
 */
export async function POST(
  request: Request
): Promise<NextResponse<DuplicateResponse>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: true, matches: [], usedAi: false, reason: "error" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookId?: string;
    text?: string;
  };
  const bookId = body.bookId ?? "";
  const text = (body.text ?? "").trim();

  if (!bookId || !text) {
    return NextResponse.json({
      ok: true,
      matches: [],
      usedAi: false,
      reason: "error",
    });
  }

  // 候補取得は DB のみ（無料）。候補ゼロなら AI を呼ばない。
  const candidates = await questionRepository.duplicateCandidates(
    supabase,
    bookId,
    text,
    10
  );
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, matches: [], usedAi: true });
  }

  const allowed = await claimAiBudget("duplicate");
  if (!allowed) {
    return NextResponse.json({
      ok: true,
      matches: [],
      usedAi: false,
      reason: "budget",
    });
  }

  try {
    const matches = await getAiProvider().detectDuplicates(
      text,
      candidates.map((c) => ({
        id: c.id,
        text: [c.question, c.choices, c.answer].filter(Boolean).join(" / "),
      }))
    );
    return NextResponse.json({
      ok: true,
      matches: matches.filter((m) => m.similarity >= DUPLICATE_THRESHOLD),
      usedAi: true,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      matches: [],
      usedAi: false,
      reason: "error",
    });
  }
}
