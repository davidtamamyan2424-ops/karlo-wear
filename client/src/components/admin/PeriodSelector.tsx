import { recentMonthOptions } from "../../lib/period";
import { ru } from "../../i18n/ru";

interface Props {
  value: string;
  onChange: (month: string) => void;
}

export default function PeriodSelector({ value, onChange }: Props) {
  const options = recentMonthOptions();

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-tg-hint">{ru.admin.crm.period}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-tg-button"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
