import { formatPrice } from "../lib/format";
import { ru } from "../i18n/ru";
import type { CartPricing } from "../lib/promotions";
import { calcGrandTotal } from "../lib/delivery";

interface Props {
  pricing: CartPricing;
  deliveryFee: number | null;
}

function formatDeliveryFee(fee: number | null): string {
  if (fee === null) return ru.cart.deliveryIndividual;
  if (fee === 0) return ru.cart.deliveryFree;
  return formatPrice(fee);
}

export default function CartPriceSummary({ pricing, deliveryFee }: Props) {
  const t = ru.cart;
  const hasDiscount = pricing.discount > 0;
  const grandTotal = calcGrandTotal(pricing.total, deliveryFee);

  return (
    <div className="space-y-2.5 rounded-card bg-surface p-4 text-sm">
      <div className="flex justify-between text-muted">
        <span>{t.products}</span>
        <span className={hasDiscount ? "line-through decoration-muted/60" : ""}>
          {formatPrice(pricing.subtotal)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className={hasDiscount ? "font-medium text-ink" : "text-muted"}>{t.withDiscount}</span>
        <span className={hasDiscount ? "font-semibold text-ink" : "text-muted"}>
          {formatPrice(pricing.total)}
        </span>
      </div>

      <div className="flex justify-between text-muted">
        <span>{t.secondItemDiscount}</span>
        <span className={hasDiscount ? "font-medium text-emerald-700" : ""}>
          {hasDiscount ? `−${formatPrice(pricing.discount)}` : formatPrice(0)}
        </span>
      </div>

      <div className="flex justify-between text-muted">
        <span>{t.deliveryCost}</span>
        <span>{formatDeliveryFee(deliveryFee)}</span>
      </div>

      <div className="flex justify-between border-t border-line pt-2.5 text-base font-semibold text-ink">
        <span>{t.grandTotal}</span>
        <span className="text-lg">{formatPrice(grandTotal)}</span>
      </div>
    </div>
  );
}
