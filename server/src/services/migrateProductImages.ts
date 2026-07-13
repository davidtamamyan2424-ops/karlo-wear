import { prisma } from "../lib/prisma.js";
import {
  isLocalUploadUrl,
  isOptimizedFullUrl,
  optimizeLegacyUpload,
  ensureThumbForFull,
} from "../lib/imageOptimize.js";

function parseImagesJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
  } catch {
    return [];
  }
}

function remapUrl(url: string, map: Map<string, string>): string {
  return map.get(url) ?? url;
}

/**
 * Проходит по всем локальным фото товаров/вариантов и создаёт WebP full+thumb.
 * Обновляет URL в БД на *-full.webp.
 */
export async function migrateProductImages(): Promise<{ processed: number; updated: number }> {
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ select: { id: true, imageUrl: true, imagesJson: true } }),
    prisma.productVariant.findMany({ select: { id: true, imageUrl: true, imagesJson: true } }),
  ]);

  const urls = new Set<string>();
  for (const p of products) {
    if (p.imageUrl) urls.add(p.imageUrl);
    for (const u of parseImagesJson(p.imagesJson)) urls.add(u);
  }
  for (const v of variants) {
    if (v.imageUrl) urls.add(v.imageUrl);
    for (const u of parseImagesJson(v.imagesJson)) urls.add(u);
  }

  const remap = new Map<string, string>();
  let processed = 0;

  for (const url of urls) {
    if (!isLocalUploadUrl(url)) continue;

    try {
      if (isOptimizedFullUrl(url)) {
        await ensureThumbForFull(url);
        processed += 1;
        continue;
      }

      const next = await optimizeLegacyUpload(url);
      processed += 1;
      if (next && next !== url) {
        remap.set(url, next);
      }
    } catch (error) {
      console.warn(`[images] Не удалось оптимизировать ${url}:`, error);
    }
  }

  if (remap.size === 0) {
    return { processed, updated: 0 };
  }

  let updated = 0;

  for (const p of products) {
    const images = parseImagesJson(p.imagesJson).map((u) => remapUrl(u, remap));
    const imageUrl = p.imageUrl ? remapUrl(p.imageUrl, remap) : null;
    const nextImagesJson = images.length > 0 ? JSON.stringify(images) : null;
    const changed =
      imageUrl !== p.imageUrl || nextImagesJson !== p.imagesJson;

    if (!changed) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: {
        imageUrl: imageUrl ?? images[0] ?? null,
        imagesJson: nextImagesJson,
      },
    });
    updated += 1;
  }

  for (const v of variants) {
    const images = parseImagesJson(v.imagesJson).map((u) => remapUrl(u, remap));
    const imageUrl = v.imageUrl ? remapUrl(v.imageUrl, remap) : null;
    const nextImagesJson = images.length > 0 ? JSON.stringify(images) : null;
    const changed =
      imageUrl !== v.imageUrl || nextImagesJson !== v.imagesJson;

    if (!changed) continue;

    await prisma.productVariant.update({
      where: { id: v.id },
      data: {
        imageUrl: imageUrl ?? images[0] ?? null,
        imagesJson: nextImagesJson,
      },
    });
    updated += 1;
  }

  return { processed, updated };
}
