import { prisma } from "../lib/prisma.js";
import {
  baseFromOptimizedFull,
  isLocalUploadUrl,
  isOptimizedFullUrl,
  regenerateVariantsForBase,
} from "../lib/imageOptimize.js";
import path from "node:path";

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

async function collectFullImageBases(): Promise<Set<string>> {
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ select: { imageUrl: true, imagesJson: true } }),
    prisma.productVariant.findMany({ select: { imageUrl: true, imagesJson: true } }),
  ]);

  const bases = new Set<string>();

  const addUrl = (url: string | null) => {
    if (!url || !isLocalUploadUrl(url) || !isOptimizedFullUrl(url)) return;
    const base = baseFromOptimizedFull(path.basename(url.split("?")[0]));
    if (base) bases.add(base);
  };

  for (const p of products) {
    addUrl(p.imageUrl);
    for (const u of parseImagesJson(p.imagesJson)) addUrl(u);
  }
  for (const v of variants) {
    addUrl(v.imageUrl);
    for (const u of parseImagesJson(v.imagesJson)) addUrl(u);
  }

  return bases;
}

export async function regenerateAllProductImages(): Promise<{
  regenerated: number;
  skipped: number;
}> {
  const bases = await collectFullImageBases();
  let regenerated = 0;
  let skipped = 0;

  for (const base of bases) {
    const ok = await regenerateVariantsForBase(base);
    if (ok) regenerated += 1;
    else skipped += 1;
  }

  return { regenerated, skipped };
}
