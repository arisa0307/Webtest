import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimAiBudget } from "@/lib/ai/budget";
import { getAiProvider } from "@/lib/ai/gemini";
import type { FormattedQuestion } from "@/lib/types";

export const runtime = "nodejs";

type ExtractResponse =
  | { ok: true; data: FormattedQuestion; usedAi: true }
  | {
      ok: true;
      data: FormattedQuestion;
      usedAi: false;
      reason: "budget" | "error";
    };

const EMPTY: FormattedQuestion = {
  question: "",
  choices: "",
  answer: "",
  explanation: "",
  has_graph: false,
};

/**
 * 画像のバイト列(base64)を受け取り、Gemini Vision で本文を抽出する。
 * 画像は（グラフがある場合のみ）クライアント側で別途 Storage に保存するため、
 * このエンドポイントは保存を行わず抽出に専念する。
 * APIキーはサーバー専用。予算超過(budget)・失敗(error)時は空で返し手入力で続行可能。
 */
export async function POST(
  request: Request
): Promise<NextResponse<ExtractResponse>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: true, data: EMPTY, usedAi: false, reason: "error" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    images?: { imageBase64?: string; mimeType?: string }[];
  };
  const images = (body.images ?? [])
    .map((img) => ({
      data: (img.imageBase64 ?? "").trim(),
      mimeType: (img.mimeType ?? "image/jpeg").trim(),
    }))
    .filter((img) => img.data.length > 0);

  if (images.length === 0) {
    return NextResponse.json({
      ok: true,
      data: EMPTY,
      usedAi: false,
      reason: "error",
    });
  }

  const allowed = await claimAiBudget("extract");
  if (!allowed) {
    return NextResponse.json({
      ok: true,
      data: EMPTY,
      usedAi: false,
      reason: "budget",
    });
  }

  try {
    const extracted = await getAiProvider().extractFromImage(images);
    return NextResponse.json({ ok: true, data: extracted, usedAi: true });
  } catch {
    return NextResponse.json({
      ok: true,
      data: EMPTY,
      usedAi: false,
      reason: "error",
    });
  }
}
