import "server-only";

import { getAuthedClient } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { questionRepository } from "@/lib/repositories/questionRepository";
import { buildNormalizedText } from "@/lib/text/normalize";
import { pathsFromPublicUrls, QUESTION_IMAGES_BUCKET } from "@/lib/storage/images";
import type { Question, QuestionInput } from "@/lib/types";

/** Storage 上の画像群を削除する（権限の都合で service_role 経由）。失敗は無視。 */
async function removeStoredImages(urls: string[] | null | undefined) {
  const paths = pathsFromPublicUrls(urls ?? []);
  if (paths.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.storage.from(QUESTION_IMAGES_BUCKET).remove(paths);
  } catch {
    // クリーンアップ失敗はユーザー操作を止めない
  }
}

/** Postgres unique_violation */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === UNIQUE_VIOLATION
  );
}

/** 問題に関する業務ロジック層。 */
export const questionService = {
  async search(bookId: string, query: string): Promise<Question[]> {
    const supabase = await createClient();
    return questionRepository.search(supabase, bookId, query);
  },

  async get(id: string): Promise<Question | null> {
    const supabase = await createClient();
    return questionRepository.getById(supabase, id);
  },

  async create(input: QuestionInput): Promise<Question> {
    const { supabase, user } = await getAuthedClient();
    const question = input.question.trim();
    if (!question) throw new Error("問題文を入力してください");

    const normalized_text = buildNormalizedText({
      question,
      choices: input.choices,
      answer: input.answer,
    });

    // グラフ無しの問題は画像を保存しない（容量削減）
    const hasGraph = input.has_graph ?? false;
    const imageUrls = hasGraph ? input.image_urls ?? [] : [];

    try {
      return await questionRepository.create(supabase, {
        book_id: input.book_id,
        question,
        choices: input.choices?.trim() || null,
        answer: input.answer?.trim() || null,
        explanation: input.explanation?.trim() || null,
        image_urls: imageUrls,
        has_graph: hasGraph,
        normalized_text,
        created_by: user.id,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("同じ問題が既にこのブックに登録されています（完全一致）");
      }
      throw err;
    }
  },

  async update(
    id: string,
    patch: Omit<QuestionInput, "book_id">
  ): Promise<Question> {
    const { supabase } = await getAuthedClient();
    const question = patch.question.trim();
    if (!question) throw new Error("問題文を入力してください");

    const normalized_text = buildNormalizedText({
      question,
      choices: patch.choices,
      answer: patch.answer,
    });

    // グラフ無しにした場合は画像を Storage から削除し、URL も外す（容量削減）
    const hasGraph = patch.has_graph ?? false;
    let imageUrls = hasGraph ? patch.image_urls ?? [] : [];
    if (!hasGraph) {
      await removeStoredImages(patch.image_urls);
      imageUrls = [];
    }

    try {
      return await questionRepository.update(supabase, id, {
        question,
        choices: patch.choices?.trim() || null,
        answer: patch.answer?.trim() || null,
        explanation: patch.explanation?.trim() || null,
        image_urls: imageUrls,
        has_graph: hasGraph,
        normalized_text,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("同じ内容の問題が既にこのブックに存在します（完全一致）");
      }
      throw err;
    }
  },

  /**
   * 削除は管理者のみ。画像があれば Storage からも削除する(仕様22)。
   * 画像削除 → DB削除 の順。画像削除に失敗しても DB 削除は続行する。
   */
  async remove(id: string): Promise<void> {
    const { supabase, profile } = await getAuthedClient();
    if (!profile?.is_admin) {
      throw new Error("削除する権限がありません（管理者のみ）");
    }

    const existing = await questionRepository.getById(supabase, id);
    await removeStoredImages(existing?.image_urls);

    await questionRepository.remove(supabase, id);
  },
};
