import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import type { SaleCategory } from "../constants/finance.js";
import { decrementVariantStock, productUnitCost } from "./stock.js";

export interface CreateManualSaleInput {
  productId: string;
  variantId: string;
  sizeLabel: string;
  quantity: number;
  amount: number | null;
  comment?: string | null;
  saleCategory: SaleCategory;
}

export async function listManualSales() {
  return prisma.manualSale.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createManualSale(input: CreateManualSaleInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw badRequest("Укажите количество");
  }

  return prisma.$transaction(async (tx) => {
    const size = await tx.productVariantSize.findFirst({
      where: {
        label: input.sizeLabel,
        variantId: input.variantId,
        variant: { productId: input.productId },
      },
      include: { variant: { include: { product: true } } },
    });
    if (!size) throw notFound("Позиция не найдена");

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
        productName: size.variant.product.name,
        variantName: size.variant.name,
        sizeLabel: size.label,
        unitCostSnapshot: unitCost,
      },
    });
  });
}
