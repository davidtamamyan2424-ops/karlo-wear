import type { Product, ProductSize, ProductVariant, ProductVariantSize } from "@prisma/client";
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
function parseImagesFromRaw(imagesJson: string | null, imageUrl: string | null): string[] {
  if (imagesJson) {
    try {
      const parsed = JSON.parse(imagesJson);
      if (Array.isArray(parsed)) {
        const urls = parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
        if (urls.length > 0) return urls;
      }
    } catch {
      // ignore malformed JSON, fall through to cover image
    }
  }
  return imageUrl ? [imageUrl] : [];
}

type VariantWithSizes = ProductVariant & { sizes: ProductVariantSize[] };
type ProductWithRelations = Product & {
  sizes: ProductSize[];
  variants: VariantWithSizes[];
};

function normalizeVariants(product: ProductWithRelations): VariantWithSizes[] {
  if (product.variants.length > 0) return product.variants;
  return [
    {
      id: `legacy-${product.id}`,
      productId: product.id,
      name: "Базовый цвет",
      sku: product.sku,
      price: null,
      imageUrl: product.imageUrl,
      imagesJson: product.imagesJson,
      colorHex: null,
      position: 0,
      isDefault: true,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      sizes: product.sizes.map((size) => ({
        id: size.id,
        variantId: `legacy-${product.id}`,
        label: size.label,
        stock: size.stock,
      })),
    },
  ];
}

/** Приводит товар к виду для API: images[] (вместо imagesJson) + сортировка размеров + суммарный остаток. */
export function serializeProduct(product: ProductWithRelations) {
  const { imagesJson: _imagesJson, ...rest } = product;
  const variants = normalizeVariants(product).map((variant) => {
    const sizes = sortSizes(variant.sizes);
    const images = parseImagesFromRaw(variant.imagesJson, variant.imageUrl);
    return {
      ...variant,
      sizes,
      images,
      totalStock: sizes.reduce((sum, s) => sum + s.stock, 0),
    };
  });
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];
  const sizes = defaultVariant ? defaultVariant.sizes : sortSizes(product.sizes);
  const images = defaultVariant
    ? defaultVariant.images
    : parseImagesFromRaw(product.imagesJson, product.imageUrl);
  const effectivePrice = defaultVariant?.price ?? product.price;
  return {
    ...rest,
    price: effectivePrice,
    images,
    imageUrl: images[0] ?? rest.imageUrl,
    sizes,
    variants,
    defaultVariantId: defaultVariant?.id ?? null,
    totalStock: sizes.reduce((sum, s) => sum + s.stock, 0),
  };
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true, archived: false },
    include: { sizes: true, variants: { include: { sizes: true }, orderBy: { position: "asc" } } },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  return products.map(serializeProduct);
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { sizes: true, variants: { include: { sizes: true }, orderBy: { position: "asc" } } },
  });
  if (!product || !product.isActive || product.archived) throw notFound("Товар не найден");
  return serializeProduct(product);
}
