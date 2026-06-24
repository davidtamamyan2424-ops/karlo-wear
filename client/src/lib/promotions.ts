/** 10% скидка на каждый второй товар. */
export const SECOND_ITEM_DISCOUNT_RATE = 0.1;

/** Порог бесплатной курьерской доставки (копейки). Проверяется после скидки. */
export const FREE_DELIVERY_THRESHOLD = 750_000;

export interface CartLine {
  unitPrice: number;
  quantity: number;
}

export interface CartPricing {
  subtotal: number;
  discount: number;
  total: number;
  unitCount: number;
  qualifiesFreeDelivery: boolean;
  freeDeliveryRemaining: number;
}

export function expandUnitPrices(lines: CartLine[]): number[] {
  const units: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      units.push(line.unitPrice);
    }
  }
  return units;
}

export function calcSecondItemDiscount(unitPrices: number[]): number {
  if (unitPrices.length < 2) return 0;
  const sorted = [...unitPrices].sort((a, b) => a - b);
  const discountSlots = Math.floor(sorted.length / 2);
  let discount = 0;
  for (let i = 0; i < discountSlots; i++) {
    discount += Math.round(sorted[i]! * SECOND_ITEM_DISCOUNT_RATE);
  }
  return discount;
}

export function calcCartPricing(lines: CartLine[]): CartPricing {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const discount = calcSecondItemDiscount(expandUnitPrices(lines));
  const total = subtotal - discount;
  const qualifiesFreeDelivery = total >= FREE_DELIVERY_THRESHOLD;
  const freeDeliveryRemaining = Math.max(0, FREE_DELIVERY_THRESHOLD - total);

  return {
    subtotal,
    discount,
    total,
    unitCount,
    qualifiesFreeDelivery,
    freeDeliveryRemaining,
  };
}
