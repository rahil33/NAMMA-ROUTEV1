import { ArrowUp } from 'lucide-react'
import type { RoadPath } from '@/services/roadRouteService'
import { formatDistance } from '@/utils/formatting'

/** Turn-by-turn instructions for one walking or road leg. */
export function TurnList({ path, title }: { path: RoadPath; title: string }) {
  return (
    <section className="soft-card rounded-[var(--radius-card)] p-4" aria-label={title}>
      <h3 className="mb-2 text-sm font-extrabold">{title}</h3>
      <ol className="flex flex-col gap-2">
        {path.steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink-950)] text-[var(--color-primary)]">
              <ArrowUp size={14} style={{ transform: `rotate(${s.rotation}deg)` }} aria-hidden />
            </span>
            <span className="flex-1 font-semibold">{s.text}</span>
            {s.distance > 0 && <span className="shrink-0 text-xs text-[var(--color-ink-700)]">{formatDistance(s.distance)}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
