import { useEffect, useState } from "react";
import { ru } from "../../i18n/ru";
import type { PaymentAccount } from "../../types";
import {
  adminCreatePaymentAccount,
  adminFetchPaymentAccounts,
  adminUpdatePaymentAccount,
} from "../../api/endpoints";

interface FormState {
  id: string | null;
  bankName: string;
  recipientName: string;
  phoneNumber: string;
}

const EMPTY: FormState = { id: null, bankName: "", recipientName: "", phoneNumber: "" };

export default function AdminPaymentAccounts({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError(null);
    adminFetchPaymentAccounts(token)
      .then(setAccounts)
      .catch(() => setError(ru.common.error));
  };

  useEffect(load, [token]);

  const toggleActive = async (acc: PaymentAccount) => {
    try {
      const updated = await adminUpdatePaymentAccount(token, acc.id, {
        isActive: !acc.isActive,
      });
      setAccounts((prev) => prev?.map((a) => (a.id === acc.id ? updated : a)) ?? null);
    } catch {
      setError(ru.common.error);
    }
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.bankName.trim() || !form.recipientName.trim() || !form.phoneNumber.trim()) {
      setError(ru.common.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        const updated = await adminUpdatePaymentAccount(token, form.id, {
          bankName: form.bankName.trim(),
          recipientName: form.recipientName.trim(),
          phoneNumber: form.phoneNumber.trim(),
        });
        setAccounts((prev) => prev?.map((a) => (a.id === form.id ? updated : a)) ?? null);
      } else {
        const created = await adminCreatePaymentAccount(token, {
          bankName: form.bankName.trim(),
          recipientName: form.recipientName.trim(),
          phoneNumber: form.phoneNumber.trim(),
        });
        setAccounts((prev) => (prev ? [...prev, created] : [created]));
      }
      setForm(null);
    } catch {
      setError(ru.common.error);
    } finally {
      setSaving(false);
    }
  };

  const fieldInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{ru.admin.accounts.title}</h2>
        {!form && (
          <button
            type="button"
            onClick={() => setForm(EMPTY)}
            className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText"
          >
            {ru.admin.accounts.add}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {form && (
        <div className="space-y-2 rounded-2xl border border-black/10 bg-white p-3">
          {fieldInput(ru.admin.accounts.bankName, form.bankName, (v) =>
            setForm({ ...form, bankName: v }),
          )}
          {fieldInput(ru.admin.accounts.recipientName, form.recipientName, (v) =>
            setForm({ ...form, recipientName: v }),
          )}
          {fieldInput(ru.admin.accounts.phoneNumber, form.phoneNumber, (v) =>
            setForm({ ...form, phoneNumber: v }),
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={submitForm}
              className="rounded-lg bg-tg-button px-4 py-2 text-sm font-medium text-tg-buttonText disabled:opacity-50"
            >
              {ru.admin.accounts.save}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg bg-tg-secondaryBg px-4 py-2 text-sm font-medium"
            >
              {ru.admin.accounts.cancel}
            </button>
          </div>
        </div>
      )}

      {!accounts && <p className="text-sm text-tg-hint">{ru.admin.loading}</p>}

      <ul className="space-y-2">
        {accounts?.map((acc) => (
          <li
            key={acc.id}
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-white p-3"
          >
            <div className="text-sm">
              <p className="font-medium">{acc.bankName}</p>
              <p className="text-tg-hint">{acc.recipientName}</p>
              <p className="text-tg-hint">{acc.phoneNumber}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  acc.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                }`}
              >
                {acc.isActive ? ru.admin.accounts.active : ru.admin.accounts.inactive}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    id: acc.id,
                    bankName: acc.bankName,
                    recipientName: acc.recipientName,
                    phoneNumber: acc.phoneNumber,
                  })
                }
                className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
              >
                {ru.admin.accounts.edit}
              </button>
              <button
                type="button"
                onClick={() => toggleActive(acc)}
                className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
              >
                {acc.isActive
                  ? ru.admin.accounts.deactivate
                  : ru.admin.accounts.activate}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
