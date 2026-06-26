import type { Prisma, Product } from "@prisma/client";
import { conflict } from "../lib/errors.js";

type Tx = Prisma.TransactionClient;

/** Себестоимость единицы товара в копейках. */
export function productUnitCost(product: Pick<Product, "unitCost">): number {
  return product.unitCost;
}

/** Уменьшает остаток варианта; синхронизирует ProductSize для дефолтного варианта. */
export async function decrementVariantStock(
  tx: Tx,
  variantSizeId: string,
  quantity: number,
): Promise<void> {
  const size = await tx.productVariantSize.findUnique({
    where: { id: variantSizeId },
    include: { variant: { include: { product: true } } },
  });
  if (!size) throw conflict("Позиция склада не найдена");

  const updated = await tx.productVariantSize.updateMany({
    where: { id: variantSizeId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (updated.count !== 1) {
    throw conflict(
      `Недостаточно товара «${size.variant.product.name}» размера ${size.label} на складе`,
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

/** Возвращает остаток на склад (обратная операция к decrementVariantStock). */
export async function incrementVariantStock(
  tx: Tx,
  variantSizeId: string,
  quantity: number,
): Promise<void> {
  const size = await tx.productVariantSize.findUnique({
    where: { id: variantSizeId },
    include: { variant: true },
  });
  if (!size) throw conflict("Позиция склада не найдена");

  await tx.productVariantSize.update({
    where: { id: variantSizeId },
    data: { stock: { increment: quantity } },
  });

  if (size.variant.isDefault) {
    await tx.productSize.updateMany({
      where: {
        productId: size.variant.productId,
        label: size.label,
      },
      data: { stock: { increment: quantity } },
    });
  }
}

/** Восстанавливает остаток по позиции заказа. */
export async function restoreOrderItemStock(
  tx: Tx,
  item: {
    productVariantSizeId: string | null;
    productSizeId: string | null;
    quantity: number;
  },
): Promise<void> {
  if (item.productVariantSizeId) {
    await incrementVariantStock(tx, item.productVariantSizeId, item.quantity);
    return;
  }
  if (item.productSizeId) {
    await tx.productSize.update({
      where: { id: item.productSizeId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
