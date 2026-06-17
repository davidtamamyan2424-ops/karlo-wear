interface Props {
  label: string;
  value: string;
  hint?: string;
  large?: boolean;
}

export default function MetricCard({ label, value, hint, large }: Props) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs font-medium text-tg-hint">{label}</p>
      <p className={["mt-1 font-semibold text-ink", large ? "text-2xl" : "text-lg"].join(" ")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-tg-hint">{hint}</p>}
    </div>
  );
}
