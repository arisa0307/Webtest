import "server-only";

import { GoogleGenAI, Type } from "@google/genai";
import type { DuplicateMatch, FormattedQuestion } from "@/lib/types";
import type { AiProvider, DuplicateCandidate, ImageInput } from "./types";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が未設定です");
  }
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  // GEMINI_MODEL 未設定時のフォールバック。常に最新の Flash を使うエイリアス。
  return process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
}

const EXTRACT_PROMPT = `あなたは試験問題の画像からテキストを抽出するアシスタントです。
これはPC画面をスマホで撮影した写真で、主に日本語(一部英語・数字)のテキストです。
渡された画像（1枚、または同じ大問が複数ページに分かれている場合は複数枚）を、
合わせて「1つの問題」として扱ってください。複数枚ある場合はページ順に内容が続きます。

次のルールに従って抽出してください。
- 画像内の「テキストのみ」を抽出する。
- 通常は 問題文(question)・選択肢(choices)・解答(answer)・解説(explanation) に分割する。
  判断できなければ question にまとめる。
- 【大問＋小問の形式の場合】(1つのリード文の下に (1)(2)… や 問1・問2… と複数の小問が並ぶ。
  複数ページにまたがることもある):
    - question: 大問のリード文に続けて、各小問の問題文を「(1) …」「(2) …」のように
      番号付きで列挙する。
    - choices: 小問ごとに選択肢があれば「(1) ア… イ…」のように小問番号を付けて列挙する。
    - answer: 各小問の解答を「(1) … (2) …」のように小問番号を付けて列挙する。
    - explanation: 各小問の解説を同様に番号付きで列挙する。
  小問の番号は画像の表記に合わせる。
- グラフ・図・表など、テキスト化できない図表が含まれる場合は、その内容を本文に書き起こさず、
  has_graph を true にする。図表が無ければ false。
- OCR的な明らかな誤りは常識の範囲で補正してよいが、内容を創作・追加しない。
- 該当が無いフィールドは空文字にする。
必ず指定のJSONスキーマで出力すること。`;

const DUPLICATE_PROMPT = `あなたは試験問題の重複を判定するアシスタントです。
「対象の問題」と「既存の候補問題リスト」を受け取り、各候補について
対象とどれだけ同じ問題かを 0〜100 の類似度(similarity)で評価してください。
表現の違いは無視し、問われている内容が同じかどうかで判断します。
必ず指定のJSONスキーマで出力してください。`;

const EXTRACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    choices: { type: Type.STRING },
    answer: { type: Type.STRING },
    explanation: { type: Type.STRING },
    has_graph: { type: Type.BOOLEAN },
  },
  required: ["question", "choices", "answer", "explanation", "has_graph"],
  propertyOrdering: ["question", "choices", "answer", "explanation", "has_graph"],
};

const DUPLICATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          similarity: { type: Type.INTEGER },
        },
        required: ["id", "similarity"],
      },
    },
  },
  required: ["results"],
};

export class GeminiProvider implements AiProvider {
  async extractFromImage(images: ImageInput[]): Promise<FormattedQuestion> {
    const ai = getClient();
    const imageParts = images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));

    const text = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: getModel(),
        contents: [
          {
            role: "user",
            parts: [...imageParts, { text: EXTRACT_PROMPT }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EXTRACT_SCHEMA,
          temperature: 0,
        },
      });
      const out = response.text;
      if (!out) throw new RetryableError("空のレスポンス");
      return out;
    });

    const parsed = safeJson(text);
    return {
      question: str(parsed.question),
      choices: str(parsed.choices),
      answer: str(parsed.answer),
      explanation: str(parsed.explanation),
      has_graph: parsed.has_graph === true,
    };
  }

  async detectDuplicates(
    target: string,
    candidates: DuplicateCandidate[]
  ): Promise<DuplicateMatch[]> {
    if (candidates.length === 0) return [];

    const ai = getClient();
    const text = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: getModel(),
        contents: [
          {
            role: "user",
            parts: [
              { text: DUPLICATE_PROMPT },
              {
                text: JSON.stringify({
                  target,
                  candidates: candidates.map((c) => ({ id: c.id, text: c.text })),
                }),
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: DUPLICATE_SCHEMA,
          temperature: 0,
        },
      });
      const out = response.text;
      if (!out) throw new RetryableError("空のレスポンス");
      return out;
    });

    const parsed = safeJson(text);
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    return results
      .map((r: unknown): DuplicateMatch | null => {
        if (typeof r !== "object" || r === null) return null;
        const obj = r as Record<string, unknown>;
        const id = str(obj.id);
        const candidate = candidates.find((c) => c.id === id);
        if (!candidate) return null;
        return {
          question_id: id,
          similarity: clampPercent(obj.similarity),
          question_preview: candidate.text.slice(0, 80),
        };
      })
      .filter((m: DuplicateMatch | null): m is DuplicateMatch => m !== null)
      .sort((a: DuplicateMatch, b: DuplicateMatch) => b.similarity - a.similarity);
  }
}

export function getAiProvider(): AiProvider {
  return new GeminiProvider();
}

// ---- retry -----------------------------------------------------------------
class RetryableError extends Error {}

/**
 * 一時的な失敗（レート制限・混雑・空レスポンス）に対して指数バックオフで再試行する。
 * Gemini の無料枠は分あたり回数制限があり、連続呼び出しで時々失敗するため。
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRetryable(err)) throw err;
      const backoff = 700 * 2 ** i + Math.floor(Math.random() * 300);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RetryableError) return true;
  const status = (err as { status?: number })?.status;
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /429|res(ource)?[ _-]?exhausted|rate.?limit|quota|overloaded|unavailable|timeout|timed out|deadline|fetch failed|econnreset|socket|503|500|502|504/.test(
    msg
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- helpers ----------------------------------------------------------------
function safeJson(text: string | undefined): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampPercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
