-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- Index for admin/catalog filters
CREATE INDEX "Product_archived_isActive_idx" ON "Product"("archived", "isActive");
