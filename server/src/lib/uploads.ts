import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/uploads (на уровень выше src/lib -> src -> server)
export const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
export const UPLOADS_URL_PREFIX = "/uploads";

export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/** Преобразует публичный URL чека (/uploads/xxx) в абсолютный путь на диске. */
export function resolveUploadPath(fileUrl: string): string {
  const fileName = path.basename(fileUrl);
  return path.join(UPLOADS_DIR, fileName);
}
