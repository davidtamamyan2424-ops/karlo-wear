-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "colorHex" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill variant order from creation time
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY "createdAt" ASC) - 1 AS pos
  FROM "ProductVariant"
)
UPDATE "ProductVariant" pv
SET "position" = ranked.pos
FROM ranked
WHERE pv.id = ranked.id;
