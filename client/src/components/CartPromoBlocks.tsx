import { formatPrice } from "../lib/format";
import { ru } from "../i18n/ru";
import type { CartPricing } from "../lib/promotions";

interface PromoBlocksProps {
  pricing: CartPricing;
}

export function CartPromoBlocks({ pricing }: PromoBlocksProps) {
  const t = ru.cart;

  return (
    <div className="space-y-3">
      {pricing.unitCount === 1 && (
        <div className="rounded-card border border-line bg-paper px-4 py-3.5">
          <p className="text-sm font-medium text-ink">{t.discountUpsell}</p>
        </div>
      )}

      {pricing.qualifiesFreeDelivery ? (
        <div className="rounded-card border border-line bg-paper px-4 py-3.5">
          <p className="text-sm font-semibold text-ink">{t.freeDeliveryCongratsTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.freeDeliveryCongratsText}</p>
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-line bg-paper px-4 py-3.5">
          <p className="text-sm text-muted">
            {t.freeDeliveryRemainingLabel}:{" "}
            <span className="font-semibold text-ink">{formatPrice(pricing.freeDeliveryRemaining)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
