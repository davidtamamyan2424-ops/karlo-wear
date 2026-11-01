import { createHash, timingSafeEqual, createHmac } from 'node:crypto';
import { unauthorized } from './errors.js';
import { env } from '../config/env.js';

export const hashSecret = (value: string): string => createHash('sha256').update(value).digest('hex');
export function secretsEqual(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(hashSecret(left)), Buffer.from(hashSecret(right)));
}

export function verifyTelegramIdentity(initData?: string): { id: string; username: string | null } | null {
  if (!initData) return null; // Normal browser checkout is supported.
  if (!env.telegramBotToken) throw unauthorized('Telegram-вход временно недоступен');
  const params = new URLSearchParams(initData);
  const supplied = params.get('hash') ?? '';
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(env.telegramBotToken).digest();
  const expected = createHmac('sha256', key).update(check).digest('hex');
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!/^[a-f0-9]{64}$/i.test(supplied) || !secretsEqual(supplied, expected) || !Number.isFinite(age) || age < -60 || age > 3600) {
    throw unauthorized('Откройте магазин заново из Telegram');
  }
  try {
    const user = JSON.parse(params.get('user') ?? '{}');
    if (!Number.isSafeInteger(user.id)) throw new Error();
    return { id: String(user.id), username: typeof user.username === 'string' ? user.username : null };
  } catch { throw unauthorized('Не удалось подтвердить Telegram-профиль'); }
}
