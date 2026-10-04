import { useEffect, useState } from 'react'
import { ExternalLink, TrainFront } from 'lucide-react'
import type { Journey } from '@/types'
import { transitStatus, type TransitStatus } from '@/services/transitService'

/** Official public-transport resources. No unofficial scraping; only links to the operators themselves. */
export function TransitInfo({ journey }: { journey: Journey }) {
  const [status, setStatus] = useState<TransitStatus | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void transitStatus().then((s) => alive && setStatus(s))
    return () => { alive = false }
  }, [])
  const usesMetro = journey.modes.includes('metro')
  if (!usesMetro && !journey.modes.includes('bus') && !journey.modes.includes('suburban-rail')) return null

  const links = [...(status?.officialLinks ?? [{ id: 'cmrl', label: 'Chennai Metro Rail (timings, fares)', url: 'https://chennaimetrorail.org' }])]
  if (status?.chennaiOneUrl) links.unshift({ id: 'one', label: 'Buy tickets in the Chennai One app', url: status.chennaiOneUrl })

  return (
    <section className="soft-card mt-3 rounded-[var(--radius-card)] p-4" aria-label="Public transport information">
      <h2 className="flex items-center gap-1.5 text-base font-extrabold"><TrainFront size={16} aria-hidden /> Public transport</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-700)]">
        {journey.source === 'live'
          ? 'Routes and timings come from the live transit planner. Fares are shown only where the data includes them.'
          : 'Timings and fares above are demo estimates. Confirm real timetables and fares with the operator.'}
        {status?.planner === 'none' && ' Live Metro and bus data is not connected on this server.'}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-2 text-sm font-bold">
              {l.label} <ExternalLink size={14} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
