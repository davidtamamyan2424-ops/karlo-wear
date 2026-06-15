import type { Request, Response, NextFunction, RequestHandler } from "express";

/** Оборачивает async-обработчик, пробрасывая ошибки в errorHandler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
