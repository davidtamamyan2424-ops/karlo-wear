import { useEffect, useState } from "react";
import { adminFetchFinanceSummary } from "../../api/endpoints";
import type { PeriodMetrics } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import MetricCard from "../../components/admin/MetricCard";
import PeriodSelector from "../../components/admin/PeriodSelector";

interface Props {
  token: string;
  period: string;
  onPeriodChange: (month: string) => void;
}

export default function AdminFinance({ token, period, onPeriodChange }: Props) {
  const t = ru.admin.crm;
  const [summary, setSummary] = useState<PeriodMetrics | null>(null);

  useEffect(() => {
    void adminFetchFinanceSummary(token, period).then(setSummary);
  }, [token, period]);

  if (!summary) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  return (
    <div className="space-y-5">
      <PeriodSelector value={period} onChange={onPeriodChange} />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.revenue} value={formatPrice(summary.revenue)} />
        <MetricCard label={t.cogs} value={formatPrice(summary.cogs)} />
        <MetricCard label={t.otherExpenses} value={formatPrice(summary.otherExpenses)} />
        <MetricCard label={t.grossProfit} value={formatPrice(summary.grossProfit)} />
        <MetricCard label={t.netProfit} value={formatPrice(summary.netProfit)} />
        <MetricCard label={t.soldUnits} value={String(summary.soldUnits)} />
        <MetricCard label={t.freeIssues} value={String(summary.freeIssues)} />
        <MetricCard label={t.ownerIssues} value={String(summary.ownerIssues)} />
        <MetricCard label={t.defectIssues} value={String(summary.defectIssues)} />
        <MetricCard label={t.ownerSalary} value={formatPrice(summary.ownerSalary)} />
        <MetricCard label={t.developmentFunds} value={formatPrice(summary.developmentFunds)} />
      </div>
    </div>
  );
}
