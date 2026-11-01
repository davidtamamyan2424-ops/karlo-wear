import { transaction } from '../lib/transaction.js';
import { hashSecret, verifyTelegramIdentity, secretsEqual } from '../lib/security.js';
import { unauthorized } from '../lib/errors.js';
import { assertTransition, assertReceiptAllowed } from '../lib/orderPolicy.js';
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
  accessToken: string;
  idempotencyKey: string;
  initData?: string;
  legalConsent: true;
  legalConsentVersion: string;
  expectedTotal: number;
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

  const identity = verifyTelegramIdentity(input.initData);
  const { initData: _initData, telegramId: _untrustedId, ...request } = input;
  const requestHash = hashSecret(JSON.stringify(request));
  const order = await transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))::text`;
    const previous = await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: orderInclude });
    if (previous) {
      if (previous.requestHash !== requestHash || !secretsEqual(previous.accessTokenHash ?? '', hashSecret(input.accessToken))) throw conflict('Повторный запрос отличается от первоначального');
      return previous;
    }
    const active = await tx.order.count({ where: { phone: input.phone, status: { in: ['AWAITING_PAYMENT', 'PAYMENT_REVIEW'] } } });
    if (active >= 3) throw conflict('У вас уже есть неоплаченные заказы. Свяжитесь с поддержкой.');
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
<<<<<<< HEAD
=======
      unitCostSnapshot: number;
      costEstimated: boolean;
>>>>>>> origin/main
      category: string | null;
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

      if (!size || !size.variant.product.isActive || size.variant.product.archived) {
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
        category: size.variant.product.category,
<<<<<<< HEAD
=======
        unitCostSnapshot: size.variant.product.unitCost,
        costEstimated: size.variant.product.unitCost === 0,
>>>>>>> origin/main
        quantity: item.quantity,
      });
    }

    const pricing = calcCartPricing(
      lineItems.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity, category: line.category })),
    );
    const deliveryAmount =
      calcDeliveryFee(input.deliveryMethod as DeliveryMethod, pricing) ?? 0;
    if (pricing.total + deliveryAmount !== input.expectedTotal) throw conflict('Сумма заказа изменилась. Обновите корзину перед оформлением.');

    // 2. Генерируем номер заказа (атомарно в транзакции).
    const [number] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq')`;
    const orderNumber = Number(number.nextval);

    // 3. Назначаем случайный активный банк — фиксируется навсегда.
    const accounts = await tx.paymentAccount.findMany({ where: { isActive: true } });
    if (accounts.length === 0) {
      throw conflict("Нет активных реквизитов для оплаты. Обратитесь к администратору.");
    }
    const account = accounts[Math.floor(Math.random() * accounts.length)];

    const paymentDueAt = new Date(Date.now() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

    const created = await tx.order.create({
      data: {
        orderNumber,
        accessTokenHash: hashSecret(input.accessToken),
        idempotencyKey: input.idempotencyKey,
        requestHash,
        legalConsentAt: new Date(),
        legalConsentVersion: input.legalConsentVersion,
        customerName: input.customerName,
        phone: input.phone,
        city: input.city,
        comment: input.comment ?? null,
        telegramUser: identity?.username ?? input.telegramUser,
        telegramId: identity?.id ?? null,
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
        items: { create: lineItems.map(({ category: _category, ...item }) => item) },
      },
      include: orderInclude,
    });
    await tx.notificationJob.create({data:{type:"NEW_ORDER",orderId:created.id}});
    return created;
  });

  return order;
}

