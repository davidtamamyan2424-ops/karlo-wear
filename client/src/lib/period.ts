export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export const MONTH_NAMES_SHORT = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
] as const;

export type PeriodPreset =
  | "today"
  | "last7"
  | "last30"
  | "current_month"
  | "prev_month"
  | "this_year"
  | "custom";

export interface PeriodState {
  preset: PeriodPreset;
  from?: string;
  to?: string;
}

export const PERIOD_STORAGE_KEY = "karlo-wear-admin-period";

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Сегодня",
  last7: "Последние 7 дней",
  last30: "Последние 30 дней",
  current_month: "Текущий месяц",
  prev_month: "Прошлый месяц",
  this_year: "Этот год",
  custom: "Произвольный период",
};

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

export function defaultPeriodState(): PeriodState {
  return { preset: "current_month" };
}

export function loadPeriodState(): PeriodState {
  try {
    const raw = sessionStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return defaultPeriodState();
    const parsed = JSON.parse(raw) as PeriodState;
    if (parsed.preset && parsed.preset in PERIOD_PRESET_LABELS) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultPeriodState();
}

export function savePeriodState(state: PeriodState): void {
  sessionStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(state));
}

export function periodToSearchParams(state: PeriodState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("preset", state.preset);
  if (state.preset === "custom" && state.from && state.to) {
    params.set("from", state.from);
    params.set("to", state.to);
  }
  return params;
}

export function periodQueryString(state: PeriodState): string {
  const qs = periodToSearchParams(state).toString();
  return qs ? `?${qs}` : "";
}

/** @deprecated Используйте PeriodState */
export function recentMonthOptions(count = 24): { key: string; label: string }[] {
  const items: { key: string; label: string }[] = [];
  const now = new Date();
  const currentKey = currentMonthKey();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d.getFullYear(), d.getMonth() + 1);
    const label =
      key === currentKey
        ? "Текущий месяц"
        : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    items.push({ key, label });
  }
  return items;
}
