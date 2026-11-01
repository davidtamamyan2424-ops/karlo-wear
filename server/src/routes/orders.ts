import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest } from '../lib/errors.js';
import { createOrderSchema } from '../validation.js';
import { handleReceiptUpload, validateFileContent } from '../lib/upload.js';
import { attachPaymentProof, createOrder, getOrderById, requireOrderAccess, customerOrder, recoverOrder } from '../services/orders.js';
import { z } from 'zod';
import { assertReceiptAllowed } from '../lib/orderPolicy.js';
import { orderLimit, receiptLimit } from '../middleware/limits.js';
import { receiptQuota } from '../middleware/receiptQuota.js';
export const ordersRouter = Router();
ordersRouter.post('/recover', asyncHandler(async (req,res)=>{
  const data=z.object({idempotencyKey:z.string().uuid(),accessToken:z.string().regex(/^[a-f0-9]{64}$/)}).parse(req.body);
  res.json(await recoverOrder(data.idempotencyKey,data.accessToken));
}));
ordersRouter.post('/', orderLimit, asyncHandler(async (req, res) => {
  const order = await createOrder(createOrderSchema.parse(req.body));
  res.status(201).json(customerOrder(order));
}));
ordersRouter.get('/:id', asyncHandler(async (req, res) => {
  await requireOrderAccess(req.params.id, req.get('x-order-token'));
  res.json(customerOrder(await getOrderById(req.params.id)));
}));
ordersRouter.post('/:id/payment-proof', receiptLimit,
  asyncHandler(async (req, _res, next) => {
    const order = await requireOrderAccess(req.params.id, req.get('x-order-token'));
    assertReceiptAllowed(order);
    next();
  }), receiptQuota, handleReceiptUpload, asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Файл чека не загружен');
    try {
      await validateFileContent(req.file, true);
      const order = await attachPaymentProof(req.params.id, '/private-receipts/' + req.file.filename);
      res.status(201).json(customerOrder(order));
    } catch (error) { await unlink(req.file.path).catch(() => {}); throw error; }
  }));
