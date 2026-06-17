import { useEffect, useState, type FormEvent } from "react";
import {
  adminCreateMoneyOperation,
  adminFetchDashboard,
  adminFetchFinanceSummary,
  adminFetchMoneyTransactions,
} from "../../api/endpoints";
import type { MoneyTransaction, PeriodMetrics } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import MetricCard from "../../components/admin/MetricCard";
import { MONEY_OPERATION_LABELS } from "../../constants/finance";
import { ApiError } from "../../api/client";

interface Props {
  token: string;
}

export default function AdminFinance({ token }: Props) {
  const t = ru.admin.crm;
  const [summary, setSummary] = useState<PeriodMetrics | null>(null);
  const [cash, setCash] = useState(0);
  const [card, setCard] = useState(0);
  const [txs, setTxs] = useState<MoneyTransaction[]>([]);
  const [opType, setOpType] = useState("CASH_IN");
  const [amountRub, setAmountRub] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void adminFetchFinanceSummary(token).then(setSummary);
    void adminFetchDashboard(token).then((d) => {
      setCash(d.cash);
      setCard(d.card);
    });
    void adminFetchMoneyTransactions(token).then(setTxs);
  };

  useEffect(load, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Math.round(Number(amountRub) * 100);
    if (!Number.isFinite(amount) || amount < 1) {
      setError(t.validationError);
      return;
    }
    setError(null);
    try {
      await adminCreateMoneyOperation(token, {
        type: opType,
        amount,
        comment: comment.trim() || null,
      });
      setAmountRub("");
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ru.common.error);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-tg-button";

  if (!summary) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t.revenue} value={formatPrice(summary.revenue)} />
        <MetricCard label={t.cogs} value={formatPrice(summary.cogs)} />
        <MetricCard label={t.otherExpenses} value={formatPrice(summary.otherExpenses)} />
        <MetricCard label={t.grossProfit} value={formatPrice(summary.grossProfit)} />
        <MetricCard label={t.netProfit} value={formatPrice(summary.netProfit)} />
        <MetricCard label={t.soldUnits} value={String(summary.soldUnits)} />
        <MetricCard label={t.freeIssues} value={String(summary.freeIssues)} />
        <MetricCard label={t.ownerIssues} value={String(summary.ownerIssues)} />
        <MetricCard label={t.cash} value={formatPrice(cash)} />
        <MetricCard label={t.card} value={formatPrice(card)} />
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
        <h3 className="text-sm font-semibold">{t.moneyOperation}</h3>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <select value={opType} onChange={(e) => setOpType(e.target.value)} className={inputCls}>
          {Object.entries(MONEY_OPERATION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Сумма, ₽"
          value={amountRub}
          onChange={(e) => setAmountRub(e.target.value)}
          className={inputCls}
        />
        <input
          placeholder={t.comment}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={inputCls}
        />
        <button type="submit" className="w-full rounded-xl bg-tg-button py-2 text-sm font-semibold text-tg-buttonText">
          {ru.admin.products.save}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.recentTransactions}</h3>
        {txs.slice(0, 20).map((tx) => (
          <div key={tx.id} className="rounded-lg bg-tg-secondaryBg px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span>{MONEY_OPERATION_LABELS[tx.type] ?? tx.type}</span>
              <span>{formatPrice(tx.amount)}</span>
            </div>
            <p className="text-tg-hint">
              {new Date(tx.createdAt).toLocaleString("ru-RU")}
              {tx.cashDelta ? ` · нал: ${formatPrice(Math.abs(tx.cashDelta))}` : ""}
              {tx.cardDelta ? ` · карта: ${formatPrice(Math.abs(tx.cardDelta))}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
