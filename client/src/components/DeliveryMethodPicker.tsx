import { hapticSelection } from "../telegram/webapp";
import { ru } from "../i18n/ru";
import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  type DeliveryMethod,
} from "../constants";
import { calcDeliveryFee } from "../lib/delivery";
import type { CartPricing } from "../lib/promotions";

interface Props {
  value: DeliveryMethod;
  onChange: (method: DeliveryMethod) => void;
  pricing: CartPricing;
  error?: string;
  compact?: boolean;
}

function deliveryPriceLabel(method: DeliveryMethod, pricing: CartPricing): string | null {
  const d = ru.checkout.delivery;
  if (method === "PICKUP_POINT") return null;
  if (method === "PICKUP") return d.optionPrices.PICKUP;
  const fee = calcDeliveryFee(method, pricing);
  if (fee === 0) return ru.cart.deliveryFree;
  return d.optionPrices[method];
}

export default function DeliveryMethodPicker({
  value,
  onChange,
  pricing,
  error,
  compact = false,
}: Props) {
  const d = ru.checkout.delivery;

  return (
    <section className="space-y-3 rounded-card bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{d.title}</h2>
      {!compact && <p className="text-sm text-muted">{d.method}</p>}

      <div className="space-y-2">
        {DELIVERY_METHODS.map((method) => {
          const active = value === method;
          const priceLabel = deliveryPriceLabel(method, pricing);
          const description = d.optionDescriptions[method];
          return (
            <button
              key={method}
              type="button"
              onClick={() => {
                hapticSelection();
                onChange(method);
              }}
              className={[
                "press w-full rounded-button px-4 py-3 text-left transition",
                active
                  ? "bg-ink text-white shadow-soft"
                  : "bg-paper text-ink ring-1 ring-inset ring-line",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold">{DELIVERY_METHOD_LABELS[method]}</span>
                {priceLabel && (
                  <span className={`shrink-0 text-sm font-medium ${active ? "text-white/90" : "text-muted"}`}>
                    {priceLabel}
                  </span>
                )}
              </div>
              {description && (
                <p className={`mt-1 text-sm leading-relaxed ${active ? "text-white/75" : "text-muted"}`}>
                  {description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {error && <span className="block text-xs text-red-600">{error}</span>}
    </section>
  );
}
