import { bookService } from "@/lib/services/bookService";
import { BookCard } from "@/components/books/BookCard";
import { CreateBookForm } from "@/components/books/CreateBookForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const books = await bookService.list();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">ブック一覧</h1>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだブックがありません。最初のブックを作成しましょう。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      <CreateBookForm />
    </div>
  );
}
