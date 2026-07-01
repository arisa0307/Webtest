"use server";

import { revalidatePath } from "next/cache";
import { bookService } from "@/lib/services/bookService";
import { actionError, type ActionResult } from "./types";

export async function createBookAction(input: {
  subject: string;
  teacher?: string | null;
  title?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const book = await bookService.create(input);
    revalidatePath("/");
    return { ok: true, data: { id: book.id } };
  } catch (err) {
    return actionError(err);
  }
}

export async function updateBookAction(
  id: string,
  patch: { subject?: string; teacher?: string | null; title?: string | null }
): Promise<ActionResult> {
  try {
    await bookService.update(id, patch);
    revalidatePath("/");
    revalidatePath(`/books/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteBookAction(id: string): Promise<ActionResult> {
  try {
    await bookService.remove(id);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err);
  }
}
