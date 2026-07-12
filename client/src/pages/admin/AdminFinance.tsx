import { useCallback, useEffect, useState } from "react";
import { adminFetchFinanceHistory, adminFetchFinanceSummary } from "../../api/endpoints";
import type { FinanceOverview, FinanceSourceFilter, FinanceTransaction } from "../../types/crm";
import type { PeriodState } from "../../lib/period";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import MetricCard from "../../components/admin/MetricCard";
import DateRangeSelector from "../../components/admin/DateRangeSelector";

const PAGE_SIZE = 50;

const SOURCE_FILTERS: { value: FinanceSourceFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "WEBSITE_ORDER", label: "Заказы с сайта" },
  { value: "MANUAL_SALE", label: "Ручные продажи" },
  { value: "REFUND", label: "Возвраты" },
  { value: "ADJUSTMENT", label: "Корректировки" },
  { value: "OTHER", label: "Другое" },
];

interface Props {
  token: string;
  period: PeriodState;
  onPeriodChange: (period: PeriodState) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function TransactionDetails({ tx }: { tx: FinanceTransaction }) {
  if (tx.source === "WEBSITE_ORDER") {
    return (
      <div className="mt-1 text-xs text-tg-hint">
        {tx.orderNumber != null && <p>№ заказа: {tx.orderNumber}</p>}
        {tx.customerName && <p>Покупатель: {tx.customerName}</p>}
        <p>Дата: {formatDate(tx.date)}</p>
        <p>Сумма оплаты: {formatPrice(Math.abs(tx.amount))}</p>
      </div>
    );
  }
  if (tx.source === "MANUAL_SALE") {
    return (
      <div className="mt-1 text-xs text-tg-hint">
        <p>Дата: {formatDate(tx.date)}</p>
        <p>Сумма: {formatPrice(Math.abs(tx.amount))}</p>
        {tx.comment && <p>Комментарий: {tx.comment}</p>}
      </div>
    );
  }
  return null;
}

export default function AdminFinance({ token, period, onPeriodChange }: Props) {
  const t = ru.admin.crm;
  const [summary, setSummary] = useState<FinanceOverview | null>(null);
  const [items, setItems] = useState<FinanceTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<FinanceSourceFilter>("ALL");
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);

  const loadHistory = useCallback(() => {
    void adminFetchFinanceHistory(token, {
      period,
      source,
      sort,
      limit: PAGE_SIZE,
      offset,
    }).then((res) => {
      setItems(res.items);
      setTotal(res.total);
    });
  }, [token, period, source, sort, offset]);

  useEffect(() => {
    void adminFetchFinanceSummary(token, period).then(setSummary);
  }, [token, period]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setOffset(0);
  }, [period, source, sort]);

  if (!summary) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const periodMetrics = summary.period;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-5">
      <DateRangeSelector value={period} onChange={onPeriodChange} />

      <MetricCard label={t.businessBalance} value={formatPrice(summary.businessBalance)} large />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.revenue} value={formatPrice(periodMetrics.revenue)} />
        <MetricCard label={t.netProfit} value={formatPrice(periodMetrics.netProfit)} />
        <MetricCard label={t.otherExpenses} value={formatPrice(periodMetrics.otherExpenses)} />
        <MetricCard label={t.ownerSalary} value={formatPrice(periodMetrics.ownerSalary)} />
        <MetricCard label={t.developmentFunds} value={formatPrice(periodMetrics.developmentFunds)} />
        <MetricCard label={t.averageOrderValue} value={formatPrice(periodMetrics.averageOrderValue)} />
        <MetricCard label={t.orderCount} value={String(periodMetrics.orderCount)} />
        <MetricCard label={t.soldUnits} value={String(periodMetrics.soldUnits)} />
      </div>

      <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
        <h3 className="text-sm font-semibold">{t.financeHistory}</h3>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-tg-hint">{t.financeSourceFilter}</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as FinanceSourceFilter)}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm"
            >
              {SOURCE_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-tg-hint">{t.financeSort}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "asc" | "desc")}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm"
            >
              <option value="desc">{t.sortNewest}</option>
              <option value="asc">{t.sortOldest}</option>
            </select>
          </label>
        </div>

        <p className="text-xs text-tg-hint">
          {t.financeTotal}: {total}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-tg-hint">
                <th className="py-2 pr-3 font-medium">{t.financeColDate}</th>
                <th className="py-2 pr-3 font-medium">{t.financeColSource}</th>
                <th className="py-2 pr-3 font-medium">{t.financeColDescription}</th>
                <th className="py-2 pr-3 font-medium">{t.financeColAmount}</th>
                <th className="py-2 font-medium">{t.financeColType}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-tg-hint">
                    {t.financeEmpty}
                  </td>
                </tr>
              )}
              {items.map((tx) => (
                <tr key={tx.id} className="border-b border-black/5 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="py-2 pr-3">{tx.sourceLabel}</td>
                  <td className="py-2 pr-3">
                    <p>{tx.description}</p>
                    <TransactionDetails tx={tx} />
                  </td>
                  <td
                    className={[
                      "py-2 pr-3 whitespace-nowrap font-medium",
                      tx.amount < 0 ? "text-red-600" : "text-green-700",
                    ].join(" ")}
                  >
                    {tx.amount < 0 ? "−" : "+"}
                    {formatPrice(Math.abs(tx.amount))}
                  </td>
                  <td className="py-2">
                    {tx.operationType === "income" ? t.operationIncome : t.operationExpense}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t.prevPage}
            </button>
            <span className="text-sm text-tg-hint">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {t.nextPage}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
