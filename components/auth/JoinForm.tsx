"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveWithCodeAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, Notice } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function JoinForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "");

    startTransition(async () => {
      setError(null);
      const res = await approveWithCodeAction(code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-sm p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">合言葉を入力</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          このアプリは招待制です。共有された合言葉を入力してください。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Notice variant="error">{error}</Notice>}
        <Field label="合言葉">
          <Input
            name="code"
            required
            autoFocus
            autoComplete="off"
            placeholder="共有された合言葉"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "確認中..." : "参加する"}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <SignOutButton />
      </div>
    </Card>
  );
}
