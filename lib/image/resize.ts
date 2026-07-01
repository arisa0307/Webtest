"use client";

export type PreparedImage = {
  /** Storage 保存用の Blob（縮小できた場合は JPEG、できなければ原本） */
  blob: Blob;
  /** data: プレフィックスを除いた base64（Gemini 送信用） */
  base64: string;
  /** blob/base64 の MIME タイプ */
  mimeType: string;
};

/**
 * 画像を「できれば縮小、無理なら原本のまま」用意する。
 *
 * iPhone の写真は HEIC のことが多く、ブラウザの canvas では開けない
 * （「画像を開けませんでした」になる）。その場合は縮小をあきらめ、原本を
 * そのまま使う。Gemini は HEIC/HEIF を直接読めるので抽出は成功する。
 */
export async function prepareImage(
  file: File,
  maxDim = 1600,
  quality = 0.8
): Promise<PreparedImage> {
  try {
    return await resizeToJpeg(file, maxDim, quality);
  } catch {
    // フォールバック: 原本をそのまま使う（HEIC など canvas 非対応の形式）
    const base64 = (await readAsDataURL(file)).split(",")[1] ?? "";
    return {
      blob: file,
      base64,
      mimeType: file.type || "image/jpeg",
    };
  }
}

/** 画像を長辺 maxDim px 以内に縮小して JPEG 化する（失敗時は例外）。 */
async function resizeToJpeg(
  file: File,
  maxDim: number,
  quality: number
): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas を取得できません");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) throw new Error("JPEG 変換に失敗");

    const base64 = (await readAsDataURL(blob)).split(",")[1] ?? "";
    return { blob, base64, mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像をデコードできません"));
    img.src = src;
  });
}
