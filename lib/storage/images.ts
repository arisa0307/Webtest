export const QUESTION_IMAGES_BUCKET = "question-images";

/**
 * 公開URL から バケット内のオブジェクトパスを取り出す。
 * 例: https://x.supabase.co/storage/v1/object/public/question-images/abc/1.png
 *     → "abc/1.png"
 * 取り出せなければ null。
 */
export function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${QUESTION_IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path ? decodeURIComponent(path) : null;
}

/** 公開URL配列 → バケット内パス配列（取り出せたものだけ） */
export function pathsFromPublicUrls(urls: string[]): string[] {
  return urls
    .map((u) => pathFromPublicUrl(u))
    .filter((p): p is string => p !== null);
}
