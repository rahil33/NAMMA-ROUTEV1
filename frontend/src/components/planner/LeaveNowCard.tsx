import { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import type { SavedJourneyRecord } from '@/types'
import { commuteMemory } from '@/utils/commuterIntel'
import { adviseDeparture } from '@/utils/departureAdvisor'
import { formatClock } from '@/utils/formatting'

export function LeaveNowCard({ records }: { records: SavedJourneyRecord[] }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const latest = records[0]?.journey
  // Recompute only when the trip or the 5-minute clock tick changes.
  const tick = Math.floor(now.getTime() / 300000)
  const advice = useMemo(
    () => (latest ? adviseDeparture(latest.origin, latest.destination, { now: new Date(tick * 300000) }) : null),
    [latest?.origin.id, latest?.destination.id, tick], // eslint-disable-line react-hooks/exhaustive-deps
  )
  if (!latest || !advice) return null
  const plan = advice.best
  const minutesUntil = Math.max(0, Math.round((plan.departAt.getTime() - now.getTime()) / 60000))
  const memory = commuteMemory(records)

  return (
    <section aria-labelledby="leave-now-heading" className="rounded-[var(--radius-sheet)] bg-[var(--color-ink-950)] p-5 text-white shadow-[var(--shadow-soft)]">
      <h2 id="leave-now-heading" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-line-teal-400)]">
        <Clock size={13} aria-hidden />
        Leave now
      </h2>
      <p className="mt-1 text-2xl font-semibold">Leave in {minutesUntil} min</p>
      <p className="text-sm text-white/75">
        {latest.origin.name} → {latest.destination.name} · depart {formatClock(plan.departAt.toISOString())} · arrive{' '}
        {formatClock(plan.arriveAt.toISOString())}
      </p>
      <p className="mt-2 text-sm text-white/90">{advice.reason}</p>
      {memory && (
        <p className="mt-2 text-sm text-white/90">
          You usually travel {memory.from} → {memory.to} around {memory.usualTime}.
          {memory.minutesFaster > 0 ? ` Latest search is ${memory.minutesFaster} min faster.` : ''}
        </p>
      )}
      <p className="mt-2 text-[11px] text-white/55">Estimate from demo data, not live schedules.</p>
    </section>
  )
}
