// Форматирование цены в рублях. Цена хранится в копейках.
import { formatRuPhoneDisplay } from "./phone";

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Форматирует сумму в копейках в строку вида «1 990 ₽». */
export function formatPrice(amountInKopecks: number): string {
  return rubFormatter.format(Math.round(amountInKopecks / 100));
}

/** Форматирует рост модели, например «182 см». */
export function formatHeight(cm: number): string {
  return `${cm} см`;
}

/** Форматирует сохранённый номер (+79971153532) для отображения. */
export function formatPhone(phone: string): string {
  return formatRuPhoneDisplay(phone);
}
