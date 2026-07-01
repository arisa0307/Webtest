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
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { bookId } = await params;
  const { q, sort: sortParam } = await searchParams;
  const query = q ?? "";
  const sort = sortParam === "poster" ? "poster" : "newest";

  const book = await bookService.get(bookId);
  if (!book) notFound();

  const questions = await questionService.search(bookId, query, sort);

  const sortHref = (value: "newest" | "poster") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (value !== "newest") params.set("sort", value);
    const qs = params.toString();
    return qs ? `/books/${bookId}?${qs}` : `/books/${bookId}`;
  };

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

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">並び替え:</span>
        <Link
          href={sortHref("newest")}
          className={`rounded px-2 py-1 ${
            sort === "newest"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          新しい順
        </Link>
        <Link
          href={sortHref("poster")}
          className={`rounded px-2 py-1 ${
            sort === "poster"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          投稿者順
        </Link>
      </div>

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
