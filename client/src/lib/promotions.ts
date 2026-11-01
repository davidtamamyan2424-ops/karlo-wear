/** 10% off each hoodie + pants set; all amounts are in kopecks. */
export const BUNDLE_DISCOUNT_RATE = 0.1;
export const FREE_DELIVERY_THRESHOLD = 1_200_000;
export type ProductCategory = "TSHIRT" | "HOODIE" | "PANTS";
export interface CartLine {
  unitPrice: number;
  quantity: number;
  category?: string | null;
}
export interface CartPricing {
  subtotal: number;
  discount: number;
  total: number;
  unitCount: number;
  qualifiesFreeDelivery: boolean;
  freeDeliveryRemaining: number;
}
export function calcCartPricing(lines: CartLine[]): CartPricing {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hoodies: number[] = [];
  const pants: number[] = [];
  for (const line of lines) {
    if (line.category !== "HOODIE" && line.category !== "PANTS") continue;
    for (let i = 0; i < line.quantity; i++) {
      (line.category === "HOODIE" ? hoodies : pants).push(line.unitPrice);
    }
  }
  // Match highest-priced eligible pieces first; one unit participates in at most one set.
  hoodies.sort((a, b) => b - a);
  pants.sort((a, b) => b - a);
  const sets = Math.min(hoodies.length, pants.length);
  let discount = 0;
  for (let i = 0; i < sets; i++) {
    discount += Math.round((hoodies[i]! + pants[i]!) * BUNDLE_DISCOUNT_RATE);
  }
  const total = subtotal - discount;
  return {
    subtotal, discount, total, unitCount,
    qualifiesFreeDelivery: total >= FREE_DELIVERY_THRESHOLD,
    freeDeliveryRemaining: Math.max(0, FREE_DELIVERY_THRESHOLD - total),
  };
}
