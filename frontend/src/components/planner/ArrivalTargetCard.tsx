import { useEffect, useId, useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import type { SavedJourneyRecord } from '@/types'
import { adviseDeparture } from '@/utils/departureAdvisor'
import { crowdLabel } from '@/utils/trafficModel'
import { formatClock } from '@/utils/formatting'

const STORAGE_KEY = 'nammaroute.arrivalTarget'
const TARGET_EVENT = 'nammaroute:arrival-target'

/** Stores the target so the card picks it up (used by the voice command). */
export function saveArrivalTarget(hhmm: string) {
  try {
    localStorage.setItem(STORAGE_KEY, hhmm)
  } catch {
    /* storage unavailable; the event below still updates a mounted card */
  }
  window.dispatchEvent(new CustomEvent(TARGET_EVENT, { detail: hhmm }))
}

// Turns "HH:MM" into the next occurrence of that clock time (today, or tomorrow if already past).
function nextOccurrence(hhmm: string, now: Date): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const d = new Date(now)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d
}

export function ArrivalTargetCard({ records }: { records: SavedJourneyRecord[] }) {
  const inputId = useId()
  const [time, setTime] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved && /^\d{2}:\d{2}$/.test(saved) ? saved : ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    const onTarget = (e: Event) => setTime(String((e as CustomEvent).detail ?? ''))
    window.addEventListener(TARGET_EVENT, onTarget)
    return () => window.removeEventListener(TARGET_EVENT, onTarget)
  }, [])
  useEffect(() => {
    try {
      if (time) localStorage.setItem(STORAGE_KEY, time)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable (private mode); the target just won't persist */
    }
  }, [time])
  const latest = records[0]?.journey

  const result = useMemo(() => {
    if (!latest) return null
    const target = nextOccurrence(time, new Date())
    if (!target) return null
    return adviseDeparture(latest.origin, latest.destination, { arriveBy: target })
  }, [latest?.origin.id, latest?.destination.id, time]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!latest) return null
  const info = result?.arriveBy
  const best = result?.best

  return (
    <section aria-labelledby="arrival-target-heading" className="soft-card rounded-[var(--radius-sheet)] p-5">
      <h2 id="arrival-target-heading" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink-700)]">
        <Target size={13} aria-hidden />
        Arrival target
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-700)]">
        {latest.origin.name} → {latest.destination.name}
      </p>
      <label htmlFor={inputId} className="mt-3 block text-sm font-semibold">
        I need to arrive by
      </label>
      <input
        id={inputId}
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="mt-1 h-11 w-40 rounded-xl border border-black/15 bg-white px-3 text-base"
      />

      <div aria-live="polite" className="mt-3 min-h-[3rem]">
        {info && best && info.meetsTarget && (
          <>
            <p className="text-2xl font-semibold">Leave by {formatClock(best.departAt.toISOString())}</p>
            <p className="text-sm text-[var(--color-ink-700)]">
              Arrive about {formatClock(best.arriveAt.toISOString())} · {best.durationMin} min trip · {crowdLabel(best.peakCrowdPercent).toLowerCase()} crowding
              {best.trafficDelayMin > 0 ? ` · ~${best.trafficDelayMin} min traffic delay` : ''}
            </p>
            <p className="mt-1 text-sm">
              Includes a safety buffer before your target.
              {info.latestDeparture && info.latestDeparture.departAt.getTime() > best.departAt.getTime()
                ? ` Latest possible departure is ${formatClock(info.latestDeparture.departAt.toISOString())}.`
                : ''}
            </p>
          </>
        )}
        {info && result && !info.meetsTarget && (
          <p className="text-sm font-semibold text-[var(--color-danger-600,#b3261e)]">
            You can&apos;t make that time. Leaving now, the earliest arrival is about {formatClock(result.leaveNow.arriveAt.toISOString())}.
          </p>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[var(--color-ink-700)]">Estimate from demo data, not live schedules.</p>
    </section>
  )
}
