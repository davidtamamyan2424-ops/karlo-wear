import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcCartPricing } from "./promotions.js";

describe("bundle pricing", () => {
  it("does not discount two t-shirts or unrelated items", () => {
    assert.equal(calcCartPricing([{ unitPrice: 380_000, quantity: 2, category: "TSHIRT" }]).discount, 0);
  });
  it("discounts a hoodie and pants together", () => {
    const p = calcCartPricing([{ unitPrice: 650_000, quantity: 1, category: "HOODIE" }, { unitPrice: 450_000, quantity: 1, category: "PANTS" }]);
    assert.equal(p.discount, 110_000);
    assert.equal(p.total, 990_000);
    assert.equal(p.freeDeliveryRemaining, 210_000);
  });
  it("discounts only matched sets, choosing highest-priced eligible units", () => {
    const p = calcCartPricing([
      { unitPrice: 650_000, quantity: 2, category: "HOODIE" },
      { unitPrice: 450_000, quantity: 1, category: "PANTS" },
      { unitPrice: 380_000, quantity: 1, category: "TSHIRT" },
    ]);
    assert.equal(p.discount, 110_000);
  });
  it("discounts multiple sets and preserves free shipping threshold", () => {
    const p = calcCartPricing([
      { unitPrice: 650_000, quantity: 2, category: "HOODIE" },
      { unitPrice: 450_000, quantity: 2, category: "PANTS" },
    ]);
    assert.equal(p.discount, 220_000);
    assert.equal(p.total, 1_980_000);
    assert.equal(p.qualifiesFreeDelivery, true);
  });
  it("does not discount unclassified legacy products", () => {
    assert.equal(calcCartPricing([{ unitPrice: 650_000, quantity: 1 }, { unitPrice: 450_000, quantity: 1 }]).discount, 0);
  });
});
