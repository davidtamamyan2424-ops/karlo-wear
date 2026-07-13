import type { TelegramWebApp } from "./types";

const TELEGRAM_SCRIPT_URL = "https://telegram.org/js/telegram-web-app.js";
const SCRIPT_LOAD_TIMEOUT_MS = 8_000;

type TelegramWindow = Window & {
  TelegramWebviewProxy?: unknown;
  TelegramWebviewProxyProto?: unknown;
};

let sdkLoadPromise: Promise<void> | null = null;

/** Returns the Telegram WebApp instance if running inside Telegram, otherwise null. */
export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/**
 * Detects Telegram Mini App without loading telegram.org.
 * Regular browsers must never match — otherwise the public site would hang on telegram.org.
 */
export function shouldLoadTelegramSdk(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Telegram?.WebApp) return true;

  const w = window as TelegramWindow;
  // Android / desktop Telegram WebView bridge (injected before page JS runs).
  if (w.TelegramWebviewProxy || w.TelegramWebviewProxyProto) return true;

  // Mini App launch params Telegram puts into the URL hash (and sometimes query).
  if (hasTgWebAppLaunchParam(window.location.hash.slice(1))) return true;
  if (hasTgWebAppLaunchParam(window.location.search.slice(1))) return true;

  return false;
}

function hasTgWebAppLaunchParam(raw: string): boolean {
  if (!raw) return false;
  // Fast path without full parse (hash can be large).
  if (
    raw.includes("tgWebAppData") ||
    raw.includes("tgWebAppVersion") ||
    raw.includes("tgWebAppPlatform")
  ) {
    return true;
  }
  return false;
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

function loadTelegramSdk(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (!shouldLoadTelegramSdk()) return Promise.resolve();

  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TELEGRAM_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (window.Telegram?.WebApp) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Telegram SDK load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_SCRIPT_URL;
    script.async = true;

    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error("Telegram SDK load timeout"));
    }, SCRIPT_LOAD_TIMEOUT_MS);

    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Telegram SDK load failed"));
    };

    document.head.appendChild(script);
  }).catch((error) => {
    sdkLoadPromise = null;
    throw error;
  });

  return sdkLoadPromise;
}

/**
 * Initializes the Telegram WebApp: loads SDK only inside Mini App, then ready/expand/theme.
 * In a normal browser this is a no-op and never requests telegram.org.
 */
export async function initTelegram(): Promise<TelegramWebApp | null> {
  try {
    await loadTelegramSdk();
  } catch (error) {
    console.warn("[telegram] WebApp SDK unavailable:", error);
    return null;
  }

  const webApp = getWebApp();
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  applyThemeParams(webApp);
  webApp.onEvent("themeChanged", () => applyThemeParams(webApp));

  return webApp;
}
