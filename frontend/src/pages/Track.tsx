import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExternalLink, Loader2, MapPinOff, Siren } from 'lucide-react'
import { api, ApiError } from '@/services/api'

interface TrackData {
  riderName: string
  title: string
  origin: string
  destination: string
  startedAt: number
  endedAt: number | null
  last: { lat: number; lng: number; accuracy?: number; at: number } | null
  events: { type: string; at: number; message: string }[]
}

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  return s < 10 ? 'just now' : s < 90 ? `${s} seconds ago` : `${Math.round(s / 60)} min ago`
}

/** Public, read-only page a guardian opens from the SMS/link. The unguessable link is the credential. */
export function Track() {
  const { token = '' } = useParams()
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(null)
  const [, tick] = useState(0)

  const load = useCallback(async () => {
    try {
      setData(await api<TrackData>(`/api/track/${encodeURIComponent(token)}`, { timeoutMs: 8000 }))
      setError(null)
    } catch (e) {
      setError({ message: e instanceof ApiError ? e.message : 'Could not load.', gone: e instanceof ApiError && e.status === 404 })
    }
  }, [token])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load(); tick((n) => n + 1) }, 10_000)
    return () => clearInterval(id)
  }, [load])

  if (!data && !error) return <p role="status" className="flex items-center justify-center gap-2 p-10 text-lg font-semibold"><Loader2 className="animate-spin" aria-hidden /> Loading…</p>
  if (!data && error?.gone) return <div className="mx-auto max-w-md p-8 text-center"><h1 className="text-2xl font-extrabold">Link expired</h1><p className="mt-2 text-[var(--color-ink-700)]">{error.message}</p></div>

  const sos = data?.events.some((e) => e.type === 'sos')
  const stale = data?.last && !data.endedAt && Date.now() - data.last.at > 120_000
  const l = data?.last

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-5 pb-10">
      {error && !error.gone && <p role="alert" className="rounded-2xl bg-[var(--color-warn-600)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-warn-600)]">Can’t refresh right now. Showing the last information we had.</p>}
      {data && (
        <>
          {sos && <p role="alert" className="flex items-center gap-3 rounded-3xl bg-[#B3261E] p-5 text-xl font-extrabold text-white"><Siren size={28} aria-hidden /> {data.riderName} pressed SOS. Try calling them now.</p>}
          <header>
            <h1 className="text-3xl font-extrabold tracking-tight">{data.riderName}’s journey</h1>
            <p className="text-lg font-semibold">{data.origin} → {data.destination}</p>
            <p className="mt-1 text-base font-bold">{data.endedAt ? `Arrived · ${ago(data.endedAt)}` : 'Journey in progress'}</p>
          </header>
          {l ? (
            <>
              {stale && <p role="status" className="rounded-2xl bg-[var(--color-line-amber-500)]/15 px-4 py-3 text-sm font-semibold">No location update for a couple of minutes. Their phone may be offline or the app may be closed.</p>}
              <iframe
                title="Live location map"
                className="h-72 w-full rounded-3xl border-0"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${l.lng - 0.006},${l.lat - 0.004},${l.lng + 0.006},${l.lat + 0.004}&layer=mapnik&marker=${l.lat},${l.lng}`}
              />
              <p className="text-base font-semibold">Last seen {ago(l.at)}{l.accuracy ? ` (accurate to about ${Math.round(l.accuracy)} m)` : ''}</p>
              <a href={`https://maps.google.com/?q=${l.lat},${l.lng}`} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--color-ink-950)] text-lg font-bold text-white">Open in Google Maps <ExternalLink size={18} aria-hidden /></a>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl bg-black/5 p-4 font-semibold"><MapPinOff aria-hidden /> Waiting for the first location update…</p>
          )}
          <section aria-label="Activity" className="soft-card rounded-[var(--radius-card)] p-4">
            <h2 className="text-lg font-extrabold">Activity</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm font-semibold">
              {[...data.events].reverse().map((e) => <li key={e.at + e.type} className={e.type === 'sos' || e.type === 'deviation' || e.type === 'inactivity' ? 'text-[var(--color-warn-600)]' : ''}>{ago(e.at)} · {e.message}</li>)}
            </ul>
          </section>
          <p className="text-xs text-[var(--color-ink-700)]">This page updates by itself every few seconds. Keep it open to follow the journey.</p>
        </>
      )}
    </div>
  )
}
