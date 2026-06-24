import { formatPrice } from "../lib/format";
import { ru } from "../i18n/ru";
import type { CartPricing } from "../lib/promotions";
import { calcGrandTotal } from "../lib/delivery";

interface Props {
  pricing: CartPricing;
  deliveryFee?: number | null;
  showGrandTotal?: boolean;
}

function formatDeliveryFee(fee: number | null): string {
  if (fee === null) return ru.cart.deliveryIndividual;
  if (fee === 0) return ru.cart.deliveryFree;
  return formatPrice(fee);
}

export default function CartPriceSummary({
  pricing,
  deliveryFee,
  showGrandTotal = false,
}: Props) {
  const t = ru.cart;
  const hasDelivery = deliveryFee !== undefined;
  const grandTotal = hasDelivery ? calcGrandTotal(pricing.total, deliveryFee ?? null) : pricing.total;

  return (
    <div className="space-y-2.5 rounded-card bg-surface p-4 text-sm">
      <div className="flex justify-between text-muted">
        <span>{t.products}</span>
        <span>{formatPrice(pricing.subtotal)}</span>
      </div>

      {pricing.discount > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span>{t.yourSavings}</span>
          <span className="font-medium">−{formatPrice(pricing.discount)}</span>
        </div>
      )}

      {hasDelivery && deliveryFee !== undefined && (
        <div className="flex justify-between text-muted">
          <span>{t.delivery}</span>
          <span>{formatDeliveryFee(deliveryFee)}</span>
        </div>
      )}

      <div className="flex justify-between border-t border-line pt-2.5 text-base font-semibold text-ink">
        <span>{showGrandTotal ? t.grandTotal : t.total}</span>
        <span>{formatPrice(grandTotal)}</span>
      </div>
    </div>
  );
}
