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
  defectIssues: number;
}

export interface MonthlyMetrics extends PeriodMetrics {
  month: string;
  year: number;
  monthNum: number;
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

export interface DashboardData {
  businessBalance: number;
  totalStockUnits: number;
  inventoryValue: number;
  period: PeriodMetrics;
  monthly: MonthlyMetrics[];
  inventoryByProduct: { productId: string; model: string; units: number; value: number }[];
  selectedMonth?: string;
}

export interface ModelStats {
  productId: string;
  model: string;
  units: number;
  revenue: number;
  profit: number;
}

export interface AnalyticsData {
  monthly: MonthlyMetrics[];
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
