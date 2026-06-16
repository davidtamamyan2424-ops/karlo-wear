-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" INTEGER,
    "imageUrl" TEXT,
    "imagesJson" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantSize" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantSize_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "productVariantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "productVariantSizeId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantSku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");
CREATE UNIQUE INDEX "ProductVariantSize_variantId_label_key" ON "ProductVariantSize"("variantId", "label");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantSize" ADD CONSTRAINT "ProductVariantSize_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantSizeId_fkey" FOREIGN KEY ("productVariantSizeId") REFERENCES "ProductVariantSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default variants for existing products.
INSERT INTO "ProductVariant" ("id", "productId", "name", "sku", "price", "imageUrl", "imagesJson", "isDefault", "createdAt", "updatedAt")
SELECT
  'pv_' || p."id",
  p."id",
  'Базовый цвет',
  p."sku" || '-DEFAULT',
  NULL,
  p."imageUrl",
  p."imagesJson",
  true,
  p."createdAt",
  p."updatedAt"
FROM "Product" p;

INSERT INTO "ProductVariantSize" ("id", "variantId", "label", "stock")
SELECT
  'pvs_' || ps."id",
  'pv_' || ps."productId",
  ps."label",
  ps."stock"
FROM "ProductSize" ps;

-- Backfill order snapshots for compatibility with historical orders.
UPDATE "OrderItem" oi
SET
  "productVariantId" = 'pv_' || oi."productId",
  "variantName" = pv."name",
  "variantSku" = pv."sku"
FROM "ProductVariant" pv
WHERE pv."id" = 'pv_' || oi."productId";

UPDATE "OrderItem" oi
SET "productVariantSizeId" = pvs."id"
FROM "ProductVariantSize" pvs
JOIN "ProductVariant" pv ON pv."id" = pvs."variantId"
WHERE oi."productVariantId" = pv."id"
  AND oi."sizeLabel" = pvs."label";
