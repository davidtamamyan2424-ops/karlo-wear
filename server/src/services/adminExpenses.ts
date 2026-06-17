import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/errors.js";
import type { ExpenseCategory } from "../constants/finance.js";

export interface CreateExpenseInput {
  date: string;
  category: ExpenseCategory;
  amount: number;
  comment?: string | null;
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

  return prisma.expense.create({
    data: {
      date,
      category: input.category,
      amount: input.amount,
      comment: input.comment ?? null,
    },
  });
}

export async function deleteExpense(id: string) {
  await prisma.expense.deleteMany({ where: { id } });
}
