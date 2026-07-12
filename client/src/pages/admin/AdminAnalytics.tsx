import { useEffect, useState } from "react";
import { adminFetchAnalytics } from "../../api/endpoints";
import type { AnalyticsData } from "../../types/crm";
import type { PeriodState } from "../../lib/period";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import BarChart from "../../components/admin/BarChart";
import DateRangeSelector from "../../components/admin/DateRangeSelector";
import MetricCard from "../../components/admin/MetricCard";
import { MONTH_NAMES } from "../../constants/finance";

interface Props {
  token: string;
  period: PeriodState;
  onPeriodChange: (period: PeriodState) => void;
}

function bucketLabel(m: AnalyticsData["monthly"][number]): string {
  if (m.label) return m.label;
  return `${MONTH_NAMES[m.monthNum - 1]} ${m.year}`;
}

export default function AdminAnalytics({ token, period, onPeriodChange }: Props) {
  const t = ru.admin.crm;
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    adminFetchAnalytics(token, period).then(setData).catch(() => setData(null));
  }, [token, period]);

  if (!data) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const aovChart = data.monthly.map((m) => ({
    label: bucketLabel(m),
    value: m.averageOrderValue,
  }));
  const revenueChart = data.monthly.map((m) => ({
    label: bucketLabel(m),
    value: m.revenue,
  }));
  const profitChart = data.monthly.map((m) => ({
    label: bucketLabel(m),
    value: m.netProfit,
  }));
  const ordersChart = data.monthly.map((m) => ({
    label: bucketLabel(m),
    value: m.orderCount,
  }));

  const rank = (items: { model: string; units?: number; profit?: number }[], key: "units" | "profit") =>
    items.slice(0, 5).map((i) => ({
      label: i.model,
      value: i[key] ?? 0,
    }));

  return (
    <div className="space-y-5">
      <DateRangeSelector value={period} onChange={onPeriodChange} />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.orderCount} value={String(data.period.orderCount)} />
        <MetricCard label={t.averageOrderValue} value={formatPrice(data.period.averageOrderValue)} />
        <MetricCard label={t.soldUnits} value={String(data.period.soldUnits)} />
        <MetricCard label={t.revenue} value={formatPrice(data.period.revenue)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartBlock title={t.aovChart} items={aovChart} formatValue={formatPrice} />
        <ChartBlock title={t.revenueChart} items={revenueChart} formatValue={formatPrice} />
        <ChartBlock title={t.profitChart} items={profitChart} formatValue={formatPrice} color="#4b5563" />
        <ChartBlock title={t.ordersChart} items={ordersChart} color="#6b7280" />
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
