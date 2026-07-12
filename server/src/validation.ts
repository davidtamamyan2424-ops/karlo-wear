import { z } from "zod";
import {
  SIZES,
  ORDER_STATUSES,
  PRODUCT_BADGES,
  DELIVERY_METHODS,
  PICKUP_POINT_TYPES,
} from "./constants.js";
import {
  EXPENSE_CATEGORIES,
  SALE_CATEGORIES,
  SALE_SOURCES,
} from "./constants/finance.js";
import { normalizeRuPhone } from "./lib/phone.js";

export const createOrderSchema = z
  .object({
    customerName: z.string().trim().min(1, "Укажите имя"),
    phone: z
      .string()
      .trim()
      .transform((val, ctx) => {
        const normalized = normalizeRuPhone(val);
        if (!normalized) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Укажите номер телефона",
          });
          return z.NEVER;
        }
        return normalized;
      }),
    city: z.string().trim().max(120).optional().nullable(),
    comment: z.string().trim().max(1000).optional().nullable(),
    telegramUser: z
      .string()
      .trim()
      .transform((s) => s.replace(/^@/, ""))
      .pipe(
        z
          .string()
          .min(1, "Для оформления заказа необходимо указать Telegram username.")
          .max(64),
      ),
    telegramId: z.string().trim().max(64).optional().nullable(),
    deliveryMethod: z.enum(DELIVERY_METHODS, {
      errorMap: () => ({ message: "Выберите способ доставки" }),
    }),
    pickupPointType: z.enum(PICKUP_POINT_TYPES).optional(),
    customDeliveryMethod: z.string().trim().max(200).optional().nullable(),
    deliveryAddress: z.string().trim().max(500).optional().nullable(),
    deliveryComment: z.string().trim().max(1000).optional().nullable(),
    deliveryConfirmed: z.boolean(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().min(1, "Укажите цвет товара"),
          sizeLabel: z.enum(SIZES),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1, "Добавьте товары в корзину"),
  })
  .superRefine((data, ctx) => {
    if (!data.deliveryConfirmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deliveryConfirmed"],
        message: "Подтвердите условия доставки",
      });
    }

    if (data.deliveryMethod !== "PICKUP") {
      if (!data.city || data.city.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "Укажите город доставки",
        });
      }
    }

    if (data.deliveryMethod === "MOSCOW" || data.deliveryMethod === "MOSCOW_REGION") {
      if (!data.deliveryAddress || data.deliveryAddress.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryAddress"],
          message: "Укажите адрес доставки",
        });
      }
    }

    if (data.deliveryMethod === "PICKUP_POINT") {
      if (!data.pickupPointType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pickupPointType"],
          message: "Выберите способ доставки в пункте выдачи",
        });
        return;
      }

      if (!data.deliveryAddress || data.deliveryAddress.trim().length === 0) {
        const message =
          data.pickupPointType === "WILDBERRIES"
            ? "Укажите адрес пункта выдачи Wildberries"
            : data.pickupPointType === "OZON"
              ? "Укажите адрес пункта выдачи Ozon"
              : "Укажите адрес пункта выдачи или доставки";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryAddress"],
          message,
        });
      }

      if (data.pickupPointType === "CUSTOM") {
        if (!data.customDeliveryMethod || data.customDeliveryMethod.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["customDeliveryMethod"],
            message: "Укажите способ доставки",
          });
        }
      }
    }
  })
  .transform((data) => {
    let deliveryComment = data.deliveryComment ?? null;

    if (data.deliveryMethod === "PICKUP_POINT" && data.pickupPointType) {
      deliveryComment =
        data.pickupPointType === "CUSTOM"
          ? (data.customDeliveryMethod?.trim() ?? null)
          : data.pickupPointType;
    }

    return {
      customerName: data.customerName,
      phone: data.phone,
      city: data.deliveryMethod === "PICKUP" ? "" : (data.city?.trim() ?? ""),
      comment: data.comment ?? null,
      telegramUser: data.telegramUser,
      telegramId: data.telegramId ?? null,
      deliveryMethod: data.deliveryMethod,
      deliveryAddress: data.deliveryAddress ?? null,
      deliveryComment,
      deliveryConfirmed: data.deliveryConfirmed,
      items: data.items,
    };
  });

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

export const paymentAccountSchema = z.object({
  bankName: z.string().trim().min(1, "Укажите банк"),
  recipientName: z.string().trim().min(1, "Укажите получателя"),
  phoneNumber: z.string().trim().min(1, "Укажите номер телефона"),
  isActive: z.boolean().optional(),
});

export const paymentAccountUpdateSchema = paymentAccountSchema.partial();

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

// --- Управление товарами (админка) ---

const sizeStockSchema = z.object({
  label: z.enum(SIZES),
  stock: z.number().int("Остаток должен быть целым числом").min(0, "Остаток не может быть отрицательным"),
});

const productImagesSchema = z
  .array(z.string().trim().min(1).max(1000))
  .max(20, "Слишком много изображений");

const productVariantSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Укажите название цвета").max(80),
  sku: z.string().trim().min(1, "Укажите артикул варианта").max(80),
  colorHex: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^#[0-9A-Fa-f]{6}$/.test(v), "Укажите цвет в формате #RRGGBB"),
  price: z.number().int("Цена должна быть целым числом").min(1).optional().nullable(),
  images: productImagesSchema.optional(),
  sizes: z.array(sizeStockSchema).max(SIZES.length),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Укажите название"),
  description: z.string().trim().max(4000).optional().nullable(),
  // Цена в копейках (minor units)
  price: z.number().int("Цена должна быть целым числом").min(1, "Укажите цену"),
  unitCost: z.number().int().min(0).optional(),
  composition: z.string().trim().max(200).optional().nullable(),
  badge: z.enum(PRODUCT_BADGES).optional().nullable(),
  images: productImagesSchema.optional(),
  sizeChartUrl: z.string().trim().min(1).max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  sizes: z.array(sizeStockSchema).max(SIZES.length).optional(),
  variants: z.array(productVariantSchema).min(1, "Добавьте хотя бы один цвет").optional(),
});

export type CreateProductBody = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductBody = z.infer<typeof updateProductSchema>;

// Изменение остатка: delta (может быть отрицательной для прямого вычитания).
export const stockAdjustSchema = z.object({
  variantId: z.string().trim().min(1).optional(),
  label: z.enum(SIZES),
  delta: z.number().int("Значение должно быть целым числом"),
});

// Ручная сортировка товаров: массив id в желаемом порядке.
export const reorderProductsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Передайте порядок товаров"),
});

export const manualSaleSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  sizeLabel: z.enum(SIZES),
  quantity: z.number().int().min(1).max(999),
  amount: z.number().int().min(0).nullable(),
  comment: z.string().trim().max(500).optional().nullable(),
  saleCategory: z.enum(SALE_CATEGORIES),
  soldAt: z.coerce.date().optional(),
  saleSource: z.enum(SALE_SOURCES).optional(),
});

export const updateManualSaleSchema = manualSaleSchema;

export const expenseSchema = z.object({
  date: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().min(1),
  comment: z.string().trim().max(500).optional().nullable(),
});

export const financeSettingsSchema = z.object({
  startingBalance: z.number().int().min(0),
});
