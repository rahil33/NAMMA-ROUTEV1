import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/auth'
import { reportRoadIssue } from '@/services/roadConditionService'

const KINDS = [['pothole', 'Pothole'], ['speed-breaker', 'Speed breaker'], ['rough-road', 'Rough road'], ['closure', 'Road closed']] as const

/** Lets riders report a road problem at their current GPS position. These reports feed Comfortable Route. */
export function RoadReportButtons() {
  const { status } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status !== 'authed') {
    return <p className="text-xs text-[var(--color-ink-700)]">Spot a bad road? <Link className="font-bold underline" to="/login?next=/live">Sign in</Link> to report it and help other riders.</p>
  }

  function report(kind: (typeof KINDS)[number][0]) {
    if (!('geolocation' in navigator)) return setMsg('This device can’t share its location.')
    setBusy(true)
    setMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await reportRoadIssue(kind, p.coords.latitude, p.coords.longitude)
          setMsg('Thanks! Your report was added.')
        } catch (e) {
          setMsg(e instanceof Error ? e.message : 'Could not send the report.')
        } finally {
          setBusy(false)
        }
      },
      () => {
        setBusy(false)
        setMsg('Turn on location permission so we can place the report.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="soft-card rounded-[var(--radius-card)] p-4">
      <h3 className="text-sm font-extrabold">Report a road problem here</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {KINDS.map(([k, label]) => (
          <button key={k} disabled={busy} onClick={() => report(k)} className="min-h-12 rounded-full border border-black/15 bg-white text-sm font-bold disabled:opacity-50">{label}</button>
        ))}
      </div>
      {msg && <p role="status" className="mt-2 text-xs font-semibold">{msg}</p>}
    </div>
  )
}
