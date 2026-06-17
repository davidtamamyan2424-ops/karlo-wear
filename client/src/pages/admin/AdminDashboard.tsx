import { useEffect, useState } from "react";
import { adminFetchDashboard } from "../../api/endpoints";
import type { DashboardData } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import MetricCard from "../../components/admin/MetricCard";
import BarChart from "../../components/admin/BarChart";
import { MONTH_NAMES } from "../../constants/finance";

interface Props {
  token: string;
}

export default function AdminDashboard({ token }: Props) {
  const t = ru.admin.crm;
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetchDashboard(token)
      .then(setData)
      .catch(() => setError(ru.common.error));
  }, [token]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const chartItems = data.monthly.map((m) => ({
    label: `${MONTH_NAMES[m.monthNum - 1]} ${m.year}`,
    value: m.revenue,
  }));

  const profitChart = data.monthly.map((m) => ({
    label: `${MONTH_NAMES[m.monthNum - 1]} ${m.year}`,
    value: m.netProfit,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.businessBalance} value={formatPrice(data.businessBalance)} large />
        <MetricCard label={t.moneyInGoods} value={formatPrice(data.inventoryValue)} large />
        <MetricCard label={t.cash} value={formatPrice(data.cash)} />
        <MetricCard label={t.card} value={formatPrice(data.card)} />
        <MetricCard label={t.totalStock} value={String(data.totalStockUnits)} />
        <MetricCard label={t.monthRevenue} value={formatPrice(data.month.revenue)} />
        <MetricCard label={t.monthNetProfit} value={formatPrice(data.month.netProfit)} />
        <MetricCard label={t.monthExpenses} value={formatPrice(data.month.otherExpenses)} />
        <MetricCard label={t.ownerSalary} value={formatPrice(data.month.ownerSalary)} />
        <MetricCard label={t.developmentFunds} value={formatPrice(data.month.developmentFunds)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.revenueChart}</h3>
          <BarChart items={chartItems} formatValue={formatPrice} />
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.profitChart}</h3>
          <BarChart items={profitChart} formatValue={formatPrice} color="#4b5563" />
        </div>
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
