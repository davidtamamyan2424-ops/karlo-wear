import path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from "./uploads.js";
import { isOriginalUploadFile } from "./imageOptimize.js";

const staticHandler = express.static(UPLOADS_DIR);

/** Раздаёт uploads, но блокирует доступ к *-original.* */
export function publicUploadsMiddleware(req: Request, res: Response, next: NextFunction): void {
  let decoded: string;
  try { decoded = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
  const fileName = path.basename(decoded);
  if (!/^[\w-]+-(full|thumb)\.webp$/.test(fileName) || isOriginalUploadFile(fileName) || decoded !== '/' + fileName) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  staticHandler(req, res, next);
}

export { UPLOADS_URL_PREFIX };
