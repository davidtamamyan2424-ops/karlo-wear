import { useEffect, useState } from "react";
import { adminFetchAnalytics } from "../../api/endpoints";
import type { AnalyticsData } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import BarChart from "../../components/admin/BarChart";
import PeriodSelector from "../../components/admin/PeriodSelector";
import { MONTH_NAMES } from "../../constants/finance";

interface Props {
  token: string;
  period: string;
  onPeriodChange: (month: string) => void;
}

export default function AdminAnalytics({ token, period, onPeriodChange }: Props) {
  const t = ru.admin.crm;
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    adminFetchAnalytics(token, period).then(setData).catch(() => setData(null));
  }, [token, period]);

  if (!data) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const monthLabel = (m: { monthNum: number; year: number }) =>
    `${MONTH_NAMES[m.monthNum - 1]} ${m.year}`;

  const salesChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.soldUnits,
  }));
  const revenueChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.revenue,
  }));
  const profitChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.netProfit,
  }));
  const expenseChart = data.monthly.map((m) => ({
    label: monthLabel(m),
    value: m.otherExpenses,
  }));

  const rank = (items: { model: string; units?: number; profit?: number }[], key: "units" | "profit") =>
    items.slice(0, 5).map((i) => ({
      label: i.model,
      value: i[key] ?? 0,
    }));

  return (
    <div className="space-y-5">
      <PeriodSelector value={period} onChange={onPeriodChange} />

      <div className="grid gap-4 md:grid-cols-2">
        <ChartBlock title={t.salesChart} items={salesChart} />
        <ChartBlock title={t.revenueChart} items={revenueChart} formatValue={formatPrice} />
        <ChartBlock title={t.profitChart} items={profitChart} formatValue={formatPrice} color="#4b5563" />
        <ChartBlock title={t.expensesChart} items={expenseChart} formatValue={formatPrice} color="#9ca3af" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankBlock title={t.topByUnits} items={rank(data.rankings.byUnits, "units")} />
        <RankBlock title={t.topByProfit} items={rank(data.rankings.byProfit, "profit")} formatValue={formatPrice} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankBlock title={t.topSizes} items={data.sizeColor.sizes.slice(0, 8).map((s) => ({ label: s.name, value: s.units }))} />
        <RankBlock title={t.topColors} items={data.sizeColor.colors.slice(0, 8).map((c) => ({ label: c.name, value: c.units }))} />
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">{t.stockByModel}</h3>
        {data.inventoryByProduct.map((item) => (
          <div key={item.productId} className="flex justify-between border-b border-black/5 py-2 text-sm last:border-0">
            <span>{item.model}</span>
            <span className="text-tg-hint">
              {item.units} шт. · {formatPrice(item.value)}
            </span>
          </div>
        ))}
      </div>
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

function RankBlock({
  title,
  items,
  formatValue,
}: {
  title: string;
  items: { label: string; value: number }[];
  formatValue?: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <BarChart items={items} formatValue={formatValue} />
    </div>
  );
}
