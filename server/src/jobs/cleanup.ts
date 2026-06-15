import { cancelExpiredOrders } from "../services/orders.js";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // каждые 5 минут

/** Запускает периодическую авто-отмену неоплаченных заказов. */
export function startCleanupJob(): NodeJS.Timeout {
  // Первый прогон при старте.
  void runSafely();
  const timer = setInterval(() => void runSafely(), CLEANUP_INTERVAL_MS);
  // Не держим процесс живым только из-за таймера.
  timer.unref?.();
  console.log("[cleanup] Задача авто-отмены неоплаченных заказов запущена.");
  return timer;
}

async function runSafely(): Promise<void> {
  try {
    await cancelExpiredOrders();
  } catch (error) {
    console.error("[cleanup] Ошибка авто-отмены:", error);
  }
}
