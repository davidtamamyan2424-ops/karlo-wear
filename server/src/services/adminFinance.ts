import { prisma } from "../lib/prisma.js";
import {
  OWNER_SALARY_RATE,
  OWNER_SALARY_THRESHOLD,
  SALE_STATUSES,
  type SaleCategory,
} from "../constants/finance.js";
import { parseMonthQuery } from "../lib/period.js";
import { productUnitCost } from "./stock.js";
import { getStartingBalance } from "./adminFinanceSettings.js";

export interface PeriodFilter {
  from?: Date;
  to?: Date;
}

function inPeriod(date: Date, filter: PeriodFilter): boolean {
  if (filter.from && date < filter.from) return false;
  if (filter.to && date > filter.to) return false;
  return true;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function calcOwnerSalary(netProfitKopecks: number): number {
  if (netProfitKopecks < OWNER_SALARY_THRESHOLD) return 0;
  return Math.round(netProfitKopecks * OWNER_SALARY_RATE);
}

export async function getWarehouseStock() {
  const rows = await prisma.productVariantSize.findMany({
    where: { variant: { product: { archived: false } } },
    include: {
      variant: { include: { product: true } },
    },
    orderBy: [
      { variant: { product: { position: "asc" } } },
      { variant: { position: "asc" } },
      { label: "asc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    productId: row.variant.productId,
    variantId: row.variantId,
    model: row.variant.product.name,
    color: row.variant.name,
    size: row.label,
    stock: row.stock,
    unitCost: productUnitCost(row.variant.product),
    stockValue: row.stock * productUnitCost(row.variant.product),
  }));
}

async function loadFinanceData() {
  const [orders, manualSales, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...SALE_STATUSES] } },
      include: { items: { include: { product: true } } },
    }),
    prisma.manualSale.findMany(),
    prisma.expense.findMany(),
  ]);
  return { orders, manualSales, expenses };
}

function orderCogs(
  items: {
    quantity: number;
    product: { unitCost: number };
  }[],
): number {
  return items.reduce(
    (sum, item) => sum + item.quantity * productUnitCost(item.product),
    0,
  );
}

export interface PeriodMetrics {
  revenue: number;
  cogs: number;
  otherExpenses: number;
  grossProfit: number;
  netProfit: number;
  ownerSalary: number;
  developmentFunds: number;
  soldUnits: number;
  orderCount: number;
  averageOrderValue: number;
  freeIssues: number;
  ownerIssues: number;
  defectIssues: number;
}

export function emptyMetrics(): PeriodMetrics {
  return {
    revenue: 0,
    cogs: 0,
    otherExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    ownerSalary: 0,
    developmentFunds: 0,
    soldUnits: 0,
    orderCount: 0,
    averageOrderValue: 0,
    freeIssues: 0,
    ownerIssues: 0,
    defectIssues: 0,
  };
}

function applyManualSaleMetrics(
  m: PeriodMetrics,
  sale: {
    quantity: number;
    amount: number | null;
    saleCategory: string;
    unitCostSnapshot: number;
  },
) {
  if (sale.amount != null && sale.amount > 0) {
    m.revenue += sale.amount;
  }
  m.cogs += sale.unitCostSnapshot * sale.quantity;
  m.soldUnits += sale.quantity;

  if (sale.saleCategory === "GIFT") {
    m.freeIssues += sale.quantity;
  } else if (sale.saleCategory === "SELF") {
    m.ownerIssues += sale.quantity;
  } else if (sale.saleCategory === "DEFECT") {
    m.defectIssues += sale.quantity;
  } else if (sale.amount == null || sale.amount === 0) {
    m.freeIssues += sale.quantity;
  }
}

function finalizeMetrics(m: PeriodMetrics, orderRevenue = 0): PeriodMetrics {
  m.grossProfit = m.revenue - m.cogs;
  m.netProfit = m.grossProfit - m.otherExpenses;
  m.ownerSalary = calcOwnerSalary(m.netProfit);
  m.developmentFunds = m.netProfit - m.ownerSalary;
  m.averageOrderValue =
    m.orderCount > 0 ? Math.round(orderRevenue / m.orderCount) : 0;
  return m;
}

