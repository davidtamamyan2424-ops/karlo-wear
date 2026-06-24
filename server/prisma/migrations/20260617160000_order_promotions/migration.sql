ALTER TABLE "Order" ADD COLUMN "subtotalAmount" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Order" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "subtotalAmount" SET NOT NULL;
