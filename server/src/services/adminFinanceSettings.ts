import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";

const SETTINGS_ID = "default";

export interface FinanceSettingsData {
  startingBalance: number;
  updatedAt: string;
}

async function ensureSettings() {
  return prisma.financeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, startingBalance: 0 },
    update: {},
  });
}

export async function getFinanceSettings(): Promise<FinanceSettingsData> {
  const row = await ensureSettings();
  return {
    startingBalance: row.startingBalance,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getStartingBalance(): Promise<number> {
  const row = await ensureSettings();
  return row.startingBalance;
}

export async function updateFinanceSettings(input: { startingBalance: number }) {
  if (!Number.isInteger(input.startingBalance) || input.startingBalance < 0) {
    throw badRequest("Укажите корректный стартовый баланс");
  }

  const row = await prisma.financeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, startingBalance: input.startingBalance },
    update: { startingBalance: input.startingBalance },
  });

  return {
    startingBalance: row.startingBalance,
    updatedAt: row.updatedAt.toISOString(),
  };
}
