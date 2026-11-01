import crypto from "node:crypto";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  ALLOWED_IMAGE_EXT,
  ALLOWED_IMAGE_MIME,
  ALLOWED_PROOF_EXT,
  ALLOWED_PROOF_MIME,
} from "../constants.js";
import { UPLOADS_DIR } from "./uploads.js";
import { RECEIPTS_DIR } from './uploads.js';
import { readFile, unlink } from 'node:fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import { badRequest } from "./errors.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const RECEIPT_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ

export const uploadReceipt = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPTS_DIR),
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(24).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: RECEIPT_MAX_FILE_SIZE, files: 1, fields: 0, parts: 1, fieldNameSize: 100 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = (ALLOWED_PROOF_MIME as readonly string[]).includes(file.mimetype);
    const extOk = (ALLOWED_PROOF_EXT as readonly string[]).includes(ext);
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(badRequest("Поддерживаются только файлы JPG, JPEG, PNG и PDF"));
    }
  },
});

/** Middleware загрузки чека с понятной ошибкой при превышении лимита. */
export function handleReceiptUpload(req: Request, res: Response, next: NextFunction): void {
  uploadReceipt.single("receipt")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(badRequest("Файл слишком большой. Максимальный размер — 20 МБ."));
      return;
    }
    next(err);
  });
}

function imageFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = (ALLOWED_IMAGE_MIME as readonly string[]).includes(file.mimetype);
  const extOk = (ALLOWED_IMAGE_EXT as readonly string[]).includes(ext);
  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(badRequest("Поддерживаются только изображения JPG, JPEG, PNG и WEBP"));
  }
}

export const uploadProductImages = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 0, parts: 20 },
  fileFilter: imageFileFilter,
});

/** Одно изображение размерной сетки. */
export const uploadSizeChart = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: imageFileFilter,
});

export async function validateFileContent(file: Express.Multer.File, receipt = false): Promise<void> {
  const type = await fileTypeFromBuffer(await readFile(file.path));
  const allowed = receipt ? ['image/jpeg', 'image/png', 'application/pdf'] : ['image/jpeg', 'image/png', 'image/webp'];
  if (!type || !allowed.includes(type.mime)) {
    await unlink(file.path).catch(() => {});
    throw badRequest('Содержимое файла не соответствует разрешённому формату');
  }
}
