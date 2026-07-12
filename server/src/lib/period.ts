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

export type PeriodPreset =
  | "today"
  | "last7"
  | "last30"
  | "current_month"
  | "prev_month"
  | "this_year"
  | "custom";

export interface PeriodQueryInput {
  preset?: string;
  from?: string;
  to?: string;
  /** @deprecated Используйте preset=current_month&month=YYYY-MM */
  month?: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function presetToBounds(
  preset: PeriodPreset,
  customFrom?: string,
  customTo?: string,
): PeriodFilter {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (preset) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "last7":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
        to: todayEnd,
      };
    case "last30":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)),
        to: todayEnd,
      };
    case "current_month":
      return monthBounds(now.getFullYear(), now.getMonth() + 1);
    case "prev_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return monthBounds(d.getFullYear(), d.getMonth() + 1);
    }
    case "this_year":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    case "custom": {
      if (customFrom && customTo && isValidDateStr(customFrom) && isValidDateStr(customTo)) {
        const from = startOfDay(new Date(customFrom));
        const to = endOfDay(new Date(customTo));
        if (from <= to) return { from, to };
      }
      return monthBounds(now.getFullYear(), now.getMonth() + 1);
    }
    default:
      return monthBounds(now.getFullYear(), now.getMonth() + 1);
  }
}

const PRESET_SET = new Set<string>([
  "today",
  "last7",
  "last30",
  "current_month",
  "prev_month",
  "this_year",
  "custom",
]);

/** Парсит query-параметры периода; по умолчанию — текущий месяц. */
export function parsePeriodQuery(input: PeriodQueryInput = {}): PeriodFilter {
  if (input.month && /^\d{4}-\d{2}$/.test(input.month) && !input.preset) {
    const [year, mon] = input.month.split("-").map(Number);
    if (year && mon >= 1 && mon <= 12) return monthBounds(year, mon);
  }

  const preset = input.preset && PRESET_SET.has(input.preset)
    ? (input.preset as PeriodPreset)
    : "current_month";

  return presetToBounds(preset, input.from, input.to);
}

/** Парсит ?month=2026-06; по умолчанию — текущий месяц. */
export function parseMonthQuery(month?: string): PeriodFilter {
  return parsePeriodQuery({ month, preset: month ? undefined : "current_month" });
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

export function periodQueryFromRequest(query: Record<string, unknown>): PeriodFilter {
  return parsePeriodQuery({
    preset: typeof query.preset === "string" ? query.preset : undefined,
    from: typeof query.from === "string" ? query.from : undefined,
    to: typeof query.to === "string" ? query.to : undefined,
    month: typeof query.month === "string" ? query.month : undefined,
  });
}
