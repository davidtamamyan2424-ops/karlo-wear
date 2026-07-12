import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "../types";
import type { Size } from "../constants";
import type { DeliveryMethod } from "../constants";
import { calcCartPricing, type CartPricing } from "../lib/promotions";

export interface CartItem {
  key: string; // productId__variantId__size
  productId: string;
  variantId: string;
  variantName: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  price: number; // в копейках
  size: Size;
  quantity: number;
  maxStock: number; // доступный остаток по размеру
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  discount: number;
  total: number;
  pricing: CartPricing;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  /** Добавляет товар. Возвращает false, если достигнут лимит склада или вариант не найден. */
  addItem: (product: Product, size: Size, quantity: number | undefined, variantId: string) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "karlo-wear-cart";
const DELIVERY_STORAGE_KEY = "karlo-wear-delivery-method";

const CartContext = createContext<CartContextValue | null>(null);

function itemKey(productId: string, variantId: string, size: Size): string {
  return `${productId}__${variantId}__${size}`;
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Отбрасываем старые позиции без variantId — иначе заказ уйдёт на дефолтный цвет.
    return (parsed as CartItem[]).filter(
      (i) =>
        typeof i.productId === "string" &&
        typeof i.variantId === "string" &&
        i.variantId.length > 0 &&
        typeof i.size === "string" &&
        typeof i.quantity === "number",
    );
  } catch {
    return [];
  }
}

function loadDeliveryMethod(): DeliveryMethod {
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY);
    if (raw === "OTHER_REGIONS") return "PICKUP_POINT";
    if (raw === "PICKUP" || raw === "MOSCOW" || raw === "MOSCOW_REGION" || raw === "PICKUP_POINT") {
      return raw;
    }
  } catch {
    /* noop */
  }
  return "PICKUP";
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [deliveryMethod, setDeliveryMethodState] = useState<DeliveryMethod>(loadDeliveryMethod);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(DELIVERY_STORAGE_KEY, deliveryMethod);
  }, [deliveryMethod]);

  const setDeliveryMethod = useCallback((method: DeliveryMethod) => {
    setDeliveryMethodState(method);
  }, []);

  const addItem = useCallback<CartContextValue["addItem"]>((product, size, quantity = 1, variantId) => {
    // Никогда не подставляем дефолтный цвет — только явно выбранный вариант.
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return false;
    const sizeInfo = variant.sizes.find((s) => s.label === size);
    const maxStock = sizeInfo?.stock ?? 0;
    if (maxStock <= 0) return false;

    const key = itemKey(product.id, variant.id, size);
    let added = true;

    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        const next = Math.min(existing.quantity + quantity, maxStock);
        if (next === existing.quantity) {
          added = false; // лимит склада достигнут
          return prev;
        }
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: next, maxStock } : i,
        );
      }
      const next = Math.min(quantity, maxStock);
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant.id,
          variantName: variant.name,
          sku: variant.sku,
          name: product.name,
          imageUrl: variant.images[0] ?? variant.imageUrl ?? null,
          price: variant.price ?? product.price,
          size,
          quantity: next,
          maxStock,
        },
      ];
    });

    return added;
  }, []);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>((key, quantity) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        const clamped = Math.max(0, Math.min(quantity, i.maxStock));
        if (clamped <= 0) return [];
        return [{ ...i, quantity: clamped }];
      }),
    );
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const lines = items.map((i) => ({ unitPrice: i.price, quantity: i.quantity }));
    const pricing = calcCartPricing(lines);
    const count = pricing.unitCount;
    return {
      items,
      count,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      total: pricing.total,
      pricing,
      deliveryMethod,
      setDeliveryMethod,
      addItem,
      setQuantity,
      removeItem,
      clear,
    };
  }, [items, deliveryMethod, setDeliveryMethod, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
