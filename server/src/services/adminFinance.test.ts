import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcOwnerSalary } from "./adminFinance.js";

describe("calcOwnerSalary", () => {
  it("returns 0 below threshold", () => {
    assert.equal(calcOwnerSalary(9_999_999), 0);
    assert.equal(calcOwnerSalary(0), 0);
  });

  it("returns 40% at or above 100k rubles net profit", () => {
    assert.equal(calcOwnerSalary(10_000_000), 4_000_000);
    assert.equal(calcOwnerSalary(15_000_000), 6_000_000);
  });
});
