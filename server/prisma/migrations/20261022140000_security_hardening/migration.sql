BEGIN;
ALTER TABLE "Order" ADD COLUMN "accessTokenHash" TEXT,
 ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestHash" TEXT,
 ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "paidAtEstimated" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "refundedAt" TIMESTAMP(3),
 ADD COLUMN "refundAmount" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "legalConsentAt" TIMESTAMP(3), ADD COLUMN "legalConsentVersion" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX "Order_status_paymentDueAt_idx" ON "Order"("status", "paymentDueAt");
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_phone_status_idx" ON "Order"("phone", "status");
ALTER TABLE "OrderItem" ADD COLUMN "unitCostSnapshot" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "costEstimated" BOOLEAN NOT NULL DEFAULT false;
-- Historical cost and payment dates cannot be reconstructed precisely. Mark estimates.
UPDATE "OrderItem" i SET "unitCostSnapshot" = p."unitCost", "costEstimated" = true
 FROM "Product" p WHERE p.id = i."productId";
UPDATE "Order" SET "paidAt" = "createdAt", "paidAtEstimated" = true
 WHERE status IN ('PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED');
-- Database-owned sequence: safe across simultaneous checkouts.
CREATE SEQUENCE "order_number_seq";
SELECT setval('order_number_seq', GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "Order"), 1000), 1000));
CREATE INDEX "ManualSale_soldAt_idx" ON "ManualSale"("soldAt");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE TABLE "AdminSession" (id TEXT PRIMARY KEY, data TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE TABLE "AuditEvent" (id TEXT PRIMARY KEY, action TEXT NOT NULL, "entityId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE TABLE "NotificationJob" (id TEXT PRIMARY KEY, type TEXT NOT NULL, "orderId" TEXT NOT NULL, "receiptId" TEXT, attempts INTEGER NOT NULL DEFAULT 0, "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "NotificationJob_runAt_attempts_idx" ON "NotificationJob"("runAt", attempts);
COMMIT;
