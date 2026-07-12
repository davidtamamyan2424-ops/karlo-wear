import { useState, type FormEvent } from "react";
import { ru } from "../../i18n/ru";
import { adminCheckSession } from "../../api/endpoints";
import { loadPeriodState, savePeriodState, type PeriodState } from "../../lib/period";
import AdminOrders from "./AdminOrders";
import AdminPaymentAccounts from "./AdminPaymentAccounts";
import AdminProducts from "./AdminProducts";
import AdminDashboard from "./AdminDashboard";
import AdminWarehouse from "./AdminWarehouse";
import AdminSales from "./AdminSales";
import AdminFinance from "./AdminFinance";
import AdminAnalytics from "./AdminAnalytics";
import AdminExpenses from "./AdminExpenses";
import AdminFinanceSettings from "./AdminFinanceSettings";

const TOKEN_KEY = "karlo-wear-admin-token";

type Tab =
  | "dashboard"
  | "orders"
  | "products"
  | "warehouse"
  | "sales"
  | "finance"
  | "analytics"
  | "expenses"
  | "financeSettings"
  | "archive"
  | "accounts";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [input, setInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [period, setPeriod] = useState<PeriodState>(() => loadPeriodState());

  const handlePeriodChange = (next: PeriodState) => {
    savePeriodState(next);
    setPeriod(next);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSigningIn(true);
    try {
      await adminCheckSession(input.trim());
      localStorage.setItem(TOKEN_KEY, input.trim());
      setToken(input.trim());
    } catch {
      setLoginError(ru.admin.signInError);
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setInput("");
  };

  if (!token) {
    return (
      <form onSubmit={handleLogin} className="mx-auto max-w-sm space-y-3 py-8">
        <h1 className="text-xl font-semibold">{ru.admin.title}</h1>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{ru.admin.token}</span>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ru.admin.tokenPlaceholder}
            className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          />
        </label>
        {loginError && <p className="text-sm text-red-600">{loginError}</p>}
        <button
          type="submit"
          disabled={signingIn}
          className="w-full rounded-xl bg-tg-button py-3 font-semibold text-tg-buttonText disabled:opacity-60"
        >
          {ru.admin.signIn}
        </button>
      </form>
    );
  }

  const tabs: [Tab, string][] = [
    ["dashboard", ru.admin.tabs.dashboard],
    ["orders", ru.admin.tabs.orders],
    ["products", ru.admin.tabs.products],
    ["warehouse", ru.admin.tabs.warehouse],
    ["sales", ru.admin.tabs.sales],
    ["finance", ru.admin.tabs.finance],
    ["analytics", ru.admin.tabs.analytics],
    ["expenses", ru.admin.tabs.expenses],
    ["financeSettings", ru.admin.tabs.financeSettings],
    ["archive", ru.admin.tabs.archive],
    ["accounts", ru.admin.tabs.paymentAccounts],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{ru.admin.title}</h1>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-sm font-medium"
        >
          {ru.admin.signOut}
        </button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "shrink-0 rounded-xl px-3 py-2 text-sm font-medium",
              tab === key ? "bg-tg-button text-tg-buttonText" : "bg-tg-secondaryBg",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <AdminDashboard token={token} period={period} onPeriodChange={handlePeriodChange} />
      )}
      {tab === "orders" && (
        <AdminOrders token={token} period={period} onPeriodChange={handlePeriodChange} />
      )}
      {tab === "products" && <AdminProducts token={token} archived={false} />}
      {tab === "warehouse" && <AdminWarehouse token={token} />}
      {tab === "sales" && <AdminSales token={token} />}
      {tab === "finance" && (
        <AdminFinance token={token} period={period} onPeriodChange={handlePeriodChange} />
      )}
      {tab === "analytics" && (
        <AdminAnalytics token={token} period={period} onPeriodChange={handlePeriodChange} />
      )}
      {tab === "expenses" && <AdminExpenses token={token} />}
      {tab === "financeSettings" && <AdminFinanceSettings token={token} />}
      {tab === "archive" && <AdminProducts token={token} archived />}
      {tab === "accounts" && <AdminPaymentAccounts token={token} />}
    </div>
  );
}
