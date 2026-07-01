import Link from "next/link";
import { notFound } from "next/navigation";
import { questionService } from "@/lib/services/questionService";
import { bookService } from "@/lib/services/bookService";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import { QuestionDetail } from "@/components/questions/QuestionDetail";

export const dynamic = "force-dynamic";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  const question = await questionService.get(questionId);
  if (!question) notFound();

  const [book, isAdmin] = await Promise.all([
    bookService.get(question.book_id),
    isCurrentUserAdmin(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/books/${question.book_id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {book?.subject ?? "ブック"}
        </Link>
        <h1 className="mt-2 text-xl font-bold">問題の詳細</h1>
      </div>

      <QuestionDetail question={question} isAdmin={isAdmin} />
    </div>
  );
}
