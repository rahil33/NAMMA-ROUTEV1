import { History, Trash2 } from 'lucide-react'
import type { SavedJourneyRecord } from '@/types'
import { formatDuration, formatFare } from '@/utils/formatting'

export function RecentJourneys({
  records,
  onSelect,
  onRemove,
}: {
  records: SavedJourneyRecord[]
  onSelect: (record: SavedJourneyRecord) => void
  onRemove: (id: string) => void
}) {
  if (records.length === 0) return null

  return (
    <section aria-labelledby="recent-journeys-heading">
      <h2 id="recent-journeys-heading" className="mb-3 flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
        <History size={15} aria-hidden />
        Recent journeys
      </h2>
      <ul className="flex flex-col gap-2.5">
        {records.slice(0, 5).map((record) => (
          <li key={record.id} className="group flex items-center gap-2 rounded-3xl soft-card px-4 py-3.5">
            <button onClick={() => onSelect(record)} className="flex flex-1 items-center justify-between gap-3 text-left">
              <span className="text-sm">
                <span className="font-medium">{record.journey.origin.name}</span>
                <span className="mx-1.5 text-[var(--color-ink-700)]">→</span>
                <span className="font-medium">{record.journey.destination.name}</span>
              </span>
              <span className="shrink-0 text-xs text-[var(--color-ink-700)]">
                {formatDuration(record.journey.durationMin)} · {formatFare(record.journey.fareRupees)}
              </span>
            </button>
            <button
              aria-label="Remove from recent journeys"
              onClick={() => onRemove(record.id)}
              className="shrink-0 rounded-full p-1.5 text-[var(--color-ink-700)] opacity-0 hover:bg-black/5 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
