import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { badRequest } from "../lib/errors.js";
import { createOrderSchema } from "../validation.js";
import { handleReceiptUpload } from "../lib/upload.js";
import { UPLOADS_URL_PREFIX } from "../lib/uploads.js";
import { attachPaymentProof, createOrder, getOrderById } from "../services/orders.js";

export const ordersRouter = Router();

// Оформление заказа
ordersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body);
    const order = await createOrder(body);
    res.status(201).json(order);
  }),
);

// Страница оплаты — получить заказ
ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getOrderById(req.params.id));
  }),
);

// Загрузка чека об оплате
ordersRouter.post(
  "/:id/payment-proof",
  handleReceiptUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Файл чека не загружен");
    const fileUrl = `${UPLOADS_URL_PREFIX}/${req.file.filename}`;
    const order = await attachPaymentProof(req.params.id, fileUrl);
    res.status(201).json(order);
  }),
);
