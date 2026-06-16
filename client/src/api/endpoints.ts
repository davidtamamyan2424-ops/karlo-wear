import { apiRequest, apiUpload } from "./client";
import type {
  CreateOrderPayload,
  Order,
  PaymentAccount,
  Product,
  ProductBadge,
} from "../types";
import type { OrderStatus } from "../constants";

// --- Публичные эндпоинты ---
export function fetchProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/products");
}

export function fetchProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`);
}

export function createOrder(payload: CreateOrderPayload): Promise<Order> {
  return apiRequest<Order>("/orders", { method: "POST", body: payload });
}

export function fetchOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}`);
}

export function uploadPaymentProof(orderId: string, file: File): Promise<Order> {
  const form = new FormData();
  form.append("receipt", file);
  return apiUpload<Order>(`/orders/${orderId}/payment-proof`, form);
}

// --- Админ-эндпоинты ---
export function adminCheckSession(token: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/admin/session", { adminToken: token });
}

export function adminFetchOrders(token: string, status?: OrderStatus): Promise<Order[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<Order[]>(`/admin/orders${query}`, { adminToken: token });
}

export function adminSetOrderStatus(
  token: string,
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  return apiRequest<Order>(`/admin/orders/${orderId}/status`, {
    method: "POST",
    body: { status },
    adminToken: token,
  });
}

export function adminFetchPaymentAccounts(token: string): Promise<PaymentAccount[]> {
  return apiRequest<PaymentAccount[]>("/admin/payment-accounts", { adminToken: token });
}

export function adminCreatePaymentAccount(
  token: string,
  data: { bankName: string; recipientName: string; phoneNumber: string },
): Promise<PaymentAccount> {
  return apiRequest<PaymentAccount>("/admin/payment-accounts", {
    method: "POST",
    body: data,
    adminToken: token,
  });
}

export function adminUpdatePaymentAccount(
  token: string,
  id: string,
  data: Partial<{
    bankName: string;
    recipientName: string;
    phoneNumber: string;
    isActive: boolean;
  }>,
): Promise<PaymentAccount> {
  return apiRequest<PaymentAccount>(`/admin/payment-accounts/${id}`, {
    method: "PATCH",
    body: data,
    adminToken: token,
  });
}

// --- Управление товарами ---
export interface ProductPayload {
  name: string;
  description?: string | null;
  price: number; // в копейках
  composition?: string | null;
  badge?: ProductBadge | null;
  images?: string[];
  sizeChartUrl?: string | null;
  isActive?: boolean;
  sizes?: { label: ProductBadgeSize; stock: number }[];
  variants?: {
    id?: string;
    name: string;
    sku: string;
    price?: number | null;
    images?: string[];
    sizes: { label: ProductBadgeSize; stock: number }[];
  }[];
}

type ProductBadgeSize = "S" | "M" | "L" | "XL";

export function adminFetchProducts(token: string): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products", { adminToken: token });
}

export function adminFetchProduct(token: string, id: string): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}`, { adminToken: token });
}

export function adminCreateProduct(token: string, data: ProductPayload): Promise<Product> {
  return apiRequest<Product>("/admin/products", {
    method: "POST",
    body: data,
    adminToken: token,
  });
}

export function adminUpdateProduct(
  token: string,
  id: string,
  data: Partial<ProductPayload>,
): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}`, {
    method: "PATCH",
    body: data,
    adminToken: token,
  });
}

export function adminAdjustStock(
  token: string,
  id: string,
  label: ProductBadgeSize,
  delta: number,
  variantId?: string,
): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}/stock`, {
    method: "POST",
    body: { label, delta, variantId },
    adminToken: token,
  });
}

export function adminDuplicateProduct(token: string, id: string): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}/duplicate`, {
    method: "POST",
    adminToken: token,
  });
}

export function adminReorderProducts(token: string, ids: string[]): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products/reorder", {
    method: "POST",
    body: { ids },
    adminToken: token,
  });
}

export function adminDeleteProduct(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/products/${id}`, {
    method: "DELETE",
    adminToken: token,
  });
}

export function adminUploadProductImages(
  token: string,
  files: File[],
): Promise<{ urls: string[] }> {
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  return apiUpload<{ urls: string[] }>("/admin/products/images", form, {
    adminToken: token,
  });
}

export function adminUploadSizeChart(
  token: string,
  file: File,
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  return apiUpload<{ url: string }>("/admin/products/size-chart", form, {
    adminToken: token,
  });
}
