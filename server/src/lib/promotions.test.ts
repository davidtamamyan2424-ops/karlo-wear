import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcCartPricing, calcSecondItemDiscount } from "../lib/promotions.js";

describe("calcSecondItemDiscount", () => {
  it("returns 0 for a single item", () => {
    assert.equal(calcSecondItemDiscount([380_000]), 0);
  });

  it("discounts 10% on the cheaper of two equal items", () => {
    assert.equal(calcSecondItemDiscount([380_000, 380_000]), 38_000);
  });

  it("discounts cheaper items first with mixed prices", () => {
    const discount = calcSecondItemDiscount([500_000, 400_000, 300_000, 200_000]);
    assert.equal(discount, Math.round(200_000 * 0.1) + Math.round(300_000 * 0.1));
  });
});

describe("calcCartPricing", () => {
  it("qualifies free delivery before discount is applied", () => {
    const pricing = calcCartPricing([
      { unitPrice: 380_000, quantity: 2 },
    ]);
    assert.equal(pricing.subtotal, 760_000);
    assert.equal(pricing.discount, 38_000);
    assert.equal(pricing.total, 722_000);
    assert.equal(pricing.qualifiesFreeDelivery, true);
  });

  it("tracks remaining amount until free delivery", () => {
    const pricing = calcCartPricing([{ unitPrice: 380_000, quantity: 1 }]);
    assert.equal(pricing.qualifiesFreeDelivery, false);
    assert.equal(pricing.freeDeliveryRemaining, 370_000);
  });
});
