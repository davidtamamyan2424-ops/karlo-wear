import type { TelegramWebApp } from "./types";

/** Returns the Telegram WebApp instance if running inside Telegram, otherwise null. */
export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/** Whether the app is currently running inside the Telegram client. */
export function isTelegramEnv(): boolean {
  const webApp = getWebApp();
  return Boolean(webApp && webApp.initData.length > 0);
}

/** Данные текущего пользователя Telegram (для префилла формы). */
export function getTelegramUser(): { id: string; username: string | null } | null {
  const user = getWebApp()?.initDataUnsafe.user;
  if (!user) return null;
  return { id: String(user.id), username: user.username ?? null };
}

/** Тактильный отклик при добавлении в корзину и т.п. (без ошибок вне Telegram). */
export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") {
  try {
    getWebApp()?.HapticFeedback.impactOccurred(style);
  } catch {
    // вне Telegram — игнорируем
  }
}

export function hapticNotify(type: "error" | "success" | "warning") {
  try {
    getWebApp()?.HapticFeedback.notificationOccurred(type);
  } catch {
    // вне Telegram — игнорируем
  }
}

export function hapticSelection() {
  try {
    getWebApp()?.HapticFeedback.selectionChanged();
  } catch {
    // вне Telegram — игнорируем
  }
}

/** Открыть внешнюю ссылку (например, чек) корректно внутри Telegram. */
export function openLink(url: string) {
  const webApp = getWebApp();
  if (webApp && typeof (webApp as unknown as { openLink?: (u: string) => void }).openLink === "function") {
    (webApp as unknown as { openLink: (u: string) => void }).openLink(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/** Applies Telegram theme params to CSS custom properties so Tailwind `tg-*` colors work. */
function applyThemeParams(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  const params = webApp.themeParams;
  const map: Record<string, string | undefined> = {
    "--tg-theme-bg-color": params.bg_color,
    "--tg-theme-text-color": params.text_color,
    "--tg-theme-hint-color": params.hint_color,
    "--tg-theme-link-color": params.link_color,
    "--tg-theme-button-color": params.button_color,
    "--tg-theme-button-text-color": params.button_text_color,
    "--tg-theme-secondary-bg-color": params.secondary_bg_color,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value) root.style.setProperty(key, value);
  }
}

/** Initializes the Telegram WebApp: marks ready, expands, and syncs theme. Safe to call outside Telegram. */
export function initTelegram(): TelegramWebApp | null {
  const webApp = getWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  applyThemeParams(webApp);
  webApp.onEvent("themeChanged", () => applyThemeParams(webApp));

  return webApp;
}
