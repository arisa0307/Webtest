import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Question } from "@/lib/types";

type Client = SupabaseClient<Database>;
type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];
type QuestionUpdate = Database["public"]["Tables"]["questions"]["Update"];

/** 問題に対する DB アクセス層（純粋なデータ操作のみ） */
export const questionRepository = {
  /** ブック内の問題を検索（query が空なら全件・新しい順）。RPC 経由。 */
  async search(
    supabase: Client,
    bookId: string,
    query: string
  ): Promise<Question[]> {
    const { data, error } = await supabase.rpc("search_questions", {
      p_book_id: bookId,
      p_query: query,
    });
    if (error) throw error;
    return data ?? [];
  },

  async getById(supabase: Client, id: string): Promise<Question | null> {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** 重複判定用の候補（類似度上位）を取得。RPC 経由。 */
  async duplicateCandidates(
    supabase: Client,
    bookId: string,
    text: string,
    limit = 10
  ): Promise<Question[]> {
    const { data, error } = await supabase.rpc("duplicate_candidates", {
      p_book_id: bookId,
      p_text: text,
      p_limit: limit,
    });
    if (error) throw error;
    return data ?? [];
  },

  async create(supabase: Client, input: QuestionInsert): Promise<Question> {
    const { data, error } = await supabase
      .from("questions")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    supabase: Client,
    id: string,
    patch: QuestionUpdate
  ): Promise<Question> {
    const { data, error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(supabase: Client, id: string): Promise<void> {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  },
};
