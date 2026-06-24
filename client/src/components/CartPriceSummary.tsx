import { formatPrice } from "../lib/format";
import { ru } from "../i18n/ru";
import type { CartPricing } from "../lib/promotions";

interface Props {
  pricing: CartPricing;
}

export default function CartPriceSummary({ pricing }: Props) {
  const t = ru.cart;

  return (
    <div className="space-y-2.5 rounded-card bg-surface p-4 text-sm">
      {pricing.discount > 0 ? (
        <>
          <div className="flex justify-between text-muted">
            <span>{t.withoutDiscount}</span>
            <span className="line-through">{formatPrice(pricing.subtotal)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>{t.yourSavings}</span>
            <span className="font-medium">−{formatPrice(pricing.discount)}</span>
          </div>
        </>
      ) : (
        <div className="flex justify-between text-muted">
          <span>{t.subtotal}</span>
          <span>{formatPrice(pricing.subtotal)}</span>
        </div>
      )}

      <div className="flex justify-between border-t border-line pt-2.5 text-base font-semibold text-ink">
        <span>{t.total}</span>
        <span>{formatPrice(pricing.total)}</span>
      </div>
    </div>
  );
}