export async function computePeriodMetrics(filter: PeriodFilter = {}): Promise<PeriodMetrics> {
  const { orders, manualSales, expenses } = await loadFinanceData();
  const m = emptyMetrics();
  let orderRevenue = 0;

  for (const order of orders) {
    if (!inPeriod(order.createdAt, filter)) continue;
    m.orderCount += 1;
    orderRevenue += order.totalAmount;
    m.revenue += order.totalAmount;
    m.cogs += orderCogs(order.items);
    for (const item of order.items) {
      m.soldUnits += item.quantity;
    }
  }

  for (const sale of manualSales) {
    if (!inPeriod(sale.createdAt, filter)) continue;
    applyManualSaleMetrics(m, sale);
  }

  for (const expense of expenses) {
    if (!inPeriod(expense.date, filter)) continue;
    m.otherExpenses += expense.amount;
  }

  return finalizeMetrics(m, orderRevenue);
}

/** Текущий баланс: стартовый + продажи − прочие расходы − зарплата владельца (по месяцам). */
export function calcBusinessBalance(
  startingBalance: number,
  monthly: Pick<PeriodMetrics, "revenue" | "otherExpenses" | "ownerSalary">[],
): number {
  const flow = monthly.reduce(
    (sum, row) => sum + row.revenue - row.otherExpenses - row.ownerSalary,
    0,
  );
  return startingBalance + flow;
}

export async function computeBusinessBalance(): Promise<number> {
  const [startingBalance, monthly] = await Promise.all([
    getStartingBalance(),
    computeMonthlyBreakdown(120),
  ]);
  return calcBusinessBalance(startingBalance, monthly);
}

export async function computeInventoryValue() {
  const stock = await getWarehouseStock();
  const byProduct = new Map<string, { model: string; units: number; value: number }>();

  for (const row of stock) {
    const cur = byProduct.get(row.productId) ?? { model: row.model, units: 0, value: 0 };
    cur.units += row.stock;
    cur.value += row.stockValue;
    byProduct.set(row.productId, cur);
  }

  const items = [...byProduct.entries()].map(([productId, data]) => ({
    productId,
    model: data.model,
    units: data.units,
    value: data.value,
  }));

  return {
    items,
    totalUnits: items.reduce((s, i) => s + i.units, 0),
    totalValue: items.reduce((s, i) => s + i.value, 0),
    stock,
  };
}

export async function computeMonthlyBreakdown(months = 12, endAt?: Date) {
  const { orders, manualSales, expenses } = await loadFinanceData();
  const buckets = new Map<string, PeriodMetrics>();
  const orderRevenueByMonth = new Map<string, number>();

  const touch = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, emptyMetrics());
    return buckets.get(key)!;
  };

  for (const order of orders) {
    const key = monthKey(order.createdAt);
    const m = touch(key);
    m.orderCount += 1;
    orderRevenueByMonth.set(key, (orderRevenueByMonth.get(key) ?? 0) + order.totalAmount);
    m.revenue += order.totalAmount;
    m.cogs += orderCogs(order.items);
    for (const item of order.items) m.soldUnits += item.quantity;
  }

  for (const sale of manualSales) {
    const key = monthKey(sale.createdAt);
    applyManualSaleMetrics(touch(key), sale);
  }

  for (const expense of expenses) {
    const key = monthKey(expense.date);
    touch(key).otherExpenses += expense.amount;
  }

  const end = endAt ?? new Date();
  const endKey = monthKey(end);
  const allKeys = [...buckets.keys()].sort();
  const endIdx = allKeys.findIndex((k) => k === endKey);
  const sliceEnd = endIdx >= 0 ? endIdx + 1 : allKeys.length;
  const keys = allKeys.slice(Math.max(0, sliceEnd - months), sliceEnd);

  return keys.map((key) => {
    const m = finalizeMetrics({ ...buckets.get(key)! }, orderRevenueByMonth.get(key) ?? 0);
    const [year, month] = key.split("-");
    return { month: key, year: Number(year), monthNum: Number(month), ...m };
  });
}

export interface ModelStats {
  productId: string;
  model: string;
  units: number;
  revenue: number;
  profit: number;
}

