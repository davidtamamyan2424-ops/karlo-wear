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

function variantImagesToColumns(images: string[] | undefined) {
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

/** Генерирует уникальный артикул варианта (KW-V-XXXXXXXX). */
export async function generateVariantSku(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const candidate = `KW-V-${suffix}`;
    const exists = await prisma.productVariant.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw conflict("Не удалось сгенерировать артикул варианта");
}

export async function listAdminProducts() {
  const products = await prisma.product.findMany({
    where: { archived: false },
    include: {
      sizes: true,
      variants: { include: { sizes: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  return products.map(serializeProduct);
}

export async function listArchivedProducts() {
  const products = await prisma.product.findMany({
    where: { archived: true },
    include: {
      sizes: true,
      variants: { include: { sizes: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ updatedAt: "desc" }],
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
    include: {
      sizes: true,
      variants: { include: { sizes: true }, orderBy: { position: "asc" } },
    },
  });
  if (!product) throw notFound("Товар не найден");
  return serializeProduct(product);
}

export async function createProduct(input: CreateProductBody) {
  const variantInputs = input.variants?.length
    ? input.variants
    : [
        {
          name: "Базовый цвет",
          sku: `${await generateProductSku()}-01`,
          price: null,
          images: input.images ?? [],
          sizes: SIZES.map((label) => {
            const legacy = input.sizes?.find((s) => s.label === label);
            return { label, stock: legacy?.stock ?? 0 };
          }),
        },
      ];
  const stockByLabel = new Map(variantInputs[0].sizes.map((s) => [s.label, s.stock]));
  const sizesData = SIZES.map((label) => ({ label, stock: stockByLabel.get(label) ?? 0 }));
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
        archived: false,
        imagesJson: imageCols.imagesJson,
        imageUrl: imageCols.imageUrl,
        sizeChartUrl: input.sizeChartUrl ?? null,
        sizes: { create: sizesData },
        variants: {
          create: variantInputs.map((variant, index) => {
            const imageCols = variantImagesToColumns(variant.images) ?? {
              imageUrl: null,
              imagesJson: null,
            };
            return {
              name: variant.name,
              sku: variant.sku,
              colorHex: variant.colorHex ?? null,
              price: variant.price ?? null,
              imageUrl: imageCols.imageUrl,
              imagesJson: imageCols.imagesJson,
              position: index,
              isDefault: index === 0,
              sizes: {
                create: SIZES.map((label) => {
                  const size = variant.sizes.find((s) => s.label === label);
                  return { label, stock: size?.stock ?? 0 };
                }),
              },
            };
          }),
        },
      },
      include: { sizes: true, variants: { include: { sizes: true } } },
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

  const variantInputs = input.variants;
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
      if (variantInputs) {
        const nextIds = new Set(variantInputs.map((v) => v.id).filter(Boolean));
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true },
        });
        const deleteIds = existingVariants
          .map((v) => v.id)
          .filter((variantId) => !nextIds.has(variantId));
        if (deleteIds.length) {
          await tx.productVariant.deleteMany({ where: { id: { in: deleteIds } } });
        }

        for (let i = 0; i < variantInputs.length; i += 1) {
          const variant = variantInputs[i];
          const imageCols = variantImagesToColumns(variant.images) ?? {
            imageUrl: null,
            imagesJson: null,
          };
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                name: variant.name,
                sku: variant.sku,
                colorHex: variant.colorHex ?? null,
                price: variant.price ?? null,
                imageUrl: imageCols.imageUrl,
                imagesJson: imageCols.imagesJson,
                position: i,
                isDefault: i === 0,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                name: variant.name,
                sku: variant.sku,
                colorHex: variant.colorHex ?? null,
                price: variant.price ?? null,
                imageUrl: imageCols.imageUrl,
                imagesJson: imageCols.imagesJson,
                position: i,
                isDefault: i === 0,
              },
            });
          }
        }

        const variants = await tx.productVariant.findMany({
          where: { productId: id },
          include: { sizes: true },
          orderBy: { position: "asc" },
        });
        const newVariantPayloads = variantInputs.filter((v) => !v.id);
        for (const variant of variants) {
          const payload =
            variantInputs.find((v) => v.id === variant.id) ?? newVariantPayloads.shift();
          if (!payload) continue;
          for (const size of payload.sizes) {
            await tx.productVariantSize.upsert({
              where: { variantId_label: { variantId: variant.id, label: size.label } },
              update: { stock: size.stock },
              create: { variantId: variant.id, label: size.label, stock: size.stock },
            });
          }
        }

        const defaultVariant = variants[0];
        if (defaultVariant) {
          const defaultSizes = await tx.productVariantSize.findMany({
            where: { variantId: defaultVariant.id },
          });
          for (const size of defaultSizes) {
            await tx.productSize.upsert({
              where: { productId_label: { productId: id, label: size.label } },
              update: { stock: size.stock },
              create: { productId: id, label: size.label, stock: size.stock },
            });
          }
          await tx.product.update({
            where: { id },
            data: { imageUrl: defaultVariant.imageUrl, imagesJson: defaultVariant.imagesJson },
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
    include: { sizes: true, variants: { include: { sizes: true }, orderBy: { position: "asc" } } },
  });
  if (!source) throw notFound("Товар не найден");

  const sourceVariants =
    source.variants.length > 0
      ? source.variants
      : [
          {
            id: "legacy",
            productId: source.id,
            name: "Базовый цвет",
            sku: source.sku,
            colorHex: null,
            price: null,
            imageUrl: source.imageUrl,
            imagesJson: source.imagesJson,
            position: 0,
            isDefault: true,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            sizes: source.sizes,
          },
        ];

  const images: string[] = source.imagesJson ? JSON.parse(source.imagesJson) : [];
  const imageCols = imagesToColumns(images.length > 0 ? images : undefined) ?? {
    imagesJson: source.imagesJson,
    imageUrl: source.imageUrl,
  };

  const defaultSourceVariant = sourceVariants.find((v) => v.isDefault) ?? sourceVariants[0];
  const defaultSizes = defaultSourceVariant.sizes;

  try {
    const sku = await generateProductSku();
    const variantSkus = await Promise.all(sourceVariants.map(() => generateVariantSku()));

    const last = await prisma.product.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const product = await prisma.product.create({
      data: {
        name: `${source.name} (копия)`,
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
        archived: false,
        sizes: {
          create: SIZES.map((label) => {
            const size = defaultSizes.find((s) => s.label === label);
            return { label, stock: size?.stock ?? 0 };
          }),
        },
        variants: {
          create: sourceVariants.map((variant, index) => ({
            name: variant.name,
            sku: variantSkus[index],
            colorHex: variant.colorHex,
            price: variant.price,
            imageUrl: variant.imageUrl,
            imagesJson: variant.imagesJson,
            position: index,
            isDefault: index === 0,
            sizes: {
              create: SIZES.map((label) => {
                const size = variant.sizes.find((s) => s.label === label);
                return { label, stock: size?.stock ?? 0 };
              }),
            },
          })),
        },
      },
      include: { sizes: true, variants: { include: { sizes: true }, orderBy: { position: "asc" } } },
    });

    return serializeProduct(product);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Не удалось дублировать товар. Попробуйте ещё раз.");
    }
    throw error;
  }
}

