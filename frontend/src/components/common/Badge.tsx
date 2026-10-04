import { Beaker } from 'lucide-react'

export function DemoDataBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-bold text-[var(--color-ink-950)] ${className}`}
      title="All routes, times and alerts shown are demo data, not live service information."
    >
      <Beaker size={12} className="text-[var(--color-line-amber-500)]" aria-hidden />
      DEMO DATA
    </span>
  )
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn'
}) {
  const toneClass =
    tone === 'good'
      ? 'bg-[var(--color-ok-600)]/10 text-[var(--color-ok-600)] border-[var(--color-ok-600)]/30'
      : tone === 'warn'
        ? 'bg-[var(--color-warn-600)]/10 text-[var(--color-warn-600)] border-[var(--color-warn-600)]/30'
        : 'bg-black/5 text-[var(--color-ink-900)] border-black/10'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  )
}

/** "DEMO DATA" for generated journeys; a live marker when the journey came from a configured live planner. */
export function DataSourceBadge({ journey, className = '' }: { journey?: { source?: 'live' | 'demo' } | null; className?: string }) {
  if (journey?.source !== 'live') return <DemoDataBadge className={className} />
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ok-600)]/30 bg-[var(--color-ok-600)]/10 px-3 py-1 text-xs font-bold text-[var(--color-ok-600)] ${className}`} title="Planned by the configured live transit planner.">
      <span className="h-2 w-2 rounded-full bg-[var(--color-ok-600)]" aria-hidden />
      LIVE PLANNER
    </span>
  )
}
