import { useEffect, useState, type FormEvent } from "react";
import { adminFetchFinanceSettings, adminUpdateFinanceSettings } from "../../api/endpoints";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import { ApiError } from "../../api/client";

interface Props {
  token: string;
}

export default function AdminFinanceSettings({ token }: Props) {
  const t = ru.admin.crm;
  const [startingBalanceRub, setStartingBalanceRub] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void adminFetchFinanceSettings(token)
      .then((data) => {
        setStartingBalanceRub(String(Math.round(data.startingBalance / 100)));
        setUpdatedAt(data.updatedAt);
      })
      .catch(() => setError(ru.common.error))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const startingBalance = Math.round(Number(startingBalanceRub) * 100);
    if (!Number.isFinite(startingBalance) || startingBalance < 0) {
      setError(t.validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await adminUpdateFinanceSettings(token, { startingBalance });
      setStartingBalanceRub(String(Math.round(data.startingBalance / 100)));
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ru.common.error);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-tg-button";

  if (loading) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-tg-hint">{t.financeSettingsHint}</p>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
        <h3 className="text-sm font-semibold">{t.financeSettingsTitle}</h3>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.startingBalance}</span>
          <input
            type="number"
            min={0}
            value={startingBalanceRub}
            onChange={(e) => setStartingBalanceRub(e.target.value)}
            className={inputCls}
          />
        </label>

        {updatedAt && (
          <p className="text-xs text-tg-hint">
            {t.lastUpdated}: {new Date(updatedAt).toLocaleString("ru-RU")}
          </p>
        )}

        <p className="text-xs text-tg-hint">
          {t.startingBalancePreview}: {formatPrice(Math.round(Number(startingBalanceRub || 0) * 100))}
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-tg-button py-2.5 text-sm font-semibold text-tg-buttonText disabled:opacity-60"
        >
          {saving ? ru.admin.products.saving : ru.admin.products.save}
        </button>
      </form>
    </div>
  );
}
