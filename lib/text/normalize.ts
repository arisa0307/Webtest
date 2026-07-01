/**
 * 重複判定用の正規化テキストを生成する。
 *
 * 仕様(17)に従い、以下を行う:
 *   - 全角→半角統一（英数字・記号・カタカナ。NFKC 正規化）
 *   - 小文字化
 *   - 改行除去
 *   - 空白除去（半角/全角/タブ等すべて）
 *
 * 同一ブック内で normalized_text が一致する問題は完全一致とみなし、
 * UNIQUE 制約で二重登録を防ぐ。
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC") // 全角英数字・記号・半角カナ等を統一
    .toLowerCase()
    .replace(/\s+/g, "") // 改行・スペース・タブをまとめて除去
    .trim();
}

/** 問題の各フィールドを結合して正規化する（重複キー用） */
export function buildNormalizedText(parts: {
  question: string;
  choices?: string | null;
  answer?: string | null;
}): string {
  const joined = [parts.question, parts.choices ?? "", parts.answer ?? ""].join(
    "\n"
  );
  return normalizeText(joined);
}
