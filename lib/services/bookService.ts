import "server-only";

import { getAuthedClient } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { bookRepository } from "@/lib/repositories/bookRepository";
import type { Book, BookWithCount } from "@/lib/types";

/** ブックに関する業務ロジック層。ページからは直接 DB を触らずここを使う。 */
export const bookService = {
  async list(): Promise<BookWithCount[]> {
    const supabase = await createClient();
    return bookRepository.listWithCounts(supabase);
  },

  async get(id: string): Promise<Book | null> {
    const supabase = await createClient();
    return bookRepository.getById(supabase, id);
  },

  async create(input: {
    subject: string;
    teacher?: string | null;
    title?: string | null;
  }): Promise<Book> {
    const { supabase } = await getAuthedClient();
    const subject = input.subject.trim();
    if (!subject) throw new Error("科目を入力してください");

    return bookRepository.create(supabase, {
      subject,
      teacher: input.teacher?.trim() || null,
      title: input.title?.trim() || null,
    });
  },

  async update(
    id: string,
    patch: { subject?: string; teacher?: string | null; title?: string | null }
  ): Promise<Book> {
    const { supabase } = await getAuthedClient();
    const next: Record<string, string | null> = {};
    if (patch.subject !== undefined) {
      const subject = patch.subject.trim();
      if (!subject) throw new Error("科目を入力してください");
      next.subject = subject;
    }
    if (patch.teacher !== undefined) next.teacher = patch.teacher?.trim() || null;
    if (patch.title !== undefined) next.title = patch.title?.trim() || null;

    return bookRepository.update(supabase, id, next);
  },

  /** 削除は管理者のみ（RLS でも強制されるが、二重に明示チェック）。 */
  async remove(id: string): Promise<void> {
    const { supabase, profile } = await getAuthedClient();
    if (!profile?.is_admin) {
      throw new Error("削除する権限がありません（管理者のみ）");
    }
    await bookRepository.remove(supabase, id);
  },
};
