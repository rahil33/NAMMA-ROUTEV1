import { Armchair, Info } from 'lucide-react'
import type { ComfortInfo, Journey, OptimizeFor } from '@/types'
import { Chip } from '@/components/common/Badge'

const asksForComfort = (priorities: OptimizeFor[]) => priorities.includes('comfortable') || priorities.includes('balanced')

export function ComfortChip({ comfort }: { comfort: ComfortInfo }) {
  return (
    <Chip tone={comfort.limited ? 'neutral' : comfort.score >= 75 ? 'good' : comfort.score >= 50 ? 'neutral' : 'warn'}>
      <Armchair size={12} aria-hidden />
      {comfort.limited ? `Comfort ~${comfort.score} · limited data` : `Comfort ${comfort.score}/100`}
    </Chip>
  )
}

/** Detailed comfort breakdown for the route details screen. Always states what data it is based on. */
export function ComfortPanel({ comfort }: { comfort: ComfortInfo }) {
  return (
    <section className="soft-card mt-3 rounded-[var(--radius-card)] p-4" aria-label="Road comfort">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold"><Armchair size={16} aria-hidden /> Road comfort</h2>
        <ComfortChip comfort={comfort} />
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {comfort.notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <p className="mt-2 text-xs text-[var(--color-ink-700)]">
        Data used: {comfort.sources.length ? comfort.sources.join(', ') : 'none available'}. About {Math.round(comfort.coverage * 100)}% of the road distance had surface information.
        Traffic is a modelled estimate, and live potholes or road closures are not detected from satellite imagery or live feeds.
      </p>
    </section>
  )
}

/** Page-level notes: demo-fallback reason and whether road-condition data was available for a comfort search. */
export function ResultsNotes({ journeys, priorities }: { journeys: Journey[]; priorities: OptimizeFor[] }) {
  const notes: string[] = []
  const notice = journeys.find((j) => j.dataNotice)?.dataNotice
  if (notice) notes.push(notice)
  if (journeys.length && asksForComfort(priorities)) {
    const withData = journeys.filter((j) => j.comfort)
    if (withData.length === 0) notes.push('Road-condition data could not be loaded, so these routes are ranked by standard routing instead of comfort.')
    else if (withData.every((j) => j.comfort!.limited)) notes.push('Limited road-condition data for these routes. Comfort scores are only indicative.')
  }
  if (!notes.length) return null
  return (
    <div role="status" className="mt-2 flex flex-col gap-1.5">
      {notes.map((n) => (
        <p key={n} className="flex items-start gap-2 rounded-2xl bg-white/70 px-4 py-3 text-xs font-medium text-[var(--color-ink-800)]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> {n}
        </p>
      ))}
    </div>
  )
}
