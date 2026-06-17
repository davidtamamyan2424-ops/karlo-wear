interface BarChartItem {
  label: string;
  value: number;
}

interface Props {
  items: BarChartItem[];
  formatValue?: (v: number) => string;
  color?: string;
}

export default function BarChart({ items, formatValue, color = "#1a1a1a" }: Props) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-tg-hint">{item.label}</span>
            <span className="font-medium text-ink">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-tg-secondaryBg">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
