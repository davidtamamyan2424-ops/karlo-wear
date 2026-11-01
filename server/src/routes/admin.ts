import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { badRequest } from "../lib/errors.js";
import { isOrderStatus, type OrderStatus } from "../constants.js";
import {
  createProductSchema,
  orderStatusSchema,
  paymentAccountSchema,
  paymentAccountUpdateSchema,
  reorderProductsSchema,
  stockAdjustSchema,
  updateProductSchema,
  manualSaleSchema,
  updateManualSaleSchema,
  expenseSchema,
  financeSettingsSchema,
} from "../validation.js";
import { listOrders, setOrderStatus, getOrderStats } from "../services/orders.js";
import {
  createPaymentAccount,
  listPaymentAccounts,
  updatePaymentAccount,
} from "../services/paymentAccounts.js";
import {
  adjustStock,
  createProduct,
  deleteProduct,
  duplicateProduct,
  getAdminProduct,
  listArchivedProducts,
  listAdminProducts,
  permanentlyDeleteProduct,
  reorderProducts,
  restoreProduct,
  updateProduct,
} from "../services/adminProducts.js";
import {
  getWarehouseStock,
  getDashboard,
  getAnalytics,
  getFinanceOverview,
} from "../services/adminFinance.js";
import { getFinanceHistory, type FinanceSourceFilter } from "../services/adminFinanceHistory.js";
import { periodQueryFromRequest } from "../lib/period.js";
import { getFinanceSettings, updateFinanceSettings } from "../services/adminFinanceSettings.js";
import { listManualSales, createManualSale, updateManualSale, deleteManualSale } from "../services/adminManualSales.js";
import { listExpenses, createExpense, deleteExpense } from "../services/adminExpenses.js";
import { uploadProductImages, uploadSizeChart } from "../lib/upload.js";
import { UPLOADS_URL_PREFIX } from "../lib/uploads.js";
import { resolveUploadPath } from '../lib/uploads.js';
import { validateFileContent } from '../lib/upload.js';
import { env } from '../config/env.js';
import { secretsEqual, hashSecret } from '../lib/security.js';
import { randomBytes } from 'node:crypto';
import { adminVersion } from '../middleware/session.js';
import { loginLimit, failedAuthLimit } from '../middleware/limits.js';
import { prisma } from '../lib/prisma.js';
import { confirmRefund } from '../services/orders.js';

export const adminRouter = Router();

adminRouter.post('/login', loginLimit, asyncHandler(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!env.adminApiToken || !secretsEqual(token, env.adminApiToken)) { res.status(401).json({ error: 'Неверный токен доступа' }); return; }
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.adminVersion = adminVersion();
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  res.json({ ok: true });
}));

adminRouter.use(failedAuthLimit,adminAuth);
adminRouter.use((req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) res.on('finish', () => {
    if (res.statusCode < 400) void prisma.auditEvent.create({ data: { action: req.method + ' ' + req.path.slice(0,200) } }).catch(error => console.error('[audit]', error));
  });
  next();
});
adminRouter.post('/logout', (req, res, next) => req.session.destroy(error => {
  if (error) return next(error);
  res.clearCookie('karlo.admin', { httpOnly:true, sameSite:'strict', secure:env.isProduction }); res.json({ ok:true });
}));
adminRouter.get('/receipts/:id', asyncHandler(async (req, res) => {
  const proof = await prisma.paymentProof.findUnique({ where: { id:req.params.id } });
  if (!proof) { res.sendStatus(404); return; }
  res.setHeader('Cache-Control','no-store');
  res.download(resolveUploadPath(proof.fileUrl));
}));
adminRouter.post('/orders/:id/refund', asyncHandler(async (req,res) => { res.json(await confirmRefund(req.params.id)); }));
adminRouter.get('/system',asyncHandler(async (_req,res)=>{
  const [unknownCosts,estimatedCosts,pendingNotifications,failedNotifications]=await Promise.all([
    prisma.product.count({where:{archived:false,unitCost:0}}),
    prisma.orderItem.count({where:{costEstimated:true}}),
    prisma.notificationJob.count(),
    prisma.notificationJob.count({where:{attempts:{gte:8}}}),
  ]);
  res.json({unknownCosts,estimatedCosts,pendingNotifications,failedNotifications});
}));
adminRouter.post('/orders/:id/access-link', asyncHandler(async (req,res) => {
  const token = randomBytes(32).toString('hex');
  await prisma.order.update({ where:{id:req.params.id}, data:{accessTokenHash:hashSecret(token)} });
  res.json({ path: '/order/' + req.params.id + '#access=' + token });
}));

