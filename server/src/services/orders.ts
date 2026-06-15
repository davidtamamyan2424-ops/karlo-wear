import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import {
  PAYMENT_WINDOW_HOURS,
  RESERVED_STATUSES,
  isOrderStatus,
  type OrderStatus,
} from "../constants.js";
import { resolveUploadPath } from "../lib/uploads.js";
import {
  notifyNewOrder,
  notifyNewReceipt,
  type OrderNotificationItem,
} from "./telegram.js";

const ORDER_NUMBER_START = 1000;

export interface CreateOrderItemInput {
  productId: string;
  sizeLabel: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerName: string;
  phone: string;
  city: string;
  comment?: string | null;
  telegramUser: string;
  telegramId?: string | null;
  deliveryMethod: string;
  deliveryAddress?: string | null;
  deliveryComment?: string | null;
  deliveryConfirmed: boolean;
  items: CreateOrderItemInput[];
}

const orderInclude = {
  items: true,
  paymentProofs: { orderBy: { uploadedAt: "desc" } },
  paymentAccount: true,
} as const;

/**
 * Создаёт заказ в транзакции:
 * проверяет и резервирует склад, назначает случайный активный банк,
 * генерирует номер заказа и выставляет статус «Ожидает оплаты».
 */
export async function createOrder(input: CreateOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw badRequest("Добавьте товары в корзину");
  }

  const order = await prisma.$transaction(async (tx) => {
    // 1. Резервируем склад атомарно (защита от оверселла под нагрузкой).
    const lineItems: {
      productId: string;
      productSizeId: string;
      productName: string;
      sizeLabel: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw badRequest("Неверное количество товара");
      }

      const size = await tx.productSize.findFirst({
        where: { productId: item.productId, label: item.sizeLabel },
        include: { product: true },
      });

      if (!size || !size.product.isActive) {
        throw notFound("Товар не найден");
      }

      // Условный декремент: уменьшаем остаток только если его достаточно.
      const updated = await tx.productSize.updateMany({
        where: { id: size.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (updated.count !== 1) {
        throw conflict(
          `Недостаточно товара «${size.product.name}» размера ${size.label} на складе`,
        );
      }

      lineItems.push({
        productId: size.productId,
        productSizeId: size.id,
        productName: size.product.name,
        sizeLabel: size.label,
        unitPrice: size.product.price,
        quantity: item.quantity,
      });
    }

    const totalAmount = lineItems.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );

    // 2. Генерируем номер заказа (атомарно в транзакции).
    const last = await tx.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? ORDER_NUMBER_START) + 1;

    // 3. Назначаем случайный активный банк — фиксируется навсегда.
    const accounts = await tx.paymentAccount.findMany({ where: { isActive: true } });
    if (accounts.length === 0) {
      throw conflict("Нет активных реквизитов для оплаты. Обратитесь к администратору.");
    }
    const account = accounts[Math.floor(Math.random() * accounts.length)];

    const paymentDueAt = new Date(Date.now() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

    return tx.order.create({
      data: {
        orderNumber,
        customerName: input.customerName,
        phone: input.phone,
        city: input.city,
        comment: input.comment ?? null,
        telegramUser: input.telegramUser,
        telegramId: input.telegramId ?? null,
        deliveryMethod: input.deliveryMethod,
        deliveryAddress: input.deliveryAddress ?? null,
        deliveryComment: input.deliveryComment ?? null,
        deliveryConfirmed: input.deliveryConfirmed,
        status: "AWAITING_PAYMENT",
        totalAmount,
        currency: "RUB",
        paymentAccountId: account.id,
        assignedBankName: account.bankName,
        assignedRecipientName: account.recipientName,
        assignedPhoneNumber: account.phoneNumber,
        paymentDueAt,
        items: { create: lineItems },
      },
      include: orderInclude,
    });
  });

  // Уведомление администратору (вне транзакции — сбой не должен ломать заказ).
  const productImages = await prisma.product.findMany({
    where: { id: { in: order.items.map((i) => i.productId) } },
    select: { id: true, imageUrl: true },
  });
  const imageByProductId = new Map(productImages.map((p) => [p.id, p.imageUrl]));

  void notifyNewOrder({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    telegramUser: order.telegramUser,
    items: order.items.map(
      (i): OrderNotificationItem => ({
        productName: i.productName,
        sizeLabel: i.sizeLabel,
        quantity: i.quantity,
        imageUrl: imageByProductId.get(i.productId) ?? null,
      }),
    ),
    totalAmount: order.totalAmount,
    assignedBankName: order.assignedBankName,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    deliveryAddress: order.deliveryAddress,
    deliveryComment: order.deliveryComment,
  });

  return order;
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound("Заказ не найден");
  return order;
}

/** Добавляет чек об оплате и переводит заказ в статус «Ожидает проверки оплаты». */
export async function attachPaymentProof(orderId: string, fileUrl: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Заказ не найден");

  if (order.status === "CANCELLED") {
    throw conflict("Заказ отменён. Загрузка чека невозможна.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.paymentProof.create({ data: { orderId, fileUrl } });
    return tx.order.update({
      where: { id: orderId },
      data: { status: "PAYMENT_REVIEW" },
      include: orderInclude,
    });
  });

  void notifyNewReceipt({
    orderNumber: updated.orderNumber,
    telegramUser: updated.telegramUser,
    totalAmount: updated.totalAmount,
    absoluteFilePath: resolveUploadPath(fileUrl),
  });

  return updated;
}

/** Восстанавливает зарезервированный склад заказа (идемпотентно). */
async function restoreStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.stockRestored) return;
  if (!RESERVED_STATUSES.includes(order.status as OrderStatus)) return;

  for (const item of order.items) {
    if (item.productSizeId) {
      await tx.productSize.update({
        where: { id: item.productSizeId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
  await tx.order.update({ where: { id: orderId }, data: { stockRestored: true } });
}

/** Смена статуса заказа администратором. При отмене восстанавливает склад. */
export async function setOrderStatus(orderId: string, status: OrderStatus) {
  if (!isOrderStatus(status)) throw badRequest("Недопустимый статус заказа");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: orderId } });
    if (!existing) throw notFound("Заказ не найден");

    if (status === "CANCELLED") {
      await restoreStock(tx, orderId);
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status },
      include: orderInclude,
    });
  });
}

export interface ListOrdersFilter {
  status?: OrderStatus;
}

export async function listOrders(filter: ListOrdersFilter = {}) {
  return prisma.order.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Отменяет неоплаченные заказы старше окна оплаты и возвращает зарезервированный склад.
 * Возвращает количество отменённых заказов.
 */
export async function cancelExpiredOrders(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      paymentDueAt: { lt: now },
    },
    select: { id: true },
  });

  let cancelled = 0;
  for (const { id } of expired) {
    await prisma.$transaction(async (tx) => {
      // Перечитываем внутри транзакции — статус мог измениться.
      const order = await tx.order.findUnique({ where: { id } });
      if (!order || order.status !== "AWAITING_PAYMENT") return;
      await restoreStock(tx, id);
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
      cancelled += 1;
    });
  }

  if (cancelled > 0) {
    console.log(`[cleanup] Автоматически отменено заказов: ${cancelled}`);
  }
  return cancelled;
}
