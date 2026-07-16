import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ALLOWED_IMAGE_EXT } from "../constants.js";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "./uploads.js";

const THUMB_WIDTH = 550;
const FULL_WIDTH = 1800;
const THUMB_QUALITY = 86;
const FULL_QUALITY = 90;

export interface OptimizedProductImage {
  /** Публичный URL полноразмерного WebP (хранится в БД). */
  fullUrl: string;
  /** Публичный URL превью WebP для каталога. */
  thumbUrl: string;
  /** Имя файла оригинала на диске (не отдаётся публично). */
  originalFileName: string;
  fullFileName: string;
  thumbFileName: string;
}

export function isLocalUploadUrl(url: string): boolean {
  return url.startsWith(`${UPLOADS_URL_PREFIX}/`) || url.startsWith("/uploads/");
}

export function isOptimizedFullUrl(url: string): boolean {
  return /-full\.webp(\?|#|$)/i.test(url);
}

export function isOriginalUploadFile(fileName: string): boolean {
  return /-original\./i.test(fileName);
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

export function baseFromOptimizedFull(fileName: string): string | null {
  const match = /^(.+)-full\.webp$/i.exec(fileName);
  return match?.[1] ?? null;
}

function normalizeExt(ext: string): string {
  const lower = ext.toLowerCase();
  return (ALLOWED_IMAGE_EXT as readonly string[]).includes(lower) ? lower : ".jpg";
}

async function encodeWebp(input: Buffer, width: number, quality: number): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function generateVariantsFromBuffer(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  const [full, thumb] = await Promise.all([
    encodeWebp(input, FULL_WIDTH, FULL_QUALITY),
    encodeWebp(input, THUMB_WIDTH, THUMB_QUALITY),
  ]);
  return { full, thumb };
}

export async function findOriginalPathForBase(base: string): Promise<string | null> {
  let files: string[];
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch {
    return null;
  }
  const originalName = files.find((f) => f.startsWith(`${base}-original.`));
  return originalName ? path.join(UPLOADS_DIR, originalName) : null;
}

async function writeVariants(base: string, input: Buffer): Promise<Omit<OptimizedProductImage, "originalFileName">> {
  const { full, thumb } = await generateVariantsFromBuffer(input);
  const fullFileName = `${base}-full.webp`;
  const thumbFileName = `${base}-thumb.webp`;

  await Promise.all([
    fs.writeFile(path.join(UPLOADS_DIR, fullFileName), full),
    fs.writeFile(path.join(UPLOADS_DIR, thumbFileName), thumb),
  ]);

  return {
    fullUrl: `${UPLOADS_URL_PREFIX}/${fullFileName}`,
    thumbUrl: `${UPLOADS_URL_PREFIX}/${thumbFileName}`,
    fullFileName,
    thumbFileName,
  };
}

/**
 * Сохраняет загрузку как {base}-original.ext и генерирует thumb + full WebP.
 * Оригинал никогда не удаляется.
 */
export async function ingestProductImage(inputPath: string): Promise<OptimizedProductImage> {
  const ext = normalizeExt(path.extname(inputPath));
  const base = path.basename(inputPath, path.extname(inputPath));
  const originalFileName = `${base}-original${ext}`;
  const originalPath = path.join(UPLOADS_DIR, originalFileName);

  await fs.rename(inputPath, originalPath);
  const input = await fs.readFile(originalPath);
  const variants = await writeVariants(base, input);

  return { ...variants, originalFileName };
}

/** @deprecated Используйте ingestProductImage */
export const optimizeProductImageFile = ingestProductImage;

/** Пересоздаёт thumb + full из сохранённого оригинала. */
export async function regenerateVariantsForBase(base: string): Promise<boolean> {
  const originalPath = await findOriginalPathForBase(base);
  if (!originalPath) return false;

  const input = await fs.readFile(originalPath);
  await writeVariants(base, input);
  return true;
}

export async function regenerateVariantsFromFullUrl(fullUrl: string): Promise<boolean> {
  if (!isLocalUploadUrl(fullUrl) || !isOptimizedFullUrl(fullUrl)) return false;
  const fileName = path.basename(fullUrl.split("?")[0]);
  const base = baseFromOptimizedFull(fileName);
  if (!base) return false;
  return regenerateVariantsForBase(base);
}

/** Если есть full, но нет thumb — догенерировать (из оригинала или full). */
export async function ensureThumbForFull(fullUrl: string): Promise<string | null> {
  if (!isLocalUploadUrl(fullUrl) || !isOptimizedFullUrl(fullUrl)) return null;

  const fullName = path.basename(fullUrl.split("?")[0]);
  const thumbName = fullName.replace(/-full\.webp$/i, "-thumb.webp");
  const thumbPath = path.join(UPLOADS_DIR, thumbName);
  const base = baseFromOptimizedFull(fullName);

  if (base && (await findOriginalPathForBase(base))) {
    await regenerateVariantsForBase(base);
    return `${UPLOADS_URL_PREFIX}/${thumbName}`;
  }

  try {
    await fs.access(thumbPath);
    return `${UPLOADS_URL_PREFIX}/${thumbName}`;
  } catch {
    /* generate from full (legacy без оригинала) */
  }

  const fullPath = path.join(UPLOADS_DIR, fullName);
  try {
    await fs.access(fullPath);
  } catch {
    return null;
  }

  const input = await fs.readFile(fullPath);
  const thumbBuf = await encodeWebp(input, THUMB_WIDTH, THUMB_QUALITY);
  await fs.writeFile(thumbPath, thumbBuf);
  return `${UPLOADS_URL_PREFIX}/${thumbName}`;
}

/**
 * Legacy: jpg/png/webp без суффиксов → сохранить как -original, создать -full/-thumb.
 * Уже оптимизированные -full.webp продолжают работать.
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
  if (isOriginalUploadFile(fileName)) {
    const base = fileName.replace(/-original\.[^.]+$/i, "");
    if (await regenerateVariantsForBase(base)) {
      return `${UPLOADS_URL_PREFIX}/${base}-full.webp`;
    }
    return null;
  }

  const inputPath = path.join(UPLOADS_DIR, fileName);
  try {
    await fs.access(inputPath);
  } catch {
    return null;
  }

  const ext = normalizeExt(path.extname(fileName));
  const base = path.basename(fileName, path.extname(fileName));
  const originalFileName = `${base}-original${ext}`;
  const originalPath = path.join(UPLOADS_DIR, originalFileName);

  if (fileName !== originalFileName) {
    await fs.rename(inputPath, originalPath);
  }

  const input = await fs.readFile(originalPath);
  const variants = await writeVariants(base, input);
  return variants.fullUrl;
}
