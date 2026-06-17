import { useEffect, useState } from "react";
import { adminFetchWarehouse } from "../../api/endpoints";
import type { WarehouseRow } from "../../types/crm";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";

interface Props {
  token: string;
}

export default function AdminWarehouse({ token }: Props) {
  const t = ru.admin.crm;
  const [rows, setRows] = useState<WarehouseRow[] | null>(null);

  useEffect(() => {
    adminFetchWarehouse(token).then(setRows).catch(() => setRows([]));
  }, [token]);

  if (!rows) return <p className="text-sm text-tg-hint">{ru.admin.loading}</p>;

  const totalValue = rows.reduce((s, r) => s + r.stockValue, 0);
  const totalUnits = rows.reduce((s, r) => s + r.stock, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <span>
          {t.totalStock}: <strong>{totalUnits}</strong>
        </span>
        <span>
          {t.moneyInGoods}: <strong>{formatPrice(totalValue)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-black/10 bg-tg-secondaryBg text-xs text-tg-hint">
            <tr>
              <th className="px-3 py-2 font-medium">{t.model}</th>
              <th className="px-3 py-2 font-medium">{t.color}</th>
              <th className="px-3 py-2 font-medium">{t.size}</th>
              <th className="px-3 py-2 font-medium text-right">{t.stock}</th>
              <th className="px-3 py-2 font-medium text-right">{t.stockValue}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/5 last:border-0">
                <td className="px-3 py-2">{row.model}</td>
                <td className="px-3 py-2">{row.color}</td>
                <td className="px-3 py-2">{row.size}</td>
                <td className="px-3 py-2 text-right font-medium">{row.stock}</td>
                <td className="px-3 py-2 text-right text-tg-hint">{formatPrice(row.stockValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