// Простая проверка токена (для формы входа в админку)
adminRouter.get("/session", (_req, res) => {
  res.json({ ok: true });
});

// --- Заказы ---
const ORDER_STATUS_GROUPS: Record<string, OrderStatus[]> = {
  awaiting: ["NEW", "AWAITING_PAYMENT", "PAYMENT_REVIEW"],
  paid: ["PAID", "IN_PRODUCTION"],
  shipped: ["SHIPPED", "COMPLETED"],
  cancelled: ["CANCELLED"],
};

adminRouter.get(
  "/orders/stats",
  asyncHandler(async (req, res) => {
    const period = periodQueryFromRequest(req.query as Record<string, unknown>);
    res.json(await getOrderStats({ from: period.from, to: period.to }));
  }),
);

adminRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const period = periodQueryFromRequest(req.query as Record<string, unknown>);
    const statusParam = req.query.status;
    const groupParam = req.query.statusGroup;

    let status: OrderStatus | undefined;
    let statuses: OrderStatus[] | undefined;

    if (typeof groupParam === "string" && groupParam in ORDER_STATUS_GROUPS) {
      statuses = ORDER_STATUS_GROUPS[groupParam];
    } else if (typeof statusParam === "string" && statusParam.length > 0) {
      if (!isOrderStatus(statusParam)) throw badRequest("Недопустимый статус для фильтра");
      status = statusParam;
    }

    res.json(
      await listOrders({
        limit: Math.min(500, Math.max(1, Math.floor(Number(req.query.limit) || 100))),
        offset: Math.max(0, Math.floor(Number(req.query.offset) || 0)),
        status,
        statuses,
        from: period.from,
        to: period.to,
      }),
    );
  }),
);

adminRouter.post(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = orderStatusSchema.parse(req.body);
    res.json(await setOrderStatus(req.params.id, status));
  }),
);

// --- Платёжные реквизиты ---
adminRouter.get(
  "/payment-accounts",
  asyncHandler(async (_req, res) => {
    res.json(await listPaymentAccounts());
  }),
);

adminRouter.post(
  "/payment-accounts",
  asyncHandler(async (req, res) => {
    const body = paymentAccountSchema.parse(req.body);
    res.status(201).json(await createPaymentAccount(body));
  }),
);

adminRouter.patch(
  "/payment-accounts/:id",
  asyncHandler(async (req, res) => {
    const body = paymentAccountUpdateSchema.parse(req.body);
    res.json(await updatePaymentAccount(req.params.id, body));
  }),
);

// --- Товары ---
adminRouter.get(
  "/products",
  asyncHandler(async (_req, res) => {
    res.json(await listAdminProducts());
  }),
);

adminRouter.get(
  "/products/archive",
  asyncHandler(async (_req, res) => {
    res.json(await listArchivedProducts());
  }),
);

adminRouter.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    res.json(await getAdminProduct(req.params.id));
  }),
);

adminRouter.post(
  "/products",
  asyncHandler(async (req, res) => {
    const body = createProductSchema.parse(req.body);
    res.status(201).json(await createProduct(body));
  }),
);

adminRouter.patch(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const body = updateProductSchema.parse(req.body);
    res.json(await updateProduct(req.params.id, body));
  }),
);

adminRouter.post(
  "/products/:id/duplicate",
  asyncHandler(async (req, res) => {
    res.status(201).json(await duplicateProduct(req.params.id));
  }),
);

// Ручная сортировка товаров (drag-and-drop / вверх-вниз)
adminRouter.post(
  "/products/reorder",
  asyncHandler(async (req, res) => {
    const { ids } = reorderProductsSchema.parse(req.body);
    res.json(await reorderProducts(ids));
  }),
);

// Изменение остатка по размеру («Добавить остаток» / прямое вычитание)
adminRouter.post(
  "/products/:id/stock",
  asyncHandler(async (req, res) => {
    const { label, delta, variantId } = stockAdjustSchema.parse(req.body);
    res.json(await adjustStock(req.params.id, label, delta, variantId));
  }),
);

adminRouter.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    await deleteProduct(req.params.id);
    res.status(204).send();
  }),
);

adminRouter.post(
  "/products/:id/restore",
  asyncHandler(async (req, res) => {
    await restoreProduct(req.params.id);
    res.status(204).send();
  }),
);

adminRouter.delete(
  "/products/:id/permanent",
  asyncHandler(async (req, res) => {
    await permanentlyDeleteProduct(req.params.id);
    res.status(204).send();
  }),
);

