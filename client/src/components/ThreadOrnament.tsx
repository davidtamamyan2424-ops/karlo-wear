import { useEffect, useRef, useState } from "react";

/** Repeated geometric carpet motifs, revealed as the visitor scrolls down the page. */
export default function ThreadOrnament({ side = "left" }: { side?: "left" | "right" }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([0]));
  const count = 11;

  useEffect(() => {
    const parent = root.current;
    if (!parent || typeof IntersectionObserver === "undefined") {
      setVisible(new Set(Array.from({ length: count }, (_, i) => i)));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setVisible((previous) => {
        const next = new Set(previous);
        for (const entry of entries) {
          if (entry.isIntersecting) next.add(Number((entry.target as HTMLElement).dataset.motif));
        }
        return next.size === previous.size ? previous : next;
      });
    }, { rootMargin: "0px 0px 80px 0px", threshold: 0.08 });
    parent.querySelectorAll("[data-motif]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} aria-hidden="true" className={`kw-threads kw-threads--${side}`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} data-motif={i} viewBox="0 0 120 150" preserveAspectRatio="xMidYMid meet"
          className={`kw-woven-tile ${visible.has(i) ? "kw-woven-tile--visible" : ""}`}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Vertical warp threads interlace through each geometric medallion. */}
            {[14, 32, 50, 70, 88, 106].map((x, j) => (
              <path key={x} className="kw-woven-stroke" style={{ transitionDelay: `${j * 110}ms` }}
                d={`M ${x} -2 L ${x} 152`}
                stroke={j % 2 ? "#234b79" : "#a52d38"} strokeWidth="1.4" opacity=".56" />
            ))}
            <path className="kw-woven-stroke" d="M 60 8 L 102 45 L 102 105 L 60 142 L 18 105 L 18 45 Z"
              stroke="#a52d38" strokeWidth="3.3" />
            <path className="kw-woven-stroke" d="M 60 24 L 86 51 L 86 99 L 60 126 L 34 99 L 34 51 Z"
              stroke="#234b79" strokeWidth="2.7" style={{ transitionDelay: "220ms" }} />
            <path className="kw-woven-stroke" d="M 60 40 L 79 75 L 60 110 L 41 75 Z"
              stroke="#a52d38" strokeWidth="3.2" style={{ transitionDelay: "430ms" }} />
            <path className="kw-woven-stroke" d="M 60 52 L 73 75 L 60 98 L 47 75 Z M 60 8 L 60 40 M 60 110 L 60 142"
              stroke="#b68a50" strokeWidth="2" style={{ transitionDelay: "580ms" }} />
            <path className="kw-woven-stroke" d="M 2 30 L 18 45 L 2 60 M 118 30 L 102 45 L 118 60 M 2 90 L 18 105 L 2 120 M 118 90 L 102 105 L 118 120"
              stroke="#234b79" strokeWidth="2.4" style={{ transitionDelay: "340ms" }} />
          </g>
        </svg>
      ))}
    </div>
  );
}
