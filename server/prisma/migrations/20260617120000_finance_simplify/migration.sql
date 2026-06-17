-- Consolidate product cost fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitCost" INTEGER NOT NULL DEFAULT 0;
UPDATE "Product" SET "unitCost" = COALESCE("productionCost", 0) + COALESCE("packagingCost", 0) + COALESCE("otherUnitCost", 0);
ALTER TABLE "Product" DROP COLUMN IF EXISTS "productionCost";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "packagingCost";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "otherUnitCost";

-- Simplify manual sales
ALTER TABLE "ManualSale" DROP COLUMN IF EXISTS "paymentMethod";

-- Simplify expenses
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "paymentSource";

-- Remove money ledger
DROP TABLE IF EXISTS "MoneyTransaction";

-- Order no longer tracks finance ledger
ALTER TABLE "Order" DROP COLUMN IF EXISTS "financeRecorded";

-- Migrate legacy sale categories
UPDATE "ManualSale" SET "saleCategory" = 'SALE' WHERE "saleCategory" IN ('FRIEND', 'EVENT', 'OTHER');
UPDATE "ManualSale" SET "saleCategory" = 'GIFT' WHERE "saleCategory" = 'PROMO';
