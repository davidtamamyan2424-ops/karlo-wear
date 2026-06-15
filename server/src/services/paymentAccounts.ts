import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

export interface PaymentAccountInput {
  bankName: string;
  recipientName: string;
  phoneNumber: string;
  isActive?: boolean;
}

export async function listPaymentAccounts() {
  return prisma.paymentAccount.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createPaymentAccount(input: PaymentAccountInput) {
  return prisma.paymentAccount.create({
    data: {
      bankName: input.bankName,
      recipientName: input.recipientName,
      phoneNumber: input.phoneNumber,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePaymentAccount(
  id: string,
  input: Partial<PaymentAccountInput>,
) {
  const existing = await prisma.paymentAccount.findUnique({ where: { id } });
  if (!existing) throw notFound("Реквизиты не найдены");

  return prisma.paymentAccount.update({
    where: { id },
    data: {
      bankName: input.bankName ?? undefined,
      recipientName: input.recipientName ?? undefined,
      phoneNumber: input.phoneNumber ?? undefined,
      isActive: input.isActive ?? undefined,
    },
  });
}
