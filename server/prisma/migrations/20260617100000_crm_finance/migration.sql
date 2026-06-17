-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productionCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "packagingCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "otherUnitCost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "financeRecorded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ManualSale" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "productVariantSizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER,
    "comment" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "saleCategory" TEXT NOT NULL DEFAULT 'OTHER',
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "unitCostSnapshot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "comment" TEXT,
    "paymentSource" TEXT NOT NULL DEFAULT 'CARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cashDelta" INTEGER NOT NULL DEFAULT 0,
    "cardDelta" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "comment" TEXT,
    "orderId" TEXT,
    "manualSaleId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyTransaction_expenseId_key" ON "MoneyTransaction"("expenseId");

-- AddForeignKey
ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_productVariantSizeId_fkey" FOREIGN KEY ("productVariantSizeId") REFERENCES "ProductVariantSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_manualSaleId_fkey" FOREIGN KEY ("manualSaleId") REFERENCES "ManualSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
