import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ru } from "../i18n/ru";
import { formatPrice } from "../lib/format";
import { useCart } from "../cart/CartContext";
import { hapticSelection } from "../telegram/webapp";
import CartPriceSummary from "../components/CartPriceSummary";
import DeliveryMethodPicker from "../components/DeliveryMethodPicker";
import { CartPromoBlocks } from "../components/CartPromoBlocks";
import { calcDeliveryFee } from "../lib/delivery";
import { thumbSrc } from "../lib/images";

export default function CartPage() {
  const { items, pricing, deliveryMethod, setDeliveryMethod, setQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  const deliveryFee = useMemo(
    () => calcDeliveryFee(deliveryMethod, pricing),
    [deliveryMethod, pricing],
  );

  if (items.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <p className="text-base font-medium text-ink">{ru.cart.empty}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="press mt-5 rounded-button bg-ink px-6 py-3 text-sm font-semibold text-white"
        >
          {ru.cart.continueShopping}
        </button>
      </div>
    );
  }

  const step = (key: string, qty: number) => {
    hapticSelection();
    setQuantity(key, qty);
  };

  return (
    <div className="animate-fade-in space-y-5 pb-28">
      <h1 className="px-1 text-[26px] font-semibold tracking-tight text-ink">{ru.cart.title}</h1>

      <CartPromoBlocks pricing={pricing} />

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3.5 rounded-card bg-surface p-3">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl2 bg-line">
              {item.imageUrl && (
                <img
                  src={thumbSrc(item.imageUrl)}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex justify-between gap-2">
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={ru.cart.remove}
                  className="press -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-line"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {ru.product.color}: {item.variantName}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {ru.product.size}: {item.size}
              </p>

              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center gap-1 rounded-full bg-paper p-1">
                  <button
                    type="button"
                    onClick={() => step(item.key, item.quantity - 1)}
                    className="press flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-ink"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={item.quantity >= item.maxStock}
                    onClick={() => step(item.key, item.quantity + 1)}
                    className="press flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-ink disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm font-semibold text-ink">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
              {item.quantity >= item.maxStock && (
                <p className="pt-1 text-[11px] text-muted">{ru.cart.maxStockReached}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <DeliveryMethodPicker
        value={deliveryMethod}
        onChange={setDeliveryMethod}
        pricing={pricing}
        compact
      />

      <CartPriceSummary pricing={pricing} deliveryFee={deliveryFee} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate("/checkout")}
          className="press mx-auto block w-full max-w-2xl rounded-button bg-ink py-3.5 text-[15px] font-semibold text-white shadow-soft"
        >
          {ru.cart.checkout}
        </button>
      </div>
    </div>
  );
}
