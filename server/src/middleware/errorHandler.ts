import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({ error: first?.message ?? "Ошибка валидации данных" });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
}
