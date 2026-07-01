import Link from "next/link";
import { notFound } from "next/navigation";
import { bookService } from "@/lib/services/bookService";
import { AddQuestionForm } from "@/components/questions/AddQuestionForm";

export const dynamic = "force-dynamic";

export default async function AddQuestionPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await bookService.get(bookId);
  if (!book) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/books/${bookId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {book.subject}
        </Link>
        <h1 className="mt-2 text-xl font-bold">問題を追加</h1>
        <p className="text-sm text-muted-foreground">
          画像から読み取るか、手入力で登録できます。
        </p>
      </div>

      <AddQuestionForm bookId={bookId} />
    </div>
  );
}
