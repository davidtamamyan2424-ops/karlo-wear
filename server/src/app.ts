import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { ensureUploadsDir, UPLOADS_DIR, UPLOADS_URL_PREFIX } from "./lib/uploads.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): Application {
  ensureUploadsDir();

  const app = express();

  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  // Загруженные чеки об оплате
  app.use(UPLOADS_URL_PREFIX, express.static(UPLOADS_DIR));

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Маршруты API
  app.use("/api/products", productsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/admin", adminRouter);

  // 404 fallback for unknown API routes
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Не найдено" });
  });

  app.use(errorHandler);

  return app;
}
