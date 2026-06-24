// Единственные допустимые размеры в магазине.
export const SIZES = ["S", "M", "L", "XL"] as const;
export type Size = (typeof SIZES)[number];

export type ProductBadge = "NEW" | "BESTSELLER" | "LIMITED";

export const PRODUCT_BADGE_LABELS: Record<ProductBadge, string> = {
  NEW: "Новинка",
  BESTSELLER: "Хит продаж",
  LIMITED: "Ограниченная серия",
};

export type DeliveryMethod = "PICKUP" | "MOSCOW" | "MOSCOW_REGION" | "OTHER_REGIONS";

export const DELIVERY_METHODS: DeliveryMethod[] = [
  "PICKUP",
  "MOSCOW",
  "MOSCOW_REGION",
  "OTHER_REGIONS",
];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  PICKUP: "Самовывоз",
  MOSCOW: "Москва",
  MOSCOW_REGION: "Ближайшее Подмосковье",
  OTHER_REGIONS: "Другие регионы России",
};

/** Подписи для старых заказов. */
export const LEGACY_DELIVERY_METHOD_LABELS: Record<string, string> = {
  WILDBERRIES: "Wildberries",
  OZON: "Ozon",
  OTHER: "Другое",
};

/** Реквизиты для оплаты на странице заказа (фиксированные). */
export const DEFAULT_PAYMENT_RECIPIENT = "Давид Т.";
export const DEFAULT_PAYMENT_PHONE = "+79771187025";

export type OrderStatus =
  | "NEW"
  | "AWAITING_PAYMENT"
  | "PAYMENT_REVIEW"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  AWAITING_PAYMENT: "Ожидает оплаты",
  PAYMENT_REVIEW: "Ожидает проверки оплаты",
  PAID: "Оплачен",
  IN_PRODUCTION: "Передан в производство",
  SHIPPED: "Отправлен",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

// Цвета бейджей статусов (Tailwind-классы) для админки.
export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
  PAYMENT_REVIEW: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  IN_PRODUCTION: "bg-violet-100 text-violet-800",
  SHIPPED: "bg-cyan-100 text-cyan-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};
