import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { BookWithCount } from "@/lib/types";

export function BookCard({ book }: { book: BookWithCount }) {
  return (
    <Link href={`/books/${book.id}`} className="block">
      <Card className="h-full p-5 transition-colors hover:bg-muted">
        <h2 className="text-base font-semibold leading-snug">{book.subject}</h2>
        {book.teacher && (
          <p className="mt-1 text-sm text-muted-foreground">{book.teacher}</p>
        )}
        {book.title && (
          <p className="mt-1 text-xs text-muted-foreground">{book.title}</p>
        )}
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          {book.question_count}問
        </p>
      </Card>
    </Link>
  );
}
