import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import type { Prisma } from "@prisma/client";
import type { SaleCategory, SaleSource } from "../constants/finance.js";
import { decrementVariantStock, incrementVariantStock, productUnitCost } from "./stock.js";

export interface ManualSaleInput {
  productId: string;
  variantId: string;
  sizeLabel: string;
  quantity: number;
  amount: number | null;
  comment?: string | null;
  saleCategory: SaleCategory;
  soldAt?: Date;
  saleSource?: SaleSource;
}

export async function listManualSales() {
  return prisma.manualSale.findMany({ orderBy: { soldAt: "desc" } });
}

async function resolveVariantSize(
  tx: Prisma.TransactionClient,
  input: Pick<ManualSaleInput, "productId" | "variantId" | "sizeLabel">,
) {
  const size = await tx.productVariantSize.findFirst({
    where: {
      label: input.sizeLabel,
      variantId: input.variantId,
      variant: { productId: input.productId },
    },
    include: { variant: { include: { product: true } } },
  });
  if (!size) throw notFound("Позиция не найдена");
  return size;
}

export async function createManualSale(input: ManualSaleInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw badRequest("Укажите количество");
  }

  return prisma.$transaction(async (tx) => {
    const size = await resolveVariantSize(tx, input);
    await decrementVariantStock(tx, size.id, input.quantity);

    const unitCost = productUnitCost(size.variant.product);
    return tx.manualSale.create({
      data: {
        productId: input.productId,
        productVariantId: input.variantId,
        productVariantSizeId: size.id,
        quantity: input.quantity,
        amount: input.amount,
        comment: input.comment ?? null,
        saleCategory: input.saleCategory,
        saleSource: input.saleSource ?? "MANUAL",
        soldAt: input.soldAt ?? new Date(),
        productName: size.variant.product.name,
        variantName: size.variant.name,
        sizeLabel: size.label,
        unitCostSnapshot: unitCost,
      },
    });
  });
}

export async function updateManualSale(id: string, input: ManualSaleInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw badRequest("Укажите количество");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.manualSale.findUnique({ where: { id } });
    if (!existing) throw notFound("Продажа не найдена");

    const size = await resolveVariantSize(tx, input);

    await incrementVariantStock(tx, existing.productVariantSizeId, existing.quantity);
    await decrementVariantStock(tx, size.id, input.quantity);

    const unitCost = productUnitCost(size.variant.product);
    return tx.manualSale.update({
      where: { id },
      data: {
        productId: input.productId,
        productVariantId: input.variantId,
        productVariantSizeId: size.id,
        quantity: input.quantity,
        amount: input.amount,
        comment: input.comment ?? null,
        saleCategory: input.saleCategory,
        saleSource: input.saleSource ?? existing.saleSource,
        soldAt: input.soldAt ?? existing.soldAt,
        productName: size.variant.product.name,
        variantName: size.variant.name,
        sizeLabel: size.label,
        unitCostSnapshot: unitCost,
      },
    });
  });
}

export async function deleteManualSale(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.manualSale.findUnique({ where: { id } });
    if (!existing) throw notFound("Продажа не найдена");

    await incrementVariantStock(tx, existing.productVariantSizeId, existing.quantity);
    await tx.manualSale.delete({ where: { id } });
  });
}
