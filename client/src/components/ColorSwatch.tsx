const COLOR_MAP: Record<string, string> = {
  черн: "#1a1a1a",
  бел: "#f5f5f0",
  беж: "#d4b896",
  сер: "#9ca3af",
  красн: "#c0392b",
  син: "#2563eb",
  зелен: "#16a34a",
  розов: "#f472b6",
  коричн: "#78350f",
  голуб: "#38bdf8",
  фиолет: "#7c3aed",
  желт: "#eab308",
  оранж: "#ea580c",
  крем: "#faf0e6",
  молоч: "#faf8f5",
  песоч: "#c2a878",
  хаки: "#6b705c",
  navy: "#1e3a5f",
};

function inferColorFromName(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return "#d4d4d4";
}

interface Props {
  name: string;
  size?: number;
  className?: string;
}

export default function ColorSwatch({ name, size = 14, className = "" }: Props) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10 ${className}`}
      style={{ width: size, height: size, backgroundColor: inferColorFromName(name) }}
      aria-hidden
    />
  );
}
