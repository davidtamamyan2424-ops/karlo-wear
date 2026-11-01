import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startCleanupJob } from "./jobs/cleanup.js";
import { migrateProductImages } from "./services/migrateProductImages.js";
import { startNotifications } from './jobs/notifications.js';
process.env.TZ = 'Europe/Moscow';

const app = createApp();

const server = app.listen(env.port, env.host, () => {
  console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  startCleanupJob();
  startNotifications();

  // Фоновая оптимизация уже загруженных фото (full + thumb WebP).
  if (process.env.MIGRATE_IMAGES_ON_START === 'true') void migrateProductImages()
    .then(({ processed, updated }) => {
      if (processed > 0 || updated > 0) {
        console.log(
          `[images] Оптимизация завершена: обработано файлов ${processed}, обновлено записей ${updated}`,
        );
      }
    })
    .catch((error) => {
      console.warn("[images] Ошибка миграции изображений:", error);
    });
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
