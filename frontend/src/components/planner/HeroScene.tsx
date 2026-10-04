// Animated Chennai dusk: parallax skyline, twinkling windows, a Metro train crossing the viaduct, road light streaks.
// Motion is CSS-only (see .hs-* in index.css) and is switched off by prefers-reduced-motion.
const BUILDINGS = Array.from({ length: 28 }, (_, i) => ({
  x: i * 36 - 40,
  w: 26 + ((i * 37) % 24),
  h: 70 + ((i * 53) % 130),
}))
const FAR = Array.from({ length: 20 }, (_, i) => ({ x: i * 52 - 40, w: 40 + ((i * 29) % 30), h: 40 + ((i * 41) % 90) }))

export function HeroScene({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1220" />
          <stop offset="0.55" stopColor="#173447" />
          <stop offset="1" stopColor="#E7A56E" />
        </linearGradient>
        <linearGradient id="hs-glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#20D6C7" stopOpacity="0" />
          <stop offset="0.5" stopColor="#20D6C7" stopOpacity="0.9" />
          <stop offset="1" stopColor="#20D6C7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill="url(#hs-sky)" />
      <circle className="hs-sun" cx="610" cy="250" r="90" fill="#F4C48F" opacity="0.3" />
      <g className="hs-far" fill="#1B3346" opacity="0.8">
        {FAR.map((b, i) => <rect key={i} x={b.x} y={310 - b.h} width={b.w} height={b.h + 110} />)}
      </g>
      <g className="hs-near" fill="#0F2233">
        {BUILDINGS.map((b, i) => <rect key={i} x={b.x} y={300 - b.h} width={b.w} height={b.h + 120} />)}
        {BUILDINGS.map((b, i) => (
          <rect key={`w${i}`} className="hs-window" style={{ animationDelay: `${(i % 7) * 0.7}s` }} x={b.x + 6} y={300 - b.h + 14} width="4" height="5" fill="#F4D9A8" />
        ))}
      </g>
      <rect x="0" y="292" width="800" height="9" fill="#0A1220" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={30 + i * 100} y="301" width="10" height="120" fill="#0A1220" />)}
      <g className="hs-train">
        <rect x="0" y="256" width="360" height="36" rx="14" fill="#F4F7F8" />
        <rect x="0" y="272" width="360" height="5" fill="#20D6C7" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={16 + i * 28} y="263" width="18" height="8" rx="3" fill="#0E1626" opacity="0.85" />)}
        <rect x="-40" y="290" width="440" height="3" fill="url(#hs-glow)" />
      </g>
      {/* road light streaks along the bottom */}
      <g>
        <rect className="hs-streak" y="392" x="0" width="120" height="3" rx="2" fill="#F4D9A8" />
        <rect className="hs-streak hs-streak-2" y="402" x="0" width="80" height="3" rx="2" fill="#20D6C7" />
      </g>
    </svg>
  )
}
