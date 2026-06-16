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
} from "../validation.js";
import { listOrders, setOrderStatus } from "../services/orders.js";
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
  listAdminProducts,
  reorderProducts,
  updateProduct,
} from "../services/adminProducts.js";
import { uploadProductImages, uploadSizeChart } from "../lib/upload.js";
import { UPLOADS_URL_PREFIX } from "../lib/uploads.js";

export const adminRouter = Router();

adminRouter.use(adminAuth);

// Простая проверка токена (для формы входа в админку)
adminRouter.get("/session", (_req, res) => {
  res.json({ ok: true });
});

// --- Заказы ---
adminRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const statusParam = req.query.status;
    let status: OrderStatus | undefined;
    if (typeof statusParam === "string" && statusParam.length > 0) {
      if (!isOrderStatus(statusParam)) throw badRequest("Недопустимый статус для фильтра");
      status = statusParam;
    }
    res.json(await listOrders({ status }));
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

// Загрузка изображений товара (несколько файлов)
adminRouter.post(
  "/products/images",
  uploadProductImages.array("images", 20),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("Не выбрано ни одного изображения");
    const urls = files.map((file) => `${UPLOADS_URL_PREFIX}/${file.filename}`);
    res.status(201).json({ urls });
  }),
);

// Загрузка размерной сетки (одно изображение)
adminRouter.post(
  "/products/size-chart",
  uploadSizeChart.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Не выбрано изображение размерной сетки");
    res.status(201).json({ url: `${UPLOADS_URL_PREFIX}/${req.file.filename}` });
  }),
);
