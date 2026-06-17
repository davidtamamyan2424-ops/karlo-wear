import { prisma } from "../lib/prisma.js";
import {
  OWNER_SALARY_RATE,
  OWNER_SALARY_THRESHOLD,
  SALE_STATUSES,
  type SaleCategory,
} from "../constants/finance.js";
import { productUnitCost } from "./stock.js";

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

export async function getMoneyBalances() {
  const txs = await prisma.moneyTransaction.findMany({
    select: { cashDelta: true, cardDelta: true },
  });
  let cash = 0;
  let card = 0;
  for (const tx of txs) {
    cash += tx.cashDelta;
    card += tx.cardDelta;
  }
  return { cash, card, total: cash + card };
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
    product: { productionCost: number; packagingCost: number; otherUnitCost: number };
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
  freeIssues: number;
  ownerIssues: number;
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
    freeIssues: 0,
    ownerIssues: 0,
  };
}

export async function computePeriodMetrics(filter: PeriodFilter = {}): Promise<PeriodMetrics> {
  const { orders, manualSales, expenses } = await loadFinanceData();
  const m = emptyMetrics();

  for (const order of orders) {
    if (!inPeriod(order.createdAt, filter)) continue;
    m.revenue += order.totalAmount;
    m.cogs += orderCogs(order.items);
    for (const item of order.items) {
      m.soldUnits += item.quantity;
    }
  }

  for (const sale of manualSales) {
    if (!inPeriod(sale.createdAt, filter)) continue;
    if (sale.amount != null && sale.amount > 0) {
      m.revenue += sale.amount;
    }
    m.cogs += sale.unitCostSnapshot * sale.quantity;
    m.soldUnits += sale.quantity;

    const isFree = sale.amount == null || sale.amount === 0;
    if (isFree) m.freeIssues += sale.quantity;
    if (sale.saleCategory === "SELF") m.ownerIssues += sale.quantity;
  }

  for (const expense of expenses) {
    if (!inPeriod(expense.date, filter)) continue;
    m.otherExpenses += expense.amount;
  }

  m.grossProfit = m.revenue - m.cogs;
  m.netProfit = m.grossProfit - m.otherExpenses;
  m.ownerSalary = calcOwnerSalary(m.netProfit);
  m.developmentFunds = m.netProfit - m.ownerSalary;

  return m;
}

export async function computeBusinessBalance(): Promise<number> {
  const allTime = await computePeriodMetrics();
  const monthly = await computeMonthlyBreakdown();
  const totalOwnerSalary = monthly.reduce((s, row) => s + row.ownerSalary, 0);
  return allTime.revenue - allTime.cogs - allTime.otherExpenses - totalOwnerSalary;
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

export async function computeMonthlyBreakdown(months = 12) {
  const { orders, manualSales, expenses } = await loadFinanceData();
  const buckets = new Map<string, PeriodMetrics>();

  const touch = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, emptyMetrics());
    return buckets.get(key)!;
  };

  for (const order of orders) {
    const key = monthKey(order.createdAt);
    const m = touch(key);
    m.revenue += order.totalAmount;
    m.cogs += orderCogs(order.items);
    for (const item of order.items) m.soldUnits += item.quantity;
  }

  for (const sale of manualSales) {
    const key = monthKey(sale.createdAt);
    const m = touch(key);
    if (sale.amount != null && sale.amount > 0) m.revenue += sale.amount;
    m.cogs += sale.unitCostSnapshot * sale.quantity;
    m.soldUnits += sale.quantity;
    const isFree = sale.amount == null || sale.amount === 0;
    if (isFree) m.freeIssues += sale.quantity;
    if (sale.saleCategory === "SELF") m.ownerIssues += sale.quantity;
  }

  for (const expense of expenses) {
    const key = monthKey(expense.date);
    touch(key).otherExpenses += expense.amount;
  }

  const keys = [...buckets.keys()].sort().slice(-months);
  return keys.map((key) => {
    const m = buckets.get(key)!;
    m.grossProfit = m.revenue - m.cogs;
    m.netProfit = m.grossProfit - m.otherExpenses;
    m.ownerSalary = calcOwnerSalary(m.netProfit);
    m.developmentFunds = m.netProfit - m.ownerSalary;
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

export async function computeModelRankings() {
  const { orders, manualSales } = await loadFinanceData();
  const map = new Map<string, ModelStats>();

  const touch = (productId: string, model: string) => {
    if (!map.has(productId)) {
      map.set(productId, { productId, model, units: 0, revenue: 0, profit: 0 });
    }
    return map.get(productId)!;
  };

  for (const order of orders) {
    for (const item of order.items) {
      const s = touch(item.productId, item.productName);
      const cost = productUnitCost(item.product) * item.quantity;
      s.units += item.quantity;
      s.revenue += item.unitPrice * item.quantity;
      s.profit += item.unitPrice * item.quantity - cost;
    }
  }

  for (const sale of manualSales) {
    const s = touch(sale.productId, sale.productName);
    const revenue = sale.amount ?? 0;
    const cost = sale.unitCostSnapshot * sale.quantity;
    s.units += sale.quantity;
    s.revenue += revenue;
    s.profit += revenue - cost;
  }

  const all = [...map.values()];
  const byUnits = [...all].sort((a, b) => b.units - a.units).slice(0, 10);
  const byRevenue = [...all].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const byProfit = [...all].sort((a, b) => b.profit - a.profit).slice(0, 10);

  return { byUnits, byRevenue, byProfit };
}

export async function computeSizeAndColorRankings() {
  const { orders, manualSales } = await loadFinanceData();
  const sizes = new Map<string, number>();
  const colors = new Map<string, number>();

  const add = (map: Map<string, number>, key: string, qty: number) => {
    map.set(key, (map.get(key) ?? 0) + qty);
  };

  for (const order of orders) {
    for (const item of order.items) {
      if (item.sizeLabel) add(sizes, item.sizeLabel, item.quantity);
      if (item.variantName) add(colors, item.variantName, item.quantity);
    }
  }

  for (const sale of manualSales) {
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

export async function getDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [balances, inventory, monthMetrics, businessBalance, monthly] = await Promise.all([
    getMoneyBalances(),
    computeInventoryValue(),
    computePeriodMetrics({ from: monthStart, to: monthEnd }),
    computeBusinessBalance(),
    computeMonthlyBreakdown(6),
  ]);

  return {
    businessBalance,
    cash: balances.cash,
    card: balances.card,
    totalStockUnits: inventory.totalUnits,
    inventoryValue: inventory.totalValue,
    month: monthMetrics,
    monthly,
    inventoryByProduct: inventory.items,
  };
}

export async function getAnalytics() {
  const [monthly, rankings, sizeColor, inventory] = await Promise.all([
    computeMonthlyBreakdown(12),
    computeModelRankings(),
    computeSizeAndColorRankings(),
    computeInventoryValue(),
  ]);

  return { monthly, rankings, sizeColor, inventoryByProduct: inventory.items };
}

export function isFreeSale(category: SaleCategory, amount: number | null): boolean {
  return category === "GIFT" || category === "PROMO" || amount === 0 || amount == null;
}
