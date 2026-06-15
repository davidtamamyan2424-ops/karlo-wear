import type { DeliveryMethod, OrderStatus, Size } from "./constants";

export interface ProductSize {
  id: string;
  productId: string;
  label: Size;
  stock: number;
}

export type ProductBadge = "NEW" | "BESTSELLER" | "LIMITED";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number; // в копейках
  currency: string;
  imageUrl: string | null;
  images: string[];
  badge: ProductBadge | string | null;
  composition: string | null;
  fabricDensity: string | null;
  category: string | null;
  modelHeight: number | null;
  modelSize: string | null;
  isActive: boolean;
  sizes: ProductSize[];
  totalStock?: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sizeLabel: string | null;
  unitPrice: number;
  quantity: number;
}

export interface PaymentProof {
  id: string;
  orderId: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  phone: string;
  city: string;
  comment: string | null;
  telegramUser: string | null;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  assignedBankName: string | null;
  assignedRecipientName: string | null;
  assignedPhoneNumber: string | null;
  deliveryMethod: DeliveryMethod | string | null;
  deliveryAddress: string | null;
  deliveryComment: string | null;
  deliveryConfirmed: boolean;
  paymentDueAt: string | null;
  items: OrderItem[];
  paymentProofs: PaymentProof[];
  createdAt: string;
}

export interface PaymentAccount {
  id: string;
  bankName: string;
  recipientName: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderPayload {
  customerName: string;
  phone: string;
  city: string;
  comment?: string | null;
  telegramUser: string;
  telegramId?: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string | null;
  deliveryComment?: string | null;
  deliveryConfirmed: boolean;
  items: { productId: string; sizeLabel: Size; quantity: number }[];
}
