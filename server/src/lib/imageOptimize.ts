import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "./uploads.js";

const THUMB_WIDTH = 480;
const FULL_WIDTH = 1400;
const THUMB_TARGET_MAX_BYTES = 100 * 1024;
const FULL_TARGET_MAX_BYTES = 250 * 1024;
const THUMB_MIN_QUALITY = 55;
const FULL_MIN_QUALITY = 60;

export interface OptimizedProductImage {
  /** Публичный URL полноразмерного WebP (хранится в БД). */
  fullUrl: string;
  /** Публичный URL превью WebP для каталога. */
  thumbUrl: string;
  fullFileName: string;
  thumbFileName: string;
}

function newImageId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

export function isLocalUploadUrl(url: string): boolean {
  return url.startsWith(`${UPLOADS_URL_PREFIX}/`) || url.startsWith("/uploads/");
}

export function isOptimizedFullUrl(url: string): boolean {
  return /-full\.webp(\?|#|$)/i.test(url);
}

export function thumbUrlFromFull(fullUrl: string): string {
  if (isOptimizedFullUrl(fullUrl)) {
    return fullUrl.replace(/-full\.webp/i, "-thumb.webp");
  }
  return fullUrl;
}

export function fullUrlFromThumb(thumbUrl: string): string {
  if (/-thumb\.webp(\?|#|$)/i.test(thumbUrl)) {
    return thumbUrl.replace(/-thumb\.webp/i, "-full.webp");
  }
  return thumbUrl;
}

async function encodeWebpToTarget(
  input: Buffer,
  width: number,
  targetMaxBytes: number,
  startQuality: number,
  minQuality: number,
): Promise<Buffer> {
  let quality = startQuality;
  let best: Buffer | null = null;

  while (quality >= minQuality) {
    const buf = await sharp(input)
      .rotate()
      .resize({
        width,
        height: width,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    best = buf;
    if (buf.length <= targetMaxBytes) return buf;
    quality -= 8;
  }

  return best!;
}

/**
 * Создаёт full (≈1400px) и thumb (≈480px) WebP из загруженного файла.
 * Исходный файл удаляется после успешной обработки.
 */
export async function optimizeProductImageFile(inputPath: string): Promise<OptimizedProductImage> {
  const input = await fs.readFile(inputPath);
  const id = newImageId();
  const fullFileName = `${id}-full.webp`;
  const thumbFileName = `${id}-thumb.webp`;
  const fullPath = path.join(UPLOADS_DIR, fullFileName);
  const thumbPath = path.join(UPLOADS_DIR, thumbFileName);

  const [fullBuf, thumbBuf] = await Promise.all([
    encodeWebpToTarget(input, FULL_WIDTH, FULL_TARGET_MAX_BYTES, 82, FULL_MIN_QUALITY),
    encodeWebpToTarget(input, THUMB_WIDTH, THUMB_TARGET_MAX_BYTES, 75, THUMB_MIN_QUALITY),
  ]);

  await Promise.all([fs.writeFile(fullPath, fullBuf), fs.writeFile(thumbPath, thumbBuf)]);

  try {
    await fs.unlink(inputPath);
  } catch {
    /* исходник мог уже отсутствовать */
  }

  return {
    fullUrl: `${UPLOADS_URL_PREFIX}/${fullFileName}`,
    thumbUrl: `${UPLOADS_URL_PREFIX}/${thumbFileName}`,
    fullFileName,
    thumbFileName,
  };
}

/** Если есть full, но нет thumb — догенерировать превью. */
export async function ensureThumbForFull(fullUrl: string): Promise<string | null> {
  if (!isLocalUploadUrl(fullUrl) || !isOptimizedFullUrl(fullUrl)) return null;

  const fullName = path.basename(fullUrl.split("?")[0]);
  const thumbName = fullName.replace(/-full\.webp$/i, "-thumb.webp");
  const fullPath = path.join(UPLOADS_DIR, fullName);
  const thumbPath = path.join(UPLOADS_DIR, thumbName);

  try {
    await fs.access(thumbPath);
    return `${UPLOADS_URL_PREFIX}/${thumbName}`;
  } catch {
    /* generate */
  }

  try {
    await fs.access(fullPath);
  } catch {
    return null;
  }

  const input = await fs.readFile(fullPath);
  const thumbBuf = await encodeWebpToTarget(
    input,
    THUMB_WIDTH,
    THUMB_TARGET_MAX_BYTES,
    75,
    THUMB_MIN_QUALITY,
  );
  await fs.writeFile(thumbPath, thumbBuf);
  return `${UPLOADS_URL_PREFIX}/${thumbName}`;
}

/**
 * Оптимизирует legacy-файл (jpg/png/webp без суффикса -full) → full+thumb.
 * Возвращает новый full URL или null, если файл недоступен.
 */
export async function optimizeLegacyUpload(url: string): Promise<string | null> {
  if (!isLocalUploadUrl(url)) return null;
  if (isOptimizedFullUrl(url)) {
    await ensureThumbForFull(url);
    return url;
  }
  if (/-thumb\.webp(\?|#|$)/i.test(url)) {
    return fullUrlFromThumb(url);
  }

  const fileName = path.basename(url.split("?")[0]);
  const inputPath = path.join(UPLOADS_DIR, fileName);

  try {
    await fs.access(inputPath);
  } catch {
    return null;
  }

  const optimized = await optimizeProductImageFile(inputPath);
  return optimized.fullUrl;
}
