import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";
import type { ExpenseCategory } from "../constants/finance.js";

export interface CreateExpenseInput {
  date: string;
  category: ExpenseCategory;
  amount: number;
  comment?: string | null;
  paymentSource: "CASH" | "CARD";
}

export async function listExpenses() {
  return prisma.expense.findMany({ orderBy: { date: "desc" } });
}

export async function createExpense(input: CreateExpenseInput) {
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw badRequest("Укажите сумму расхода");
  }

  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) throw badRequest("Некорректная дата");

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        date,
        category: input.category,
        amount: input.amount,
        comment: input.comment ?? null,
        paymentSource: input.paymentSource,
      },
    });

    const cashDelta = input.paymentSource === "CASH" ? -input.amount : 0;
    const cardDelta = input.paymentSource === "CARD" ? -input.amount : 0;

    await tx.moneyTransaction.create({
      data: {
        type: "EXPENSE",
        cashDelta,
        cardDelta,
        amount: input.amount,
        comment: input.comment ?? `Расход: ${input.category}`,
        expenseId: expense.id,
      },
    });

    return expense;
  });
}

export async function deleteExpense(id: string) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id } });
    if (!expense) return;

    await tx.moneyTransaction.deleteMany({ where: { expenseId: id } });
    await tx.expense.delete({ where: { id } });
  });
}
