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
  /** Добавляет товар. Возвращает false, если достигнут лимит склада. */
  addItem: (product: Product, size: Size, quantity?: number, variantId?: string) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "karlo-wear-cart";

const CartContext = createContext<CartContextValue | null>(null);

function itemKey(productId: string, variantId: string, size: Size): string {
  return `${productId}__${variantId}__${size}`;
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback<CartContextValue["addItem"]>((product, size, quantity = 1, variantId) => {
    const variant =
      product.variants.find((v) => v.id === variantId) ??
      product.variants.find((v) => v.id === product.defaultVariantId) ??
      product.variants[0];
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
      addItem,
      setQuantity,
      removeItem,
      clear,
    };
  }, [items, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
