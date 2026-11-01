import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Product } from "../types";
import type { Size } from "../constants";
import type { DeliveryMethod } from "../constants";
import { calcCartPricing, type CartPricing } from "../lib/promotions";
import { toThumbUrl } from "../lib/images";

export interface CartItem {
  key: string; // productId__variantId__size
  productId: string;
  variantId: string;
  variantName: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
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
  refresh: (products: Product[]) => boolean;
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
        i && typeof i.productId === "string" &&
        typeof i.variantId === "string" &&
        i.variantId.length > 0 &&
        typeof i.size === "string" &&
        Number.isInteger(i.quantity) && i.quantity > 0 && ["S","M","L","XL"].includes(i.size) && Number.isFinite(i.price),
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
  const itemsRef = useRef(items);
  const commitItems = useCallback((update: (previous: CartItem[]) => CartItem[]) => {
    const next = update(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);
  const refresh = useCallback((products: Product[]) => {
    const next = itemsRef.current.flatMap(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      const stock = variant?.sizes.find(s => s.label === item.size)?.stock ?? 0;
      if (!product || !variant || !stock) return [];
      return [{ ...item, price: variant.price ?? product.price, category: product.category, maxStock: stock, quantity: Math.min(item.quantity, stock) }];
    });
    const changed = JSON.stringify(next) !== JSON.stringify(itemsRef.current);
    if (changed) commitItems(() => next);
    return changed;
  }, [commitItems]);
  const [deliveryMethod, setDeliveryMethodState] = useState<DeliveryMethod>(loadDeliveryMethod);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage is optional */ }
  }, [items]);

  useEffect(() => {
    try { localStorage.setItem(DELIVERY_STORAGE_KEY, deliveryMethod); } catch { /* storage is optional */ }
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
    if (!Number.isInteger(quantity) || quantity < 1) return false;
    const previous = itemsRef.current.find(i => i.key === key);
    if (previous && previous.quantity >= maxStock) return false;

    commitItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        const next = Math.min(existing.quantity + quantity, maxStock);
        if (next === existing.quantity) {
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
          imageUrl: toThumbUrl(variant.images[0] ?? variant.imageUrl ?? "") || null,
          category: product.category,
          price: variant.price ?? product.price,
          size,
          quantity: next,
          maxStock,
        },
      ];
    });

    return true;
  }, [commitItems]);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>((key, quantity) => {
    commitItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        const clamped = Math.max(0, Math.min(quantity, i.maxStock));
        if (clamped <= 0) return [];
        return [{ ...i, quantity: clamped }];
      }),
    );
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((key) => {
    commitItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => commitItems(() => []), [commitItems]);

  const value = useMemo<CartContextValue>(() => {
    const lines = items.map((i) => ({ unitPrice: i.price, quantity: i.quantity, category: i.category }));
    const pricing = calcCartPricing(lines);
    const count = pricing.unitCount;
    return {
      items,
      refresh,
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
  }, [items, refresh, deliveryMethod, setDeliveryMethod, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
