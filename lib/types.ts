// アプリ全体で使うドメイン型。DB 行型は types/database.ts を参照。
import type { Book, Question } from "@/types/database";

export type { Book, Question, Profile, AiUsageStatus } from "@/types/database";

/** ホーム画面のブック一覧カード（問題数つき） */
export type BookWithCount = Book & {
  question_count: number;
};

/** 検索結果の問題（投稿者名つき） */
export type QuestionWithPoster = Question & {
  poster_name: string;
};

/** 問題一覧の並び順 */
export type QuestionSort = "newest" | "poster";

/** Gemini Vision で画像から抽出した、登録フォームに流し込む構造 */
export type FormattedQuestion = {
  question: string;
  choices: string;
  answer: string;
  explanation: string;
  has_graph: boolean;
};

/** 重複判定の 1 件分の結果 */
export type DuplicateMatch = {
  question_id: string;
  similarity: number; // 0..100
  question_preview: string;
};

/** 問題の新規作成・更新で受け取る入力 */
export type QuestionInput = {
  book_id: string;
  question: string;
  choices?: string | null;
  answer?: string | null;
  explanation?: string | null;
  image_urls?: string[];
  has_graph?: boolean;
};