export async function notifyOrder(order: Awaited<ReturnType<typeof getOrderById>>) {
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

  await notifyNewOrder({
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

export async function requireOrderAccess(id: string, token: string | undefined) {
  if (!token || token.length > 256) throw unauthorized('Откройте заказ на устройстве, где он был оформлен, или обратитесь в поддержку');
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order?.accessTokenHash || !secretsEqual(order.accessTokenHash, hashSecret(token))) throw unauthorized('Нет доступа к этому заказу');
  return order;
}

export async function recoverOrder(key: string, token: string) {
  const order = await prisma.order.findUnique({where:{idempotencyKey:key},include:orderInclude});
  if (!order) return null;
  if (!order.accessTokenHash || !secretsEqual(order.accessTokenHash,hashSecret(token))) throw unauthorized('Нет доступа к заказу');
  return customerOrder(order);
}

export function customerOrder(order: Awaited<ReturnType<typeof getOrderById>>) {
  return {
    id: order.id, orderNumber: order.orderNumber, status: order.status,
    totalAmount: order.totalAmount, subtotalAmount: order.subtotalAmount, discountAmount: order.discountAmount,
    deliveryAmount: order.deliveryAmount, currency: order.currency,
    assignedBankName: order.assignedBankName, assignedRecipientName: order.assignedRecipientName,
    assignedPhoneNumber: order.assignedPhoneNumber, paymentDueAt: order.paymentDueAt, createdAt: order.createdAt,
    items: order.items.map(({ unitCostSnapshot: _cost, costEstimated: _estimated, ...item }) => item),
    paymentProofs: order.paymentProofs.map(proof => ({ id: proof.id, uploadedAt: proof.uploadedAt })),
  };
}

export async function attachPaymentProof(orderId: string, fileUrl: string) {
  const updated = await transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('Заказ не найден');
    assertReceiptAllowed(order);
    if (await tx.paymentProof.count({ where: { orderId } }) >= 5) throw conflict('Достигнут лимит чеков. Обратитесь в поддержку.');
    const proof = await tx.paymentProof.create({ data: { orderId, fileUrl } });
    await tx.notificationJob.create({data:{type:"NEW_RECEIPT",orderId,receiptId:proof.id}});
    return tx.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' }, include: orderInclude });
  });
  return updated;
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  if (!isOrderStatus(status)) throw badRequest('Недопустимый статус заказа');
  return transaction(async tx => {
    const existing = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!existing) throw notFound('Заказ не найден');
    assertTransition(existing.status as OrderStatus, status);
    if (existing.status === status) return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    if (status === 'CANCELLED' && !existing.stockRestored) {
      for (const item of existing.items) await restoreOrderItemStock(tx, item);
    }
    const updated = await tx.order.update({ where: { id: orderId }, data: {
      status,
      ...(status === 'CANCELLED' ? { stockRestored: true } : {}),
      ...(status === 'PAID' ? { paidAt: new Date() } : {}),
      ...(existing.status === 'PAYMENT_REVIEW' && status === 'AWAITING_PAYMENT' ? { paymentDueAt: new Date(Date.now() + PAYMENT_WINDOW_HOURS * 3600000) } : {}),
    }, include: orderInclude });
    await tx.auditEvent.create({ data: { action: 'ORDER_STATUS_' + status, entityId: orderId } });
    return updated;
  });
}

export async function confirmRefund(orderId: string) {
  return transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'CANCELLED' || !order.paidAt) throw conflict('Возврат доступен только для отменённого оплаченного заказа');
    if (order.refundedAt) return order;
    await tx.auditEvent.create({ data: { action: 'REFUND_CONFIRMED', entityId: orderId } });
    return tx.order.update({ where: { id: orderId }, data: { refundedAt: new Date(), refundAmount: order.totalAmount } });
  });
}

export interface ListOrdersFilter {
  limit?: number;
  offset?: number;
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
  const orders = await prisma.order.findMany({
    where: orderWhere(filter),
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 100, 500),
    skip: filter.offset ?? 0,
  });
  return orders.map(({ accessTokenHash: _secret, requestHash: _request, idempotencyKey: _key, ...order }) => ({
    ...order, paymentProofs: order.paymentProofs.map(proof => ({ ...proof, fileUrl: '/api/admin/receipts/' + proof.id })),
  }));
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
  const expired = await prisma.order.findMany({ where: { status: 'AWAITING_PAYMENT', paymentDueAt: { lt: new Date() } }, select: { id: true }, take: 100 });
  let cancelled = 0;
  for (const { id } of expired) {
    await transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order || order.status !== 'AWAITING_PAYMENT' || !order.paymentDueAt || order.paymentDueAt >= new Date()) return;
      if (!order.stockRestored) for (const item of order.items) await restoreOrderItemStock(tx, item);
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED', stockRestored: true } });
      cancelled++;
    });
  }
  return cancelled;
}
