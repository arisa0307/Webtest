/** className を結合する小さなユーティリティ（falsy は除外）。 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
