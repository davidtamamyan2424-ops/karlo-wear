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

export interface MonthlyMetrics extends PeriodMetrics {
  month: string;
  year: number;
  monthNum: number;
  day?: number;
  label?: string;
}

export interface WarehouseRow {
  id: string;
  productId: string;
  variantId: string;
  model: string;
  color: string;
  size: string;
  stock: number;
  unitCost: number;
  stockValue: number;
}

export interface ManualSale {
  id: string;
  productId: string;
  productVariantId: string;
  quantity: number;
  amount: number | null;
  comment: string | null;
  saleCategory: string;
  productName: string;
  variantName: string;
  sizeLabel: string;
  unitCostSnapshot: number;
  soldAt: string;
  saleSource: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  comment: string | null;
  createdAt: string;
}

export interface FinanceOverview {
  period: PeriodMetrics;
  businessBalance: number;
  startingBalance: number;
}

export interface FinanceSettings {
  startingBalance: number;
  updatedAt: string;
}

export interface ModelStats {
  productId: string;
  model: string;
  units: number;
  revenue: number;
  profit: number;
}

export interface DashboardData {
  businessBalance: number;
  startingBalance: number;
  totalStockUnits: number;
  inventoryValue: number;
  period: PeriodMetrics;
  monthly: MonthlyMetrics[];
  inventoryByProduct: { productId: string; model: string; units: number; value: number }[];
}

export type FinanceSource =
  | "WEBSITE_ORDER"
  | "MANUAL_SALE"
  | "REFUND"
  | "ADJUSTMENT"
  | "EXPENSE"
  | "OTHER";

export type FinanceSourceFilter =
  | "ALL"
  | "WEBSITE_ORDER"
  | "MANUAL_SALE"
  | "REFUND"
  | "ADJUSTMENT"
  | "OTHER";

export interface FinanceTransaction {
  id: string;
  date: string;
  source: FinanceSource;
  sourceLabel: string;
  description: string;
  amount: number;
  operationType: "income" | "expense";
  orderNumber?: number;
  customerName?: string;
  comment?: string | null;
}

export interface FinanceHistoryResponse {
  items: FinanceTransaction[];
  total: number;
}

export interface OrderStats {
  total: number;
  awaitingPayment: number;
  paid: number;
  shipped: number;
  cancelled: number;
}

export interface AnalyticsData {
  monthly: MonthlyMetrics[];
  period: PeriodMetrics;
  rankings: {
    byUnits: ModelStats[];
    byProfit: ModelStats[];
  };
  sizeColor: {
    sizes: { name: string; units: number }[];
    colors: { name: string; units: number }[];
  };
  inventoryByProduct: { productId: string; model: string; units: number; value: number }[];
}
