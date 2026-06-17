import { useEffect, useState, type FormEvent } from "react";
import { adminCreateExpense, adminDeleteExpense, adminFetchExpenses } from "../../api/endpoints";
import type { Expense } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import { EXPENSE_CATEGORY_LABELS } from "../../constants/finance";
import { ApiError } from "../../api/client";

interface Props {
  token: string;
}

export default function AdminExpenses({ token }: Props) {
  const t = ru.admin.crm;
  const [items, setItems] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("HOSTING");
  const [amountRub, setAmountRub] = useState("");
  const [comment, setComment] = useState("");

  const load = () => void adminFetchExpenses(token).then(setItems);

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
      await adminCreateExpense(token, {
        date,
        category,
        amount,
        comment: comment.trim() || null,
      });
      setShowForm(false);
      setAmountRub("");
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ru.common.error);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-tg-button";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="rounded-xl bg-tg-button px-4 py-2 text-sm font-medium text-tg-buttonText"
      >
        {t.addExpense}
      </button>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
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
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-2 rounded-xl border border-black/10 bg-white p-3 text-sm">
            <div>
              <p className="font-medium">
                {EXPENSE_CATEGORY_LABELS[item.category] ?? item.category} · {formatPrice(item.amount)}
              </p>
              <p className="text-xs text-tg-hint">
                {new Date(item.date).toLocaleDateString("ru-RU")}
                {item.comment ? ` · ${item.comment}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void adminDeleteExpense(token, item.id).then(load)}
              className="text-xs text-red-600"
            >
              {ru.admin.products.delete}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
