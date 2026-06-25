import type { DeliveryMethod } from "../constants";
import type { CartPricing } from "./promotions";

export const DELIVERY_BASE_FEES: Partial<Record<DeliveryMethod, number>> = {
  MOSCOW: 100_000,
  MOSCOW_REGION: 200_000,
};

/** null — стоимость уточняется отдельно (другие регионы). */
export function calcDeliveryFee(
  method: DeliveryMethod,
  pricing: CartPricing,
): number | null {
  if (method === "PICKUP") return 0;
  if (method === "PICKUP_POINT") return null;

  const base = DELIVERY_BASE_FEES[method] ?? 0;
  if (pricing.qualifiesFreeDelivery) return 0;
  return base;
}

export function calcGrandTotal(productTotal: number, deliveryFee: number | null): number {
  return productTotal + (deliveryFee ?? 0);
}
