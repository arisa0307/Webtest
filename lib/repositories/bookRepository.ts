import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Book, BookWithCount } from "@/lib/types";

type Client = SupabaseClient<Database>;

/** ブックに対する DB アクセス層（純粋なデータ操作のみ） */
export const bookRepository = {
  async listWithCounts(supabase: Client): Promise<BookWithCount[]> {
    const { data, error } = await supabase
      .from("books")
      .select("*, questions(count)")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const { questions, ...book } = row as Book & {
        questions: { count: number }[] | null;
      };
      return {
        ...book,
        question_count: questions?.[0]?.count ?? 0,
      };
    });
  },

  async getById(supabase: Client, id: string): Promise<Book | null> {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(
    supabase: Client,
    input: { subject: string; teacher: string | null; title: string | null }
  ): Promise<Book> {
    const { data, error } = await supabase
      .from("books")
      .insert(input)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async update(
    supabase: Client,
    id: string,
    patch: Partial<Pick<Book, "subject" | "teacher" | "title">>
  ): Promise<Book> {
    const { data, error } = await supabase
      .from("books")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async remove(supabase: Client, id: string): Promise<void> {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
  },
};
