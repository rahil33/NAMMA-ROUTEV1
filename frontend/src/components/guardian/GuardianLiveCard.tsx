import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPinOff, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { Journey } from '@/types'
import { useAuth } from '@/context/auth'
import { useGuardian } from '@/context/guardian'
import { guardianSession, useGuardianSession } from '@/services/guardianSession'

/** On the Live Journey screen: starts/ends sharing with the guardian and shows its status plainly. */
export function GuardianLiveCard({ journey, completed }: { journey: Journey; completed: boolean }) {
  const { config } = useGuardian()
  const { status } = useAuth()
  const s = useGuardianSession()
  const active = config.enabled && status === 'authed'

  useEffect(() => {
    if (active && !completed) void guardianSession.start(journey, config)
    if (completed) void guardianSession.end()
  }, [active, completed, journey, config])

  if (!config.enabled) return null
  const ago = s.lastPos ? Math.max(0, Math.round((Date.now() - s.lastPos.at) / 1000)) : null

  return (
    <section className="rounded-[var(--radius-card)] border-2 border-[var(--color-ink-950)] bg-white p-4" aria-label="Guardian">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck size={20} aria-hidden /> Guardian {config.name && `· ${config.name}`}</h2>
      {status !== 'authed' ? (
        <p className="mt-1 text-sm font-semibold">Sign in to share your live location. <Link className="underline" to="/login?next=/live">Sign in</Link>. The SOS button still works.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold">
          <li>{s.phase === 'sharing' ? '● Sharing live location' : s.phase === 'starting' ? 'Starting live sharing…' : s.phase === 'error' ? 'Live sharing is not running' : completed ? 'Journey finished, sharing stopped' : 'Live sharing is off'}</li>
          {s.permission === 'denied' && <li className="flex items-center gap-1.5 text-[var(--color-warn-600)]"><MapPinOff size={16} aria-hidden /> Location permission is off for this site.</li>}
          {ago !== null && <li>Last location update {ago < 5 ? 'just now' : `${ago}s ago`}</li>}
          <li>{s.deviation === 'active' ? `Route-deviation alert: on (${config.deviationMeters} m)` : s.deviation === 'demo-journey' ? 'Route-deviation alert: off for demo journeys, because demo routes are not real roads.' : 'Route-deviation alert: off'}</li>
          <li>{config.inactivityMinutes ? `Inactivity check-in after ${config.inactivityMinutes} min` : 'Inactivity check-in: off'}</li>
          {s.autoAlerts === false && <li className="text-[var(--color-ink-700)]">Your guardian can open the tracking link, but automatic text messages are not set up on this server.</li>}
        </ul>
      )}
      {s.offRoute && <p role="alert" className="mt-2 flex items-center gap-2 rounded-2xl bg-[var(--color-warn-600)]/10 px-3 py-2 text-sm font-bold text-[var(--color-warn-600)]"><TriangleAlert size={16} aria-hidden /> You seem to be off the planned route. Your guardian has been told.</p>}
      {s.message && <p role="status" className="mt-2 text-sm font-semibold text-[var(--color-warn-600)]">{s.message}</p>}
    </section>
  )
}
