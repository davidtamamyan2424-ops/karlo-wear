import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";
import type { MoneyTxType } from "../constants/finance.js";
import { getMoneyBalances } from "./adminFinance.js";

export interface MoneyOperationInput {
  type: MoneyTxType;
  amount: number;
  comment?: string | null;
}

function deltasForType(type: MoneyTxType, amount: number): { cashDelta: number; cardDelta: number } {
  switch (type) {
    case "CASH_IN":
      return { cashDelta: amount, cardDelta: 0 };
    case "CASH_OUT":
      return { cashDelta: -amount, cardDelta: 0 };
    case "CARD_IN":
      return { cashDelta: 0, cardDelta: amount };
    case "CARD_OUT":
      return { cashDelta: 0, cardDelta: -amount };
    case "TRANSFER_TO_CARD":
      return { cashDelta: -amount, cardDelta: amount };
    case "TRANSFER_TO_CASH":
      return { cashDelta: amount, cardDelta: -amount };
    default:
      return { cashDelta: 0, cardDelta: 0 };
  }
}

const MANUAL_TYPES: MoneyTxType[] = [
  "CASH_IN",
  "CASH_OUT",
  "CARD_IN",
  "CARD_OUT",
  "TRANSFER_TO_CARD",
  "TRANSFER_TO_CASH",
];

export async function listMoneyTransactions(limit = 50) {
  return prisma.moneyTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createMoneyOperation(input: MoneyOperationInput) {
  if (!MANUAL_TYPES.includes(input.type)) {
    throw badRequest("Недопустимый тип операции");
  }
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw badRequest("Укажите сумму");
  }

  const { cashDelta, cardDelta } = deltasForType(input.type, input.amount);
  const balances = await getMoneyBalances();
  const nextCash = balances.cash + cashDelta;
  const nextCard = balances.card + cardDelta;

  if (nextCash < 0 || nextCard < 0) {
    throw badRequest("Недостаточно средств для операции");
  }

  return prisma.moneyTransaction.create({
    data: {
      type: input.type,
      cashDelta,
      cardDelta,
      amount: input.amount,
      comment: input.comment ?? null,
    },
  });
}
