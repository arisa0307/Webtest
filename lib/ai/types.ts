import type { DuplicateMatch, FormattedQuestion } from "@/lib/types";

export type DuplicateCandidate = {
  id: string;
  text: string;
};

/** API Route 内で扱う画像データ（Storage から取得したバイト列） */
export type ImageInput = {
  /** base64 エンコードしたバイト列 */
  data: string;
  /** 例: image/jpeg, image/png */
  mimeType: string;
};

/**
 * AI プロバイダーのインターフェース。
 * 用途は「画像からの抽出」と「重複判定」の2つのみ。
 * 実装（現状 Gemini）はこのインターフェース経由で使い、差し替え可能にする。
 */
export interface AiProvider {
  /**
   * 画像（複数可。大問が複数ページに分かれている場合）から本文テキストを抽出し、
   * 問題文/選択肢/解答/解説 に構造化する。グラフ・図は本文に含めず has_graph=true で示す。
   */
  extractFromImage(images: ImageInput[]): Promise<FormattedQuestion>;

  /** 対象テキストと候補群を比較し、類似度(0..100)の高い順に返す */
  detectDuplicates(
    target: string,
    candidates: DuplicateCandidate[]
  ): Promise<DuplicateMatch[]>;
}

/** AI 利用の種類。上限管理（月あたりの回数）で使う。 */
export type AiKind = "extract" | "duplicate";
