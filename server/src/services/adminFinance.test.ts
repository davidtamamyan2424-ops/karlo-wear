import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcBusinessBalance, calcOwnerSalary } from "./adminFinance.js";

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

describe("calcBusinessBalance", () => {
  it("adds starting balance to sales minus expenses and owner salary", () => {
    const balance = calcBusinessBalance(12_000_000, [
      { revenue: 5_000_000, otherExpenses: 500_000, ownerSalary: 1_000_000 },
      { revenue: 3_000_000, otherExpenses: 300_000, ownerSalary: 0 },
    ]);
    assert.equal(balance, 18_200_000);
  });

  it("recalculates when starting balance changes", () => {
    const monthly = [{ revenue: 10_000_000, otherExpenses: 2_000_000, ownerSalary: 0 }];
    assert.equal(calcBusinessBalance(10_000_000, monthly), 18_000_000);
    assert.equal(calcBusinessBalance(15_000_000, monthly), 23_000_000);
  });
});
