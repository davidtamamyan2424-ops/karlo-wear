import { fileUrl } from "../api/client";

/** Абсолютный или относительный URL картинки для <img src>. */
export function mediaSrc(url: string): string {
  if (!url) return url;
  return url.startsWith("http") ? url : fileUrl(url);
}

/** Превью каталога (~480px WebP). Для legacy/внешних URL — тот же адрес. */
export function toThumbUrl(url: string): string {
  if (!url) return url;
  if (/-full\.webp(\?|#|$)/i.test(url)) {
    return url.replace(/-full\.webp/i, "-thumb.webp");
  }
  return url;
}

/** Полный размер страницы товара. */
export function toFullUrl(url: string): string {
  if (!url) return url;
  if (/-thumb\.webp(\?|#|$)/i.test(url)) {
    return url.replace(/-thumb\.webp/i, "-full.webp");
  }
  return url;
}

export function thumbSrc(url: string): string {
  return mediaSrc(toThumbUrl(url));
}

export function fullSrc(url: string): string {
  return mediaSrc(toFullUrl(url));
}
