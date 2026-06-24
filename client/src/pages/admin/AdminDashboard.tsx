import { useEffect, useState } from "react";
import { adminFetchDashboard } from "../../api/endpoints";
import type { DashboardData } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import MetricCard from "../../components/admin/MetricCard";
import BarChart from "../../components/admin/BarChart";
import PeriodSelector from "../../components/admin/PeriodSelector";
import { MONTH_NAMES } from "../../constants/finance";

interface Props {
  token: string;
  period: string;
  onPeriodChange: (month: string) => void;
}

export default function AdminDashboard({ token, period, onPeriodChange }: Props) {
  const t = ru.admin.crm;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetchDashboard(token, period)
      .then(setData)
      .catch(() => setError(ru.common.error));
  }, [token, period]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const monthLabel = (m: { monthNum: number; year: number }) =>
    `${MONTH_NAMES[m.monthNum - 1]} ${m.year}`;

  const revenueChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.revenue,
  }));
  const profitChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.netProfit,
  }));
  const ordersChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.orderCount,
  }));
  const aovChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.averageOrderValue,
  }));

  return (
    <div className="space-y-5">
      <PeriodSelector value={period} onChange={onPeriodChange} />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.businessBalance} value={formatPrice(data.businessBalance)} large />
        <MetricCard label={t.moneyInGoods} value={formatPrice(data.inventoryValue)} large />
        <MetricCard label={t.monthRevenue} value={formatPrice(data.period.revenue)} />
        <MetricCard label={t.monthNetProfit} value={formatPrice(data.period.netProfit)} />
        <MetricCard label={t.monthExpenses} value={formatPrice(data.period.otherExpenses)} />
        <MetricCard label={t.ownerSalary} value={formatPrice(data.period.ownerSalary)} />
        <MetricCard label={t.developmentFunds} value={formatPrice(data.period.developmentFunds)} />
        <MetricCard label={t.averageOrderValue} value={formatPrice(data.period.averageOrderValue)} />
        <MetricCard label={t.orderCount} value={String(data.period.orderCount)} />
        <MetricCard label={t.totalStock} value={`${data.totalStockUnits} шт.`} />
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4 text-sm">
        <p>
          {t.inventoryTotal}: <strong>{data.totalStockUnits} шт.</strong>
        </p>
        <p className="text-tg-hint">
          {t.inventoryCost}: {formatPrice(data.inventoryValue)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartBlock title={t.revenueChart} items={revenueChart} formatValue={formatPrice} />
        <ChartBlock title={t.profitChart} items={profitChart} formatValue={formatPrice} color="#4b5563" />
        <ChartBlock title={t.ordersChart} items={ordersChart} color="#6b7280" />
        <ChartBlock title={t.aovChart} items={aovChart} formatValue={formatPrice} color="#9ca3af" />
      </div>

      {data.inventoryByProduct.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.stockByModel}</h3>
          <div className="space-y-2">
            {data.inventoryByProduct.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span>{item.model}</span>
                <span className="text-tg-hint">
                  {item.units} шт. · {formatPrice(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartBlock({
  title,
  items,
  formatValue,
  color,
}: {
  title: string;
  items: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <BarChart items={items} formatValue={formatValue} color={color} />
    </div>
  );
}
