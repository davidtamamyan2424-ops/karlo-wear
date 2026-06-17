import type { Prisma } from "@prisma/client";
import { conflict } from "../lib/errors.js";

type Tx = Prisma.TransactionClient;

/** Полная себестоимость единицы товара в копейках. */
export function productUnitCost(product: {
  productionCost: number;
  packagingCost: number;
  otherUnitCost: number;
}): number {
  return product.productionCost + product.packagingCost + product.otherUnitCost;
}

/** Уменьшает остаток варианта; синхронизирует ProductSize для дефолтного варианта. */
export async function decrementVariantStock(
  tx: Tx,
  variantSizeId: string,
  quantity: number,
): Promise<void> {
  const size = await tx.productVariantSize.findUnique({
    where: { id: variantSizeId },
    include: { variant: true },
  });
  if (!size) throw conflict("Позиция склада не найдена");

  const updated = await tx.productVariantSize.updateMany({
    where: { id: variantSizeId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (updated.count !== 1) {
    throw conflict(
      `Недостаточно товара «${size.variant.name}» размера ${size.label} на складе`,
    );
  }

  if (size.variant.isDefault) {
    await tx.productSize.updateMany({
      where: {
        productId: size.variant.productId,
        label: size.label,
        stock: { gte: quantity },
      },
      data: { stock: { decrement: quantity } },
    });
  }
}
