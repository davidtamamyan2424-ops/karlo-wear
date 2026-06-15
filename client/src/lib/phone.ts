/** Извлекает цифры российского номера: всегда начинается с 7, максимум 11 цифр. */
export function parseRuPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  return digits.slice(0, 11);
}

/** Нормализует номер для отправки на сервер: +79971153532 */
export function normalizeRuPhone(input: string): string | null {
  const digits = parseRuPhoneDigits(input);
  if (digits.length !== 11 || !digits.startsWith("7")) return null;
  return `+${digits}`;
}

/** Форматирует ввод для поля: +7 (977) 115-35-32 */
export function formatRuPhoneDisplay(input: string): string {
  const digits = parseRuPhoneDigits(input);
  const body = digits.slice(1);

  if (body.length === 0) return "+7";

  let result = "+7 (";
  result += body.slice(0, Math.min(3, body.length));
  if (body.length < 3) return result;

  result += ") ";
  if (body.length <= 3) return result;

  result += body.slice(3, Math.min(6, body.length));
  if (body.length <= 6) return result;

  result += "-";
  result += body.slice(6, Math.min(8, body.length));
  if (body.length <= 8) return result;

  result += "-";
  result += body.slice(8, Math.min(10, body.length));
  return result;
}

export function isCompleteRuPhone(input: string): boolean {
  return parseRuPhoneDigits(input).length === 11;
}
