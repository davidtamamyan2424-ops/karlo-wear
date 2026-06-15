import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

/** Простая защита админ-эндпоинтов общим секретом (заголовок X-Admin-Token). */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!env.adminApiToken) {
    res.status(503).json({ error: "Админ-доступ не настроен (ADMIN_API_TOKEN не задан)" });
    return;
  }

  const token =
    req.header("x-admin-token") ??
    req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (token !== env.adminApiToken) {
    res.status(401).json({ error: "Неверный токен доступа" });
    return;
  }

  next();
}
