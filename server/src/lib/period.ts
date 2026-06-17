import type { PeriodFilter } from "../services/adminFinance.js";

/** Ключ месяца: YYYY-MM */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function monthBounds(year: number, month: number): PeriodFilter {
  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

/** Парсит ?month=2026-06; по умолчанию — текущий месяц. */
export function parseMonthQuery(month?: string): PeriodFilter {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    return monthBounds(now.getFullYear(), now.getMonth() + 1);
  }
  const [year, mon] = month.split("-").map(Number);
  if (!year || mon < 1 || mon > 12) {
    const now = new Date();
    return monthBounds(now.getFullYear(), now.getMonth() + 1);
  }
  return monthBounds(year, mon);
}

/** Список месяцев за последние N месяцев включая текущий. */
export function recentMonthOptions(count = 24): { key: string; year: number; month: number }[] {
  const items: { key: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    items.push({
      key: monthKey(d.getFullYear(), d.getMonth() + 1),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return items;
}
