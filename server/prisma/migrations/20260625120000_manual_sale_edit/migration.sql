-- Дата продажи и источник для ручных продаж
ALTER TABLE "ManualSale" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ManualSale" ADD COLUMN IF NOT EXISTS "saleSource" TEXT NOT NULL DEFAULT 'MANUAL';

UPDATE "ManualSale" SET "soldAt" = "createdAt" WHERE "soldAt" IS NULL;
