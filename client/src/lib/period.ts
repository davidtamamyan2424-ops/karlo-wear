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

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
}

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
