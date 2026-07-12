import type { PeriodPreset, PeriodState } from "../../lib/period";
import { PERIOD_PRESET_LABELS, savePeriodState } from "../../lib/period";
import { ru } from "../../i18n/ru";

interface Props {
  value: PeriodState;
  onChange: (state: PeriodState) => void;
}

export default function DateRangeSelector({ value, onChange }: Props) {
  const t = ru.admin.crm;

  const update = (next: PeriodState) => {
    savePeriodState(next);
    onChange(next);
  };

  const handlePreset = (preset: PeriodPreset) => {
    if (preset === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      update({ preset, from: value.from ?? today, to: value.to ?? today });
    } else {
      update({ preset });
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-black/10 bg-white p-3">
      <p className="text-sm font-medium text-tg-hint">{t.period}</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePreset(preset)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              value.preset === preset
                ? "bg-tg-button text-tg-buttonText"
                : "bg-tg-secondaryBg",
            ].join(" ")}
          >
            {PERIOD_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="flex flex-wrap gap-3 pt-1">
          <label className="text-sm">
            <span className="mb-1 block text-tg-hint">{t.dateFrom}</span>
            <input
              type="date"
              value={value.from ?? ""}
              onChange={(e) => update({ ...value, from: e.target.value })}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-tg-hint">{t.dateTo}</span>
            <input
              type="date"
              value={value.to ?? ""}
              onChange={(e) => update({ ...value, to: e.target.value })}
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
