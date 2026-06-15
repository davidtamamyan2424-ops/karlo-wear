import type { Product, ProductSize } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import { SIZES } from "../constants.js";

const SIZE_ORDER = new Map(SIZES.map((s, i) => [s as string, i]));

function sortSizes<T extends { label: string }>(sizes: T[]): T[] {
  return [...sizes].sort(
    (a, b) => (SIZE_ORDER.get(a.label) ?? 99) - (SIZE_ORDER.get(b.label) ?? 99),
  );
}

/** Парсит imagesJson в массив URL; при отсутствии — использует обложку. */
function parseImages(product: Product): string[] {
  if (product.imagesJson) {
    try {
      const parsed = JSON.parse(product.imagesJson);
      if (Array.isArray(parsed)) {
        const urls = parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
        if (urls.length > 0) return urls;
      }
    } catch {
      // ignore malformed JSON, fall through to cover image
    }
  }
  return product.imageUrl ? [product.imageUrl] : [];
}

type ProductWithSizes = Product & { sizes: ProductSize[] };

/** Приводит товар к виду для API: images[] (вместо imagesJson) + сортировка размеров + суммарный остаток. */
export function serializeProduct(product: ProductWithSizes) {
  const { imagesJson: _imagesJson, ...rest } = product;
  const sizes = sortSizes(product.sizes);
  return {
    ...rest,
    images: parseImages(product),
    sizes,
    totalStock: sizes.reduce((sum, s) => sum + s.stock, 0),
  };
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { sizes: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  return products.map(serializeProduct);
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { sizes: true },
  });
  if (!product || !product.isActive) throw notFound("Товар не найден");
  return serializeProduct(product);
}
