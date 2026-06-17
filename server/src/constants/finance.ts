export const SALE_STATUSES = ["PAID", "IN_PRODUCTION", "SHIPPED", "COMPLETED"] as const;
export type SaleOrderStatus = (typeof SALE_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "HOSTING",
  "ADVERTISING",
  "PACKAGING",
  "MATERIALS",
  "DELIVERY",
  "COMMISSIONS",
  "EQUIPMENT",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOSTING: "Сайт и хостинг",
  ADVERTISING: "Реклама",
  PACKAGING: "Упаковка",
  MATERIALS: "Закупка материалов",
  DELIVERY: "Доставка",
  COMMISSIONS: "Комиссии",
  EQUIPMENT: "Оборудование",
  OTHER: "Прочее",
};

export const PAYMENT_METHODS = ["CASH", "CARD", "NONE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Наличные",
  CARD: "На карте",
  NONE: "Без оплаты",
};

export const SALE_CATEGORIES = ["FRIEND", "EVENT", "SELF", "GIFT", "PROMO", "OTHER"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

export const SALE_CATEGORY_LABELS: Record<SaleCategory, string> = {
  FRIEND: "Продано другу",
  EVENT: "Продано на мероприятии",
  SELF: "Для себя",
  GIFT: "Подарок",
  PROMO: "Промо образец",
  OTHER: "Другое",
};

export const MONEY_TX_TYPES = [
  "ORDER_PAYMENT",
  "ORDER_REFUND",
  "MANUAL_SALE",
  "EXPENSE",
  "CASH_IN",
  "CASH_OUT",
  "CARD_IN",
  "CARD_OUT",
  "TRANSFER_TO_CARD",
  "TRANSFER_TO_CASH",
] as const;
export type MoneyTxType = (typeof MONEY_TX_TYPES)[number];

/** Порог чистой прибыли месяца для зарплаты владельца (копейки). */
export const OWNER_SALARY_THRESHOLD = 10_000_000;
export const OWNER_SALARY_RATE = 0.4;

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

export function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}

export function isSaleCategory(v: string): v is SaleCategory {
  return (SALE_CATEGORIES as readonly string[]).includes(v);
}

export function isMoneyTxType(v: string): v is MoneyTxType {
  return (MONEY_TX_TYPES as readonly string[]).includes(v);
}
