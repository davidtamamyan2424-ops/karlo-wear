export const SALE_STATUSES = ["PAID", "IN_PRODUCTION", "SHIPPED", "COMPLETED"] as const;

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

export const SALE_CATEGORIES = ["SALE", "GIFT", "SELF", "DEFECT"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

export const SALE_SOURCES = ["MANUAL", "WEBSITE"] as const;
export type SaleSource = (typeof SALE_SOURCES)[number];

export const SALE_CATEGORY_LABELS: Record<SaleCategory, string> = {
  SALE: "Продажа",
  GIFT: "Подарок",
  SELF: "Для себя",
  DEFECT: "Брак",
};

export const OWNER_SALARY_THRESHOLD = 10_000_000;
export const OWNER_SALARY_RATE = 0.4;

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

export function isSaleCategory(v: string): v is SaleCategory {
  return (SALE_CATEGORIES as readonly string[]).includes(v);
}

export function isSaleSource(v: string): v is SaleSource {
  return (SALE_SOURCES as readonly string[]).includes(v);
}
