"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBookAction } from "@/lib/actions/books";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";

export function CreateBookForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const subject = String(form.get("subject") ?? "");
    const teacher = String(form.get("teacher") ?? "");
    const title = String(form.get("title") ?? "");

    startTransition(async () => {
      setError(null);
      const res = await createBookAction({ subject, teacher, title });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/books/${res.data.id}`);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ＋ ブックを作成
      </Button>
    );
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Notice variant="error">{error}</Notice>}
        <Field label="科目" hint="例: 薬理学 / SPI">
          <Input name="subject" required autoFocus placeholder="科目名" />
        </Field>
        <Field label="項目（任意）">
          <Input name="teacher" placeholder="例: 非言語" />
        </Field>
        <Field label="メモ・サブタイトル（任意）">
          <Input name="title" placeholder="例: 2024年度 前期" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "作成"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
