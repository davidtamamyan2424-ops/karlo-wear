-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "telegramId" TEXT,
    "telegramUser" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paymentAccountId" TEXT,
    "assignedBankName" TEXT,
    "assignedRecipientName" TEXT,
    "assignedPhoneNumber" TEXT,
    "deliveryMethod" TEXT,
    "deliveryAddress" TEXT,
    "deliveryComment" TEXT,
    "deliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "paymentDueAt" DATETIME,
    "stockRestored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("assignedBankName", "assignedPhoneNumber", "assignedRecipientName", "city", "comment", "createdAt", "currency", "customerName", "id", "orderNumber", "paymentAccountId", "paymentDueAt", "phone", "status", "stockRestored", "telegramId", "telegramUser", "totalAmount", "updatedAt") SELECT "assignedBankName", "assignedPhoneNumber", "assignedRecipientName", "city", "comment", "createdAt", "currency", "customerName", "id", "orderNumber", "paymentAccountId", "paymentDueAt", "phone", "status", "stockRestored", "telegramId", "telegramUser", "totalAmount", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "imageUrl" TEXT,
    "imagesJson" TEXT,
    "category" TEXT,
    "badge" TEXT,
    "composition" TEXT,
    "fabricDensity" TEXT,
    "modelHeight" INTEGER,
    "modelSize" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("badge", "category", "composition", "createdAt", "currency", "description", "fabricDensity", "id", "imageUrl", "imagesJson", "isActive", "modelHeight", "modelSize", "name", "price", "sku", "updatedAt") SELECT "badge", "category", "composition", "createdAt", "currency", "description", "fabricDensity", "id", "imageUrl", "imagesJson", "isActive", "modelHeight", "modelSize", "name", "price", "sku", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
