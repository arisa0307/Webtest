"use server";

import { revalidatePath } from "next/cache";
import { questionService } from "@/lib/services/questionService";
import { actionError, type ActionResult } from "./types";
import type { QuestionInput } from "@/lib/types";

export async function createQuestionAction(
  input: QuestionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const q = await questionService.create(input);
    revalidatePath(`/books/${input.book_id}`);
    revalidatePath("/");
    return { ok: true, data: { id: q.id } };
  } catch (err) {
    return actionError(err);
  }
}

export async function updateQuestionAction(
  id: string,
  bookId: string,
  patch: Omit<QuestionInput, "book_id">
): Promise<ActionResult> {
  try {
    await questionService.update(id, patch);
    revalidatePath(`/books/${bookId}`);
    revalidatePath(`/questions/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteQuestionAction(
  id: string,
  bookId: string
): Promise<ActionResult> {
  try {
    await questionService.remove(id);
    revalidatePath(`/books/${bookId}`);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err);
  }
}
