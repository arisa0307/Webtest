export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionError(err: unknown): { ok: false; error: string } {
  const message =
    err instanceof Error ? err.message : "予期しないエラーが発生しました";
  return { ok: false, error: message };
}
