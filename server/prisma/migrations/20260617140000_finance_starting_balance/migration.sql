-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL,
    "startingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinanceSettings" ("id", "startingBalance", "updatedAt")
VALUES ('default', 0, CURRENT_TIMESTAMP);
