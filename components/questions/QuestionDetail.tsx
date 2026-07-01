"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteQuestionAction,
  updateQuestionAction,
} from "@/lib/actions/questions";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import type { Question } from "@/lib/types";

export function QuestionDetail({
  question,
  isAdmin,
  posterName,
}: {
  question: Question;
  isAdmin: boolean;
  posterName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    question: question.question,
    choices: question.choices ?? "",
    answer: question.answer ?? "",
    explanation: question.explanation ?? "",
    has_graph: question.has_graph,
  });

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const res = await updateQuestionAction(question.id, question.book_id, {
      question: form.question,
      choices: form.choices,
      answer: form.answer,
      explanation: form.explanation,
      image_urls: question.image_urls ?? [],
      has_graph: form.has_graph,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("この問題を削除しますか？（元に戻せません）")) return;
    setError(null);
    setDeleting(true);
    const res = await deleteQuestionAction(question.id, question.book_id);
    if (!res.ok) {
      setError(res.error);
      setDeleting(false);
      return;
    }
    router.push(`/books/${question.book_id}`);
    router.refresh();
  };

  if (editing) {
    return (
      <Card className="space-y-4 p-5">
        {error && <Notice variant="error">{error}</Notice>}
        <Field label="問題文">
          <Textarea
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
        </Field>
        <Field label="選択肢">
          <Textarea
            value={form.choices}
            onChange={(e) => setForm({ ...form, choices: e.target.value })}
          />
        </Field>
        <Field label="回答">
          <Textarea
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
        </Field>
        <Field label="解説">
          <Textarea
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.has_graph}
            onChange={(e) => setForm({ ...form, has_graph: e.target.checked })}
            className="h-4 w-4"
          />
          グラフ・図あり（画像を参照）
        </label>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      {error && <Notice variant="error">{error}</Notice>}

      <p className="text-xs text-muted-foreground">投稿者：{posterName}</p>

      {question.has_graph && (
        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          グラフ・図あり（下の画像を参照）
        </span>
      )}

      <Section title="問題文">
        <p className="whitespace-pre-wrap leading-relaxed">{question.question}</p>
      </Section>

      {question.choices && (
        <Section title="選択肢">
          <p className="whitespace-pre-wrap leading-relaxed">
            {question.choices}
          </p>
        </Section>
      )}

      {(question.image_urls?.length ?? 0) > 0 && (
        <Section title="画像">
          <div className="space-y-3">
            {(question.image_urls ?? []).map((url, i) => (
              <div
                key={url}
                className="relative h-64 w-full overflow-hidden rounded-[var(--radius)] border border-border"
              >
                <Image
                  src={url}
                  alt={`問題画像 ${i + 1}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {question.answer && (
        <Section title="回答">
          <p className="whitespace-pre-wrap leading-relaxed">{question.answer}</p>
        </Section>
      )}

      {question.explanation && (
        <Section title="解説">
          <p className="whitespace-pre-wrap leading-relaxed">
            {question.explanation}
          </p>
        </Section>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        {isAdmin && (
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "削除中..." : "削除"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setEditing(true)}>
          編集
        </Button>
      </div>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}
