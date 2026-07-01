import Link from "next/link";
import { notFound } from "next/navigation";
import { bookService } from "@/lib/services/bookService";
import { questionService } from "@/lib/services/questionService";
import { QuestionSearch } from "@/components/questions/QuestionSearch";
import { QuestionListItem } from "@/components/questions/QuestionListItem";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { bookId } = await params;
  const { q } = await searchParams;
  const query = q ?? "";

  const book = await bookService.get(bookId);
  if (!book) notFound();

  const questions = await questionService.search(bookId, query);

  return (
    <div className="space-y-5 pb-24">
      <div>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← ブック一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">{book.subject}</h1>
        {book.teacher && (
          <p className="text-sm text-muted-foreground">{book.teacher}</p>
        )}
      </div>

      <QuestionSearch initialQuery={query} />

      {questions.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {query
            ? "一致する問題がありませんでした。"
            : "まだ問題がありません。右下のボタンから追加できます。"}
        </p>
      ) : (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {questions.length}件
          </p>
          {questions.map((question) => (
            <QuestionListItem key={question.id} question={question} />
          ))}
        </div>
      )}

      {/* 右下の固定「＋問題追加」ボタン */}
      <div className="fixed bottom-6 right-6 z-10">
        <Link href={`/books/${bookId}/add`}>
          <Button className="shadow-md">＋ 問題追加</Button>
        </Link>
      </div>
    </div>
  );
}
