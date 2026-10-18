/** Decorative textile-inspired strands. CSS animates the thread drawing, no JS or images. */
export default function ThreadOrnament({ side = "left" }: { side?: "left" | "right" }) {
  const paths = [
    "M 48 -20 C 12 45, 96 82, 50 144 S 10 244, 53 310 S 97 406, 49 482 S 14 568, 50 640",
    "M 76 -20 C 122 60, 19 95, 77 168 S 120 260, 77 332 S 22 421, 77 505 S 118 578, 76 640",
    "M 20 -20 C 60 42, 12 120, 65 183 S 110 283, 32 359 S 14 474, 61 541 S 87 608, 36 640",
    "M 100 -20 C 51 57, 116 125, 53 195 S 5 294, 101 375 S 113 476, 43 545 S 14 615, 95 640",
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 130 620" preserveAspectRatio="none"
      className={`kw-threads kw-threads--${side}`}>
      <defs>
        <linearGradient id={`thread-red-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#b4473b" stopOpacity=".05" />
          <stop offset=".35" stopColor="#a73337" stopOpacity=".85" />
          <stop offset="1" stopColor="#a73337" stopOpacity=".08" />
        </linearGradient>
        <linearGradient id={`thread-blue-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#233d6b" stopOpacity=".05" />
          <stop offset=".35" stopColor="#254878" stopOpacity=".82" />
          <stop offset="1" stopColor="#254878" stopOpacity=".08" />
        </linearGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={`url(#thread-${i % 2 ? "blue" : "red"}-${side})`}
          strokeWidth={i % 2 ? 2.4 : 3} strokeLinecap="round"
          className="kw-thread" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <path d="M 50 144 L 77 168 L 65 183 L 53 195 L 50 144 M 53 310 L 77 332 L 32 359 L 101 375 L 53 310 M 49 482 L 77 505 L 61 541 L 43 545 L 49 482"
        fill="none" stroke="#b18b60" strokeWidth="1.5" strokeOpacity=".55" className="kw-thread kw-thread--motif" />
    </svg>
  );
}
