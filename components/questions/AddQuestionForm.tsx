"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createQuestionAction } from "@/lib/actions/questions";
import { prepareImage } from "@/lib/image/resize";
import { QUESTION_IMAGES_BUCKET } from "@/lib/storage/images";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import type { FormattedQuestion } from "@/lib/types";

type Phase = "extracting" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

type Page = {
  id: string;
  previewUrl: string;
  blob: Blob | null;
  base64: string;
  mime: string;
};

type Draft = {
  id: string;
  pages: Page[]; // 大問が複数ページにまたがる場合は複数
  phase: Phase;
  message: string | null;
  question: string;
  choices: string;
  answer: string;
  explanation: string;
  has_graph: boolean;
  save: SaveState;
  saveError: string | null;
};

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[mime] ?? "jpg";
}

function emptyDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    pages: [],
    phase: "ready",
    message: null,
    question: "",
    choices: "",
    answer: "",
    explanation: "",
    has_graph: false,
    save: "idle",
    saveError: null,
  };
}

/** 最大 concurrency 個ずつ並行実行する簡易プール */
async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 3
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]!);
      }
    }
  );
  await Promise.all(runners);
}

export function AddQuestionForm({ bookId }: { bookId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // null = 新規問題として追加 / draftId = その問題にページ追加
  const targetDraftId = useRef<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const patchDraft = (id: string, partial: Partial<Draft>) =>
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...partial } : d))
    );

  const openPicker = (draftId: string | null) => {
    targetDraftId.current = draftId;
    fileInputRef.current?.click();
  };

  const onFilesPicked = async (files: File[]) => {
    setGlobalError(null);
    const target = targetDraftId.current;
    targetDraftId.current = null;
    if (files.length === 0) return;

    // 既存の問題に「続きのページ」を追加して、まとめて再抽出
    if (target) {
      const pages = await Promise.all(files.map(fileToPage));
      let combined: Page[] = [];
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id !== target) return d;
          combined = [...d.pages, ...pages];
          return { ...d, pages: combined, phase: "extracting", message: null };
        })
      );
      await extractDraft(target, combined);
      return;
    }

    // 写真1枚 = 1問。まずカードを全部表示してから、並行で抽出する。
    const items = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setDrafts((prev) => [
      ...prev,
      ...items.map((it) => ({
        ...emptyDraft(),
        id: it.id,
        phase: "extracting" as Phase,
        pages: [
          { id: crypto.randomUUID(), previewUrl: it.previewUrl, blob: null, base64: "", mime: "" },
        ],
      })),
    ]);

    await runPool(
      items,
      async (it) => {
        try {
          const { blob, base64, mimeType } = await prepareImage(it.file);
          const page: Page = {
            id: crypto.randomUUID(),
            previewUrl: it.previewUrl,
            blob,
            base64,
            mime: mimeType,
          };
          patchDraft(it.id, { pages: [page] });
          await extractDraft(it.id, [page]);
        } catch (err) {
          patchDraft(it.id, {
            phase: "error",
            message:
              err instanceof Error ? err.message : "画像の処理に失敗しました",
          });
        }
      },
      3
    );
  };

  const extractDraft = async (id: string, pages: Page[]) => {
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: pages
            .filter((p) => p.base64)
            .map((p) => ({ imageBase64: p.base64, mimeType: p.mime })),
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: FormattedQuestion; usedAi: true }
        | {
            ok: true;
            data: FormattedQuestion;
            usedAi: false;
            reason: "budget" | "error";
          };

      const d = json.data;
      patchDraft(id, {
        phase: "ready",
        question: d.question,
        choices: d.choices,
        answer: d.answer,
        explanation: d.explanation,
        has_graph: d.has_graph,
        message: json.usedAi
          ? null
          : json.reason === "budget"
            ? "本日のAI抽出の上限に達しました。手入力で修正してください。"
            : "抽出に失敗しました（時間をおいて再抽出するか、手入力で修正）。",
      });
    } catch (err) {
      patchDraft(id, {
        phase: "error",
        message: err instanceof Error ? err.message : "抽出に失敗しました",
      });
    }
  };

  async function fileToPage(file: File): Promise<Page> {
    const { blob, base64, mimeType } = await prepareImage(file);
    return {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      blob,
      base64,
      mime: mimeType,
    };
  }

  const reExtract = async (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft || draft.pages.length === 0) return;
    patchDraft(id, { phase: "extracting", message: null });
    await extractDraft(id, draft.pages);
  };

  const addManual = () => {
    setGlobalError(null);
    setDrafts((prev) => [...prev, emptyDraft()]);
  };

  const removeDraft = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      target?.pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.filter((d) => d.id !== id);
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 選択した問題を1つの大問にまとめる（小問として (1)(2)… で連結）
  const mergeSelected = () => {
    const chosen = drafts.filter((d) => selected.has(d.id) && d.save !== "saved");
    if (chosen.length < 2) return;

    const numbered = (get: (d: Draft) => string) =>
      chosen
        .map((d, i) => {
          const v = get(d).trim();
          return v ? `(${i + 1}) ${v}` : "";
        })
        .filter(Boolean)
        .join("\n\n");

    const merged: Draft = {
      ...emptyDraft(),
      pages: chosen.flatMap((d) => d.pages),
      phase: "ready",
      message:
        "小問を大問としてまとめました。必要なら本文を整えるか「再抽出」で読み直せます。",
      question: numbered((d) => d.question),
      choices: numbered((d) => d.choices),
      answer: numbered((d) => d.answer),
      explanation: numbered((d) => d.explanation),
      has_graph: chosen.some((d) => d.has_graph),
    };

    const firstIndex = drafts.findIndex((d) => d.id === chosen[0]!.id);
    setDrafts((prev) => {
      const remaining = prev.filter((d) => !selected.has(d.id));
      const insertAt = Math.max(
        0,
        Math.min(firstIndex, remaining.length)
      );
      return [
        ...remaining.slice(0, insertAt),
        merged,
        ...remaining.slice(insertAt),
      ];
    });
    setSelected(new Set());
  };

  const registerAll = async () => {
    setGlobalError(null);
    setRegistering(true);
    const supabase = createClient();

    for (const draft of drafts) {
      if (draft.save === "saved") continue;
      if (draft.phase === "extracting") continue;
      if (!draft.question.trim()) {
        patchDraft(draft.id, { save: "error", saveError: "問題文が空です" });
        continue;
      }
      patchDraft(draft.id, { save: "saving", saveError: null });

      try {
        // 画像はグラフ・表がある時だけ Storage に保存する（全ページ）
        let imageUrls: string[] = [];
        if (draft.has_graph) {
          const pagesWithBlob = draft.pages.filter((p) => p.blob);
          imageUrls = await Promise.all(
            pagesWithBlob.map(async (page) => {
              const path = `${bookId}/${crypto.randomUUID()}.${extFromMime(page.mime)}`;
              const { error: upErr } = await supabase.storage
                .from(QUESTION_IMAGES_BUCKET)
                .upload(path, page.blob!, { contentType: page.mime });
              if (upErr) throw new Error(`画像アップロード失敗: ${upErr.message}`);
              return supabase.storage
                .from(QUESTION_IMAGES_BUCKET)
                .getPublicUrl(path).data.publicUrl;
            })
          );
        }

        const res = await createQuestionAction({
          book_id: bookId,
          question: draft.question,
          choices: draft.choices,
          answer: draft.answer,
          explanation: draft.explanation,
          image_urls: imageUrls,
          has_graph: draft.has_graph,
        });
        if (!res.ok) {
          patchDraft(draft.id, { save: "error", saveError: res.error });
          continue;
        }
        patchDraft(draft.id, { save: "saved", saveError: null });
      } catch (err) {
        patchDraft(draft.id, {
          save: "error",
          saveError: err instanceof Error ? err.message : "登録に失敗しました",
        });
      }
    }

    setRegistering(false);
  };

  const pending = drafts.filter((d) => d.save !== "saved");
  const savedCount = drafts.filter((d) => d.save === "saved").length;
  const allSaved = drafts.length > 0 && pending.length === 0;
  const selectableSelected = drafts.filter(
    (d) => selected.has(d.id) && d.save !== "saved"
  ).length;

  return (
    <div className="space-y-4 pb-28">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void onFilesPicked(files);
          e.target.value = "";
        }}
      />

      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => openPicker(null)}
          >
            写真を選ぶ（複数まとめて可）
          </Button>
          <Button type="button" variant="ghost" onClick={addManual}>
            ＋ 手入力で追加
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          写真1枚＝1問として自動でテキスト抽出します。あとで「大問の小問だった」と
          分かったら、各カードにチェックを入れて「大問にまとめる」で1問に統合できます。
          グラフ・表がある時だけ画像を保存します。
        </p>
        {globalError && (
          <div className="mt-3">
            <Notice variant="error">{globalError}</Notice>
          </div>
        )}
      </Card>

      {drafts.map((draft, index) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          index={index + 1}
          selected={selected.has(draft.id)}
          onToggleSelect={() => toggleSelect(draft.id)}
          onChange={(partial) => patchDraft(draft.id, partial)}
          onRemove={() => removeDraft(draft.id)}
          onAddPages={() => openPicker(draft.id)}
          onReExtract={() => reExtract(draft.id)}
        />
      ))}

      {drafts.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
            {selectableSelected >= 2 ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectableSelected}件を選択中
                </span>
                <Button variant="secondary" onClick={mergeSelected}>
                  大問にまとめる
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  {savedCount}/{drafts.length} 件 登録済み
                </span>
                {allSaved ? (
                  <Button
                    onClick={() => {
                      router.push(`/books/${bookId}`);
                      router.refresh();
                    }}
                  >
                    ブックに戻る
                  </Button>
                ) : (
                  <Button onClick={registerAll} disabled={registering}>
                    {registering ? "登録中..." : `${pending.length}件を登録`}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  index,
  selected,
  onToggleSelect,
  onChange,
  onRemove,
  onAddPages,
  onReExtract,
}: {
  draft: Draft;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (partial: Partial<Draft>) => void;
  onRemove: () => void;
  onAddPages: () => void;
  onReExtract: () => void;
}) {
  const saved = draft.save === "saved";
  const busy = draft.phase === "extracting";

  return (
    <Card
      className={`space-y-3 p-5 ${saved ? "opacity-60" : ""} ${
        selected ? "ring-2 ring-ring" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {!saved && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-4 w-4"
              aria-label="この問題を選択"
              title="大問にまとめる用に選択"
            />
          )}
          <span className="text-sm font-semibold">問題 {index}</span>
          {draft.pages.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {draft.pages.length}ページ
            </span>
          )}
          {busy && <span className="text-xs text-muted-foreground">抽出中...</span>}
          {saved && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
              登録済み
            </span>
          )}
        </div>
        {!saved && (
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-muted-foreground hover:text-danger"
            aria-label="削除"
          >
            ✕
          </button>
        )}
      </div>

      {draft.pages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {draft.pages.map((p) => (
            <div
              key={p.id}
              className="relative h-32 w-24 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-muted"
            >
              {/* ローカルプレビュー（保存前なので最適化しない） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt="プレビュー"
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      )}

      {!saved && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onAddPages} disabled={busy}>
            ＋ページを追加（同じ問題の続き）
          </Button>
          {draft.pages.some((p) => p.base64) && (
            <Button type="button" variant="ghost" size="sm" onClick={onReExtract} disabled={busy}>
              再抽出
            </Button>
          )}
        </div>
      )}

      {draft.message && <Notice variant="warning">{draft.message}</Notice>}

      <Field label="問題文">
        <Textarea
          value={draft.question}
          onChange={(e) => onChange({ question: e.target.value })}
          disabled={saved}
          placeholder="問題文（大問＋小問はそのまま）"
        />
      </Field>
      <Field label="選択肢（任意）">
        <Textarea
          value={draft.choices}
          onChange={(e) => onChange({ choices: e.target.value })}
          disabled={saved}
        />
      </Field>
      <Field label="回答（任意）">
        <Textarea
          value={draft.answer}
          onChange={(e) => onChange({ answer: e.target.value })}
          disabled={saved}
        />
      </Field>
      <Field label="解説（任意）">
        <Textarea
          value={draft.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          disabled={saved}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.has_graph}
          onChange={(e) => onChange({ has_graph: e.target.checked })}
          disabled={saved}
          className="h-4 w-4"
        />
        グラフ・表あり（この時だけ画像を保存します）
      </label>

      {draft.saveError && <Notice variant="error">{draft.saveError}</Notice>}
    </Card>
  );
}
