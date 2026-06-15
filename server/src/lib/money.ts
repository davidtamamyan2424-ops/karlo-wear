// Цены хранятся в копейках. Форматирование суммы в рублях для сообщений/уведомлений.
const formatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** «199000» (копейки) -> «1 990 ₽». */
export function formatRub(amountInKopecks: number): string {
  return `${formatter.format(Math.round(amountInKopecks / 100))} ₽`;
}
