import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { ensureUploadsDir } from "./lib/uploads.js";
import { publicUploadsMiddleware, UPLOADS_URL_PREFIX } from "./lib/publicUploads.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";
import helmet from 'helmet';
import { sessions, protectOrigin } from './middleware/session.js';
import { apiLimit } from './middleware/limits.js';
import { prisma } from './lib/prisma.js';

export function createApp(): Application {
  ensureUploadsDir();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet({
    contentSecurityPolicy: false, // HTML policy is set by Nginx; Telegram Web embeds need explicit ancestors.
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: env.isProduction ? { maxAge: 15552000, includeSubDomains: false } : false,
  }));

  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiLimit, protectOrigin, sessions);
  app.use('/api/admin', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/orders', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  // Загруженные файлы (оригиналы фото недоступны публично)
  app.use(UPLOADS_URL_PREFIX, publicUploadsMiddleware);

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  app.get('/api/ready', async (_req, res) => {
    try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
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
