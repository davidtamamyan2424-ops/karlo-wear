import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { SIZES } from "../constants.js";
import { serializeProduct } from "./products.js";
import type {
  CreateProductBody,
  UpdateProductBody,
} from "../validation.js";

function imagesToColumns(images: string[] | undefined) {
  if (images === undefined) return undefined;
  return {
    imagesJson: images.length > 0 ? JSON.stringify(images) : null,
    imageUrl: images[0] ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Генерирует уникальный артикул (KW-XXXXXXXX). */
export async function generateProductSku(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const candidate = `KW-${suffix}`;
    const exists = await prisma.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw conflict("Не удалось сгенерировать артикул");
}

export async function listAdminProducts() {
  const products = await prisma.product.findMany({
    include: { sizes: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  return products.map(serializeProduct);
}

/** Сохраняет ручной порядок товаров: position = индекс в переданном массиве. */
export async function reorderProducts(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.product.update({ where: { id }, data: { position: index } }),
    ),
  );
  return listAdminProducts();
}

export async function getAdminProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { sizes: true },
  });
  if (!product) throw notFound("Товар не найден");
  return serializeProduct(product);
}

export async function createProduct(input: CreateProductBody) {
  const stockByLabel = new Map(input.sizes?.map((s) => [s.label, s.stock]));
  const sizesData = SIZES.map((label) => ({
    label,
    stock: stockByLabel.get(label) ?? 0,
  }));
  const imageCols = imagesToColumns(input.images) ?? { imagesJson: null, imageUrl: null };
  const sku = await generateProductSku();

  const last = await prisma.product.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  try {
    const product = await prisma.product.create({
      data: {
        name: input.name,
        sku,
        position,
        description: input.description ?? null,
        price: input.price,
        currency: "RUB",
        composition: input.composition ?? null,
        badge: input.badge ?? null,
        isActive: input.isActive ?? true,
        imagesJson: imageCols.imagesJson,
        imageUrl: imageCols.imageUrl,
        sizeChartUrl: input.sizeChartUrl ?? null,
        sizes: { create: sizesData },
      },
      include: { sizes: true },
    });
    return serializeProduct(product);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Не удалось создать товар: конфликт артикула");
    throw error;
  }
}

export async function updateProduct(id: string, input: UpdateProductBody) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw notFound("Товар не найден");

  const data: Prisma.ProductUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.price !== undefined) data.price = input.price;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if ("description" in input) data.description = input.description ?? null;
  if ("composition" in input) data.composition = input.composition ?? null;
  if ("badge" in input) data.badge = input.badge ?? null;
  if ("sizeChartUrl" in input) data.sizeChartUrl = input.sizeChartUrl ?? null;

  const imageCols = imagesToColumns(input.images);
  if (imageCols) {
    data.imagesJson = imageCols.imagesJson;
    data.imageUrl = imageCols.imageUrl;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      if (input.sizes) {
        for (const size of input.sizes) {
          await tx.productSize.upsert({
            where: { productId_label: { productId: id, label: size.label } },
            update: { stock: size.stock },
            create: { productId: id, label: size.label, stock: size.stock },
          });
        }
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Не удалось обновить товар");
    throw error;
  }

  return getAdminProduct(id);
}

export async function duplicateProduct(id: string) {
  const source = await prisma.product.findUnique({
    where: { id },
    include: { sizes: true },
  });
  if (!source) throw notFound("Товар не найден");

  const images: string[] = source.imagesJson ? JSON.parse(source.imagesJson) : [];
  const imageCols = imagesToColumns(images.length > 0 ? images : undefined) ?? {
    imagesJson: source.imagesJson,
    imageUrl: source.imageUrl,
  };

  const sku = await generateProductSku();

  const last = await prisma.product.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const product = await prisma.product.create({
    data: {
      name: source.name,
      sku,
      position,
      description: source.description,
      price: source.price,
      currency: source.currency,
      imageUrl: imageCols.imageUrl ?? null,
      imagesJson: imageCols.imagesJson ?? null,
      sizeChartUrl: source.sizeChartUrl,
      category: source.category,
      badge: source.badge,
      composition: source.composition,
      fabricDensity: source.fabricDensity,
      modelHeight: source.modelHeight,
      modelSize: source.modelSize,
      isActive: source.isActive,
      sizes: {
        create: SIZES.map((label) => ({ label, stock: 0 })),
      },
    },
    include: { sizes: true },
  });

  return serializeProduct(product);
}

/** Изменяет остаток по размеру на delta. Результат не может быть отрицательным. */
export async function adjustStock(id: string, label: string, delta: number) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw notFound("Товар не найден");

    const size = await tx.productSize.findUnique({
      where: { productId_label: { productId: id, label } },
    });

    const current = size?.stock ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw badRequest("Остаток не может быть отрицательным");
    }

    if (size) {
      await tx.productSize.update({
        where: { id: size.id },
        data: { stock: next },
      });
    } else {
      await tx.productSize.create({ data: { productId: id, label, stock: next } });
    }
  });

  return getAdminProduct(id);
}
