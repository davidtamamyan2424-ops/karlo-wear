import { useEffect, useRef, useState } from "react";

/** An embroidered carpet border: tiny diagonal thread stitches build each motif from top to bottom. */
const WIDTH = 112;
const HEIGHT = 224;
const THREADS = ["#a3333e", "#254d77", "#c08c55"] as const;

function motifColor(x: number, y: number): number | null {
  const center = Math.abs(x - WIDTH / 2);
  const yy = y % HEIGHT;
  const dy = Math.abs(yy - HEIGHT / 2);
  // Stepped central medallion with inner blue diamond and ochre details.
  const diamond = center / 1.05 + dy / 1.32;
  if (diamond < 13) return 2;
  if (diamond < 24) return 1;
  if (diamond < 31) return 0;
  if (diamond < 38) return 1;
  if (diamond < 43) return 0;
  // Repeating side hooks and fine geometric carpet border.
  if ((x < 13 || x > WIDTH - 13) && yy % 36 < 21) return yy % 36 < 6 ? 0 : 1;
  if ((x > 16 && x < 29 || x > WIDTH - 29 && x < WIDTH - 16) && yy % 56 < 7) return 2;
  if (Math.abs(x - WIDTH / 2) < 2 && dy > 49) return 0;
  return null;
}

const stitches: { x: number; y: number; color: string; id: number }[] = [];
let id = 0;
for (let y = 0; y < HEIGHT; y += 3.5) {
  for (let x = 0; x < WIDTH; x += 3.5) {
    const color = motifColor(x, y);
    if (color !== null) stitches.push({ x, y, color: THREADS[color], id: id++ });
  }
}

export default function ThreadOrnament({ side = "left" }: { side?: "left" | "right" }) {
  const root = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const parent = root.current;
    if (!parent) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(new Set(Array.from({ length: 8 }, (_, i) => i)));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setSeen((prev) => {
        const next = new Set(prev);
        entries.forEach((entry) => {
          if (entry.isIntersecting) next.add(Number((entry.target as HTMLElement).dataset.tile));
        });
        return next.size === prev.size ? prev : next;
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    parent.querySelectorAll("[data-tile]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} aria-hidden="true" className={`kw-threads kw-threads--${side}`}>
      {Array.from({ length: 8 }, (_, tile) => (
        <div key={tile} data-tile={tile} className={`kw-embroidery-tile ${seen.has(tile) ? "kw-embroidery-tile--active" : ""}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
            <defs>
              <filter id={`kw-yarn-${side}-${tile}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation=".35" result="shadow" />
                <feOffset in="shadow" dx=".45" dy=".55" result="offset" />
                <feMerge><feMergeNode in="offset" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g filter={`url(#kw-yarn-${side}-${tile})`}>
              {stitches.map(({ x, y, color, id }) => (
                <path key={id} d={`M ${x - 1.4} ${y + 1.4} Q ${x} ${y - 0.5} ${x + 1.5} ${y - 1.5}`}
                  fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round"
                  className="kw-stitch" style={{ transitionDelay: `${Math.round(y / HEIGHT * 5800 + (x / WIDTH) * 240)}ms` }} />
              ))}
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
