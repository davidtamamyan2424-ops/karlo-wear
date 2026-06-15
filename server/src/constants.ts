// Единственные допустимые размеры в магазине.
export const SIZES = ["S", "M", "L", "XL"] as const;
export type Size = (typeof SIZES)[number];

export function isSize(value: unknown): value is Size {
  return typeof value === "string" && (SIZES as readonly string[]).includes(value);
}

// Статусы заказа (храним строкой в БД).
export const ORDER_STATUSES = [
  "NEW", // Новый
  "AWAITING_PAYMENT", // Ожидает оплаты
  "PAYMENT_REVIEW", // Ожидает проверки оплаты
  "PAID", // Оплачен
  "IN_PRODUCTION", // Передан в производство
  "SHIPPED", // Отправлен
  "COMPLETED", // Завершён
  "CANCELLED", // Отменён
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

// Человекочитаемые названия статусов на русском (для админки и уведомлений).
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

// Статусы, при которых склад считается зарезервированным и должен восстанавливаться при отмене.
export const RESERVED_STATUSES: OrderStatus[] = [
  "NEW",
  "AWAITING_PAYMENT",
  "PAYMENT_REVIEW",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
];

export const DEFAULT_CURRENCY = "RUB";

// Срок оплаты заказа, после которого он автоматически отменяется.
export const PAYMENT_WINDOW_HOURS = 12;

// Разрешённые форматы чеков об оплате.
export const ALLOWED_PROOF_MIME = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export const ALLOWED_PROOF_EXT = [".jpg", ".jpeg", ".png", ".pdf"] as const;

// Бейджи витрины товара.
export const PRODUCT_BADGES = ["NEW", "BESTSELLER", "LIMITED"] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number];

// Способы доставки (стоимость считается вручную после оформления заказа).
export const DELIVERY_METHODS = ["WILDBERRIES", "OZON", "OTHER"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  WILDBERRIES: "Wildberries",
  OZON: "Ozon",
  OTHER: "Другое",
};

// Разрешённые форматы изображений товара.
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"] as const;
