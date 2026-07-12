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
import { calcCartPricing } from "../lib/promotions.js";
import { calcDeliveryFee } from "../lib/delivery.js";
import type { DeliveryMethod } from "../constants.js";
import { decrementVariantStock, restoreOrderItemStock } from "./stock.js";

const ORDER_NUMBER_START = 1000;

export interface CreateOrderItemInput {
  productId: string;
  variantId: string;
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
      productVariantId: string | null;
      productVariantSizeId: string | null;
      productSizeId: string | null;
      productName: string;
      variantName: string | null;
      variantSku: string | null;
      sizeLabel: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw badRequest("Неверное количество товара");
      }

      if (!item.variantId) {
        throw badRequest("Не указан цвет товара");
      }

      const size = await tx.productVariantSize.findFirst({
        where: {
          label: item.sizeLabel,
          variant: {
            id: item.variantId,
            productId: item.productId,
          },
        },
        include: { variant: { include: { product: true } } },
      });

      if (!size || !size.variant.product.isActive) {
        throw notFound("Товар или выбранный цвет не найден");
      }

      await decrementVariantStock(tx, size.id, item.quantity);

      const baseSize = size.variant.isDefault
        ? await tx.productSize.findFirst({
            where: { productId: size.variant.productId, label: size.label },
            select: { id: true },
          })
        : null;

      lineItems.push({
        productId: size.variant.productId,
        productVariantId: size.variantId,
        productVariantSizeId: size.id,
        productSizeId: baseSize?.id ?? null,
        productName: size.variant.product.name,
        variantName: size.variant.name,
        variantSku: size.variant.sku,
        sizeLabel: size.label,
        unitPrice: size.variant.price ?? size.variant.product.price,
        quantity: item.quantity,
      });
    }

    const pricing = calcCartPricing(
      lineItems.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity })),
    );
    const deliveryAmount =
      calcDeliveryFee(input.deliveryMethod as DeliveryMethod, pricing) ?? 0;

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
        subtotalAmount: pricing.subtotal,
        discountAmount: pricing.discount,
        deliveryAmount,
        totalAmount: pricing.total + deliveryAmount,
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
  const variantIds = order.items
    .map((i) => i.productVariantId)
    .filter((id): id is string => Boolean(id));
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, imageUrl: true, imagesJson: true },
      })
    : [];

  const imageByVariantId = new Map(
    variants.map((v) => {
      let imageUrl = v.imageUrl;
      if (v.imagesJson) {
        try {
          const parsed = JSON.parse(v.imagesJson);
          if (Array.isArray(parsed) && typeof parsed[0] === "string") {
            imageUrl = parsed[0];
          }
        } catch {
          /* keep cover */
        }
      }
      return [v.id, imageUrl] as const;
    }),
  );

  void notifyNewOrder({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    telegramUser: order.telegramUser,
    items: order.items.map(
      (i): OrderNotificationItem => ({
        productName: i.productName,
        variantName: i.variantName,
        sizeLabel: i.sizeLabel,
        quantity: i.quantity,
        imageUrl: (i.productVariantId && imageByVariantId.get(i.productVariantId)) || null,
      }),
    ),
    totalAmount: order.totalAmount,
    assignedBankName: order.assignedBankName,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    deliveryAddress: order.deliveryAddress,
    deliveryComment: order.deliveryComment,
    city: order.city,
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
    await restoreOrderItemStock(tx, item);
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
  statuses?: OrderStatus[];
  from?: Date;
  to?: Date;
}

function orderWhere(filter: ListOrdersFilter) {
  const where: {
    status?: OrderStatus | { in: OrderStatus[] };
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (filter.statuses?.length) {
    where.status = { in: filter.statuses };
  } else if (filter.status) {
    where.status = filter.status;
  }

  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = filter.from;
    if (filter.to) where.createdAt.lte = filter.to;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

export async function listOrders(filter: ListOrdersFilter = {}) {
  return prisma.order.findMany({
    where: orderWhere(filter),
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
}

export interface OrderStats {
  total: number;
  awaitingPayment: number;
  paid: number;
  shipped: number;
  cancelled: number;
}

const AWAITING_STATUSES: OrderStatus[] = ["NEW", "AWAITING_PAYMENT", "PAYMENT_REVIEW"];
const PAID_STATUSES: OrderStatus[] = ["PAID", "IN_PRODUCTION"];

export async function getOrderStats(filter: Pick<ListOrdersFilter, "from" | "to"> = {}): Promise<OrderStats> {
  const where = orderWhere(filter);
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const count = (statuses: OrderStatus[]) =>
    rows
      .filter((r) => (statuses as readonly string[]).includes(r.status))
      .reduce((s, r) => s + r._count._all, 0);

  const total = rows.reduce((s, r) => s + r._count._all, 0);

  return {
    total,
    awaitingPayment: count(AWAITING_STATUSES),
    paid: count(PAID_STATUSES),
    shipped: count(["SHIPPED", "COMPLETED"]),
    cancelled: count(["CANCELLED"]),
  };
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