export async function computeModelRankings(filter: PeriodFilter = {}) {
  const { orders, manualSales } = await loadFinanceData();
  const map = new Map<string, ModelStats>();

  const touch = (productId: string, model: string) => {
    if (!map.has(productId)) {
      map.set(productId, { productId, model, units: 0, revenue: 0, profit: 0 });
    }
    return map.get(productId)!;
  };

  for (const order of orders) {
    if (!inPeriod(order.createdAt, filter)) continue;
    for (const item of order.items) {
      const s = touch(item.productId, item.productName);
      const cost = productUnitCost(item.product) * item.quantity;
      s.units += item.quantity;
      s.revenue += item.unitPrice * item.quantity;
      s.profit += item.unitPrice * item.quantity - cost;
    }
  }

  for (const sale of manualSales) {
    if (!inPeriod(sale.createdAt, filter)) continue;
    const s = touch(sale.productId, sale.productName);
    const revenue = sale.amount ?? 0;
    const cost = sale.unitCostSnapshot * sale.quantity;
    s.units += sale.quantity;
    s.revenue += revenue;
    s.profit += revenue - cost;
  }

  const all = [...map.values()];
  const byUnits = [...all].sort((a, b) => b.units - a.units).slice(0, 10);
  const byProfit = [...all].sort((a, b) => b.profit - a.profit).slice(0, 10);

  return { byUnits, byProfit };
}

export async function computeSizeAndColorRankings(filter: PeriodFilter = {}) {
  const { orders, manualSales } = await loadFinanceData();
  const sizes = new Map<string, number>();
  const colors = new Map<string, number>();

  const add = (map: Map<string, number>, key: string, qty: number) => {
    map.set(key, (map.get(key) ?? 0) + qty);
  };

  for (const order of orders) {
    if (!inPeriod(order.createdAt, filter)) continue;
    for (const item of order.items) {
      if (item.sizeLabel) add(sizes, item.sizeLabel, item.quantity);
      if (item.variantName) add(colors, item.variantName, item.quantity);
    }
  }

  for (const sale of manualSales) {
    if (!inPeriod(sale.createdAt, filter)) continue;
    add(sizes, sale.sizeLabel, sale.quantity);
    add(colors, sale.variantName, sale.quantity);
  }

  const sortMap = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([name, units]) => ({ name, units }))
      .sort((a, b) => b.units - a.units);

  return {
    sizes: sortMap(sizes),
    colors: sortMap(colors),
  };
}

export async function getFinanceOverview(month?: string) {
  const period = parseMonthQuery(month);
  const [periodMetrics, businessBalance, startingBalance] = await Promise.all([
    computePeriodMetrics(period),
    computeBusinessBalance(),
    getStartingBalance(),
  ]);

  return {
    period: periodMetrics,
    businessBalance,
    startingBalance,
  };
}

export async function getDashboard(month?: string) {
  const period = parseMonthQuery(month);
  const endAt = period.to ?? new Date();

  const [inventory, periodMetrics, businessBalance, startingBalance, monthly] = await Promise.all([
    computeInventoryValue(),
    computePeriodMetrics(period),
    computeBusinessBalance(),
    getStartingBalance(),
    computeMonthlyBreakdown(6, endAt),
  ]);

  return {
    businessBalance,
    startingBalance,
    totalStockUnits: inventory.totalUnits,
    inventoryValue: inventory.totalValue,
    period: periodMetrics,
    monthly,
    inventoryByProduct: inventory.items,
    selectedMonth: month ?? undefined,
  };
}

export async function getAnalytics(month?: string) {
  const period = parseMonthQuery(month);
  const endAt = period.to ?? new Date();

  const [monthly, rankings, sizeColor, inventory] = await Promise.all([
    computeMonthlyBreakdown(12, endAt),
    computeModelRankings(period),
    computeSizeAndColorRankings(period),
    computeInventoryValue(),
  ]);

  return { monthly, rankings, sizeColor, inventoryByProduct: inventory.items };
}

export function isFreeSale(category: SaleCategory, amount: number | null): boolean {
  return category === "GIFT" || amount === 0 || amount == null;
}
