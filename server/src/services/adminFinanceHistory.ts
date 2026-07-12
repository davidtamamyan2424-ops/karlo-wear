import { prisma } from "../lib/prisma.js";
import { SALE_STATUSES } from "../constants/finance.js";
import type { PeriodFilter } from "./adminFinance.js";

export type FinanceSource =
  | "WEBSITE_ORDER"
  | "MANUAL_SALE"
  | "REFUND"
  | "ADJUSTMENT"
  | "EXPENSE"
  | "OTHER";

export type FinanceOperationType = "income" | "expense";

export const FINANCE_SOURCE_LABELS: Record<FinanceSource, string> = {
  WEBSITE_ORDER: "Заказ с сайта",
  MANUAL_SALE: "Ручная продажа",
  REFUND: "Возврат",
  ADJUSTMENT: "Корректировка",
  EXPENSE: "Расход",
  OTHER: "Другое",
};

export interface FinanceTransaction {
  id: string;
  date: string;
  source: FinanceSource;
  sourceLabel: string;
  description: string;
  amount: number;
  operationType: FinanceOperationType;
  orderNumber?: number;
  customerName?: string;
  comment?: string | null;
}

export type FinanceSourceFilter =
  | "ALL"
  | "WEBSITE_ORDER"
  | "MANUAL_SALE"
  | "REFUND"
  | "ADJUSTMENT"
  | "OTHER";

export interface FinanceHistoryQuery {
  period: PeriodFilter;
  source?: FinanceSourceFilter;
  sort?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

function inPeriod(date: Date, filter: PeriodFilter): boolean {
  if (filter.from && date < filter.from) return false;
  if (filter.to && date > filter.to) return false;
  return true;
}

function formatDateRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function manualSaleSource(sale: {
  saleCategory: string;
  amount: number | null;
}): FinanceSource {
  if (sale.saleCategory === "GIFT" || sale.saleCategory === "SELF" || sale.saleCategory === "DEFECT") {
    return "ADJUSTMENT";
  }
  if (sale.amount != null && sale.amount > 0) return "MANUAL_SALE";
  return "ADJUSTMENT";
}

async function buildAllTransactions(period: PeriodFilter): Promise<FinanceTransaction[]> {
  const [orders, manualSales, expenses] = await Promise.all([
    prisma.order.findMany({
      include: { items: true, paymentProofs: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.manualSale.findMany({ orderBy: { soldAt: "desc" } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
  ]);

  const items: FinanceTransaction[] = [];

  for (const order of orders) {
    if ((SALE_STATUSES as readonly string[]).includes(order.status)) {
      if (!inPeriod(order.createdAt, period)) continue;
      items.push({
        id: `order-${order.id}`,
        date: order.createdAt.toISOString(),
        source: "WEBSITE_ORDER",
        sourceLabel: FINANCE_SOURCE_LABELS.WEBSITE_ORDER,
        description: `Заказ #${order.orderNumber} · ${order.customerName} · ${formatDateRu(order.createdAt)}`,
        amount: order.totalAmount,
        operationType: "income",
        orderNumber: order.orderNumber,
        customerName: order.customerName,
      });
    } else if (order.status === "CANCELLED" && order.paymentProofs.length > 0) {
      const eventDate = order.updatedAt;
      if (!inPeriod(eventDate, period)) continue;
      items.push({
        id: `refund-${order.id}`,
        date: eventDate.toISOString(),
        source: "REFUND",
        sourceLabel: FINANCE_SOURCE_LABELS.REFUND,
        description: `Возврат по заказу #${order.orderNumber}`,
        amount: -order.totalAmount,
        operationType: "expense",
        orderNumber: order.orderNumber,
        customerName: order.customerName,
      });
    }
  }

  for (const sale of manualSales) {
    if (!inPeriod(sale.soldAt, period)) continue;
    const source = manualSaleSource(sale);
    const amount = sale.amount ?? 0;
    const isIncome = source === "MANUAL_SALE" && amount > 0;
    const parts = [
      sale.productName,
      formatDateRu(sale.soldAt),
      isIncome ? `${(amount / 100).toLocaleString("ru-RU")} ₽` : null,
      sale.comment,
    ].filter(Boolean);

    items.push({
      id: `sale-${sale.id}`,
      date: sale.soldAt.toISOString(),
      source,
      sourceLabel: FINANCE_SOURCE_LABELS[source],
      description: parts.join(" · "),
      amount: isIncome ? amount : 0,
      operationType: isIncome ? "income" : "expense",
      comment: sale.comment,
    });
  }

  for (const expense of expenses) {
    if (!inPeriod(expense.date, period)) continue;
    const desc = expense.comment
      ? `${expense.category} · ${expense.comment}`
      : expense.category;
    items.push({
      id: `expense-${expense.id}`,
      date: expense.date.toISOString(),
      source: "EXPENSE",
      sourceLabel: FINANCE_SOURCE_LABELS.EXPENSE,
      description: desc,
      amount: -expense.amount,
      operationType: "expense",
      comment: expense.comment,
    });
  }

  return items;
}

function mapSourceFilter(filter: FinanceSourceFilter): FinanceSource[] | null {
  if (filter === "ALL") return null;
  if (filter === "OTHER") return ["OTHER", "EXPENSE"];
  return [filter];
}

export async function getFinanceHistory(query: FinanceHistoryQuery) {
  const {
    period,
    source = "ALL",
    sort = "desc",
    limit = 100,
    offset = 0,
  } = query;

  let items = await buildAllTransactions(period);

  const sources = mapSourceFilter(source);
  if (sources) {
    items = items.filter((t) => sources.includes(t.source));
  }

  items.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return sort === "asc" ? diff : -diff;
  });

  const total = items.length;
  const page = items.slice(offset, offset + limit);

  return { items: page, total };
}