// Загрузка изображений товара (несколько файлов) → WebP full + thumb
adminRouter.post(
  "/products/images",
  uploadProductImages.array("images", 20),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("Не выбрано ни одного изображения");

    const { ingestProductImage } = await import("../lib/imageOptimize.js");
    const urls: string[] = [];
    for (const file of files) {
      await validateFileContent(file);
      const optimized = await ingestProductImage(file.path);
      urls.push(optimized.fullUrl);
    }
    res.status(201).json({ urls });
  }),
);

adminRouter.post(
  "/products/regenerate-images",
  asyncHandler(async (_req, res) => {
    const { regenerateAllProductImages } = await import("../services/regenerateProductImages.js");
    const result = await regenerateAllProductImages();
    res.json(result);
  }),
);

// Загрузка размерной сетки (одно изображение)
adminRouter.post(
  "/products/size-chart",
  uploadSizeChart.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Не выбрано изображение размерной сетки");
    await validateFileContent(req.file);
    const { ingestProductImage } = await import('../lib/imageOptimize.js');
    const image = await ingestProductImage(req.file.path);
    res.status(201).json({ url: image.fullUrl });
  }),
);

// --- CRM: склад, продажи, финансы ---

adminRouter.get(
  "/warehouse",
  asyncHandler(async (_req, res) => {
    res.json(await getWarehouseStock());
  }),
);

adminRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const q = req.query;
    res.json(
      await getDashboard({
        preset: typeof q.preset === "string" ? q.preset : undefined,
        from: typeof q.from === "string" ? q.from : undefined,
        to: typeof q.to === "string" ? q.to : undefined,
        month: typeof q.month === "string" ? q.month : undefined,
      }),
    );
  }),
);

adminRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const q = req.query;
    res.json(
      await getAnalytics({
        preset: typeof q.preset === "string" ? q.preset : undefined,
        from: typeof q.from === "string" ? q.from : undefined,
        to: typeof q.to === "string" ? q.to : undefined,
        month: typeof q.month === "string" ? q.month : undefined,
      }),
    );
  }),
);

adminRouter.get(
  "/finance/summary",
  asyncHandler(async (req, res) => {
    const q = req.query;
    res.json(
      await getFinanceOverview({
        preset: typeof q.preset === "string" ? q.preset : undefined,
        from: typeof q.from === "string" ? q.from : undefined,
        to: typeof q.to === "string" ? q.to : undefined,
        month: typeof q.month === "string" ? q.month : undefined,
      }),
    );
  }),
);

adminRouter.get(
  "/finance/history",
  asyncHandler(async (req, res) => {
    const q = req.query;
    const period = periodQueryFromRequest(q as Record<string, unknown>);
    const sourceRaw = typeof q.source === "string" ? q.source : "ALL";
    const validSources = new Set([
      "ALL",
      "WEBSITE_ORDER",
      "MANUAL_SALE",
      "REFUND",
      "ADJUSTMENT",
      "OTHER",
    ]);
    const source = validSources.has(sourceRaw) ? (sourceRaw as FinanceSourceFilter) : "ALL";
    const sort = q.sort === "asc" ? "asc" : "desc";
    const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
    const offset = Math.max(0, Number(q.offset) || 0);

    res.json(await getFinanceHistory({ period, source, sort, limit, offset }));
  }),
);

adminRouter.get(
  "/finance/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getFinanceSettings());
  }),
);

adminRouter.patch(
  "/finance/settings",
  asyncHandler(async (req, res) => {
    const body = financeSettingsSchema.parse(req.body);
    res.json(await updateFinanceSettings(body));
  }),
);

adminRouter.get(
  "/manual-sales",
  asyncHandler(async (_req, res) => {
    res.json(await listManualSales());
  }),
);

adminRouter.post(
  "/manual-sales",
  asyncHandler(async (req, res) => {
    const body = manualSaleSchema.parse(req.body);
    res.status(201).json(await createManualSale(body));
  }),
);

adminRouter.put(
  "/manual-sales/:id",
  asyncHandler(async (req, res) => {
    const body = updateManualSaleSchema.parse(req.body);
    res.json(await updateManualSale(req.params.id, body));
  }),
);

adminRouter.delete(
  "/manual-sales/:id",
  asyncHandler(async (req, res) => {
    await deleteManualSale(req.params.id);
    res.status(204).send();
  }),
);

adminRouter.get(
  "/expenses",
  asyncHandler(async (_req, res) => {
    res.json(await listExpenses());
  }),
);

adminRouter.post(
  "/expenses",
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);
    res.status(201).json(await createExpense(body));
  }),
);

adminRouter.delete(
  "/expenses/:id",
  asyncHandler(async (req, res) => {
    await deleteExpense(req.params.id);
    res.status(204).send();
  }),
);
