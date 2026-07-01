import Link from "next/link";
import type { Question } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function QuestionListItem({ question }: { question: Question }) {
  return (
    <Link
      href={`/questions/${question.id}`}
      className="block border-b border-border px-1 py-3 transition-colors hover:bg-muted"
    >
      <p className="line-clamp-2 text-sm leading-relaxed text-foreground">
        {question.question}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        登録日 {formatDate(question.created_at)}
        {(question.image_urls?.length ?? 0) > 0 && " ・ 画像あり"}
      </p>
    </Link>
  );
}