/** Изменяет остаток по размеру на delta. Результат не может быть отрицательным. */
export async function adjustStock(id: string, label: string, delta: number, variantId?: string) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) throw notFound("Товар не найден");

    const targetVariantId =
      variantId ??
      (
        await tx.productVariant.findFirst({
          where: { productId: id, isDefault: true },
          select: { id: true },
        })
      )?.id;
    if (!targetVariantId) throw notFound("Вариант товара не найден");
    const size = await tx.productVariantSize.findUnique({
      where: { variantId_label: { variantId: targetVariantId, label } },
    });

    const current = size?.stock ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw badRequest("Остаток не может быть отрицательным");
    }

    if (size) {
      await tx.productVariantSize.update({
        where: { id: size.id },
        data: { stock: next },
      });
    } else {
      await tx.productVariantSize.create({ data: { variantId: targetVariantId, label, stock: next } });
    }
    const defaultVariant = await tx.productVariant.findFirst({
      where: { productId: id, isDefault: true },
      select: { id: true },
    });
    if (defaultVariant?.id === targetVariantId) {
      await tx.productSize.upsert({
        where: { productId_label: { productId: id, label } },
        update: { stock: next },
        create: { productId: id, label, stock: next },
      });
    }
  });

  return getAdminProduct(id);
}

export async function deleteProduct(id: string) {
  await prisma.product.update({ where: { id }, data: { archived: true } });
}

export async function restoreProduct(id: string) {
  await prisma.product.update({ where: { id }, data: { archived: false } });
}

export async function permanentlyDeleteProduct(id: string) {
  const usedInOrders = await prisma.orderItem.count({ where: { productId: id } });
  if (usedInOrders > 0) {
    throw conflict("Товар участвовал в заказах и не может быть удалён окончательно.");
  }
  await prisma.product.delete({ where: { id } });
}
