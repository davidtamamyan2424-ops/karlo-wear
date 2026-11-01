import type { OrderStatus } from '../constants.js';
import { conflict } from './errors.js';
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_REVIEW', 'CANCELLED'],
  PAYMENT_REVIEW: ['AWAITING_PAYMENT', 'PAID', 'CANCELLED'],
  PAID: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'], COMPLETED: [], CANCELLED: [],
};
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from !== to && !NEXT_STATUSES[from]?.includes(to)) throw conflict('Этот переход статуса недоступен');
}
export function assertReceiptAllowed(order: { status: string; paymentDueAt: Date | null }): void {
  if (order.status !== 'AWAITING_PAYMENT') throw conflict('Загрузка чека для этого статуса недоступна');
  if (order.paymentDueAt && order.paymentDueAt.getTime() <= Date.now()) throw conflict('Срок оплаты истёк. Обратитесь в поддержку.');
}
