import { useEffect, useState } from 'react'
import { BellRing, Repeat2, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { LiveJourneyState } from '@/types'
import { usePreferences } from '@/context/preferences'
import { useT } from '@/i18n/useT'
import { speak } from '@/services/voiceService'
import { connectionRisks, nextActionText, worstRisk } from '@/utils/commuterIntel'
import { formatClock } from '@/utils/formatting'

/** Same definition Settings uses for the Senior mode preset. */
export function useSeniorMode(): boolean {
  const { preferences: p } = usePreferences()
  const a = p.accessibility
  return a.largeText && a.highContrast && a.minimizeWalking && a.minimizeTransfers && a.avoidStairs && p.narration
}

/** Dark hero card: what to do next, plus a stage track (Now → … → Arrive). */
export function WhatHappensNext({ state }: { state: LiveJourneyState }) {
  const senior = useSeniorMode()
  const segs = state.journey.segments
  return (
    <section aria-labelledby="next-heading" className="rounded-[var(--radius-sheet)] bg-[var(--color-ink-950)] p-6 text-white shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold text-white/70">Arrive {formatClock(state.journey.arriveAt)} (simulated)</p>
      <h2 id="next-heading" className="mt-2 text-sm font-bold text-[var(--color-primary)]">What happens next?</h2>
      <p className={`mt-1 font-extrabold leading-snug tracking-tight ${senior ? 'text-3xl' : 'text-2xl'}`} aria-live="polite">
        {nextActionText(state.journey, state.currentSegmentIndex)}
      </p>
      <ol className="mt-5 flex items-center" aria-label="Journey progress">
        {segs.map((seg, i) => {
          const done = i < state.currentSegmentIndex
          const now = i === state.currentSegmentIndex
          return (
            <li key={seg.id} className="flex flex-1 items-center last:flex-none">
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full ${now ? 'bg-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/30' : done ? 'bg-[var(--color-primary)]' : 'bg-white/25'}`}
                aria-current={now ? 'step' : undefined}
              />
              <span className={`mx-1 h-0.5 flex-1 rounded-full ${done ? 'bg-[var(--color-primary)]' : 'bg-white/20'}`} aria-hidden />
            </li>
          )
        })}
        <li className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white/60" aria-label="Arrive" />
      </ol>
    </section>
  )
}

/** Simulated buffer at the next transfer. Reuses the existing (simulated) connection-risk utility. */
export function ConnectionStatus({ state, onSaferAlternative }: { state: LiveJourneyState; onSaferAlternative: () => void }) {
  const t = useT()
  const risks = connectionRisks(state.journey)
  const level = worstRisk(risks)
  if (!level) return null
  const worst = risks.reduce((a, b) => (b.gapMin < a.gapMin ? b : a))
  const label = level === 'Comfortable' ? 'Comfortable' : level === 'Tight' ? 'Tight connection' : 'Risky connection'
  const Icon = level === 'Risky' ? TriangleAlert : ShieldCheck
  return (
    <section className="soft-card rounded-[var(--radius-card)] p-4" aria-label={t('connection')}>
      <p className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink-700)]">
        <Icon size={15} className={level === 'Risky' ? 'text-[var(--color-warn-600)]' : 'text-[var(--color-line-teal-600)]'} aria-hidden />
        {t('connection')} · {worst.at}
      </p>
      <p className="mt-1 text-xl font-extrabold">{label}</p>
      <p className="text-sm text-[var(--color-ink-700)]">{t('bufferMin', { n: String(worst.gapMin) })}</p>
      {level === 'Risky' && (
        <button onClick={onSaferAlternative} className="mt-3 rounded-full bg-[var(--color-ink-950)] px-5 py-2.5 text-sm font-bold text-white">
          Find safer alternative
        </button>
      )}
    </section>
  )
}

/** Derived from live progress: stops remaining on the current vehicle leg (same estimate as the next-step text). */
export function ArrivalGuardian({ state }: { state: LiveJourneyState }) {
  const { preferences } = usePreferences()
  const t = useT()
  const senior = useSeniorMode()
  const [on, setOn] = useState(false)
  const dest = state.journey.destination.name
  const seg = state.journey.segments[state.currentSegmentIndex]
  const riding = state.status !== 'completed' && seg && seg.mode !== 'walk' && seg.mode !== 'auto'
  const isLastRide = riding && !state.journey.segments.slice(state.currentSegmentIndex + 1).some((s) => s.mode !== 'walk')
  const place = isLastRide ? dest : (seg?.to ?? dest)
  const stops = riding ? Math.max(1, Math.round(seg.durationMin / 3)) : 0

  const [headline, detail] =
    state.status === 'completed'
      ? [t('narArrived', { place: dest }), '']
      : !riding
        ? [t('guardianWatching', { place: dest }), '']
        : stops <= 1
          ? [t('guardianOne'), t('guardianNext', { place })]
          : [t('guardianAway', { n: String(stops) }), t('guardianReady', { place })]

  const spoken = `${headline}. ${detail}`
  useEffect(() => {
    if (on && (riding || state.status === 'completed')) speak(spoken, preferences.language)
  }, [on, riding, spoken, state.status, preferences.language])

  return (
    <section
      className={`rounded-[var(--radius-sheet)] p-5 ${on ? 'bg-[var(--color-primary)]/25 ring-2 ring-[var(--color-primary)]' : 'soft-card'}`}
      aria-label={t('guardianTitle')}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <BellRing size={17} aria-hidden />
          {t('guardianTitle')}
        </p>
        <button
          role="switch"
          aria-checked={on}
          onClick={() => setOn((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-bold ${on ? 'bg-[var(--color-ink-950)] text-white' : 'bg-white text-[var(--color-ink-950)]'}`}
        >
          {on ? t('guardianOn') : t('guardianOff')}
        </button>
      </div>
      {on ? (
        <div aria-live="polite">
          <p className={`mt-4 font-extrabold tracking-tight ${senior ? 'text-5xl' : 'text-4xl'}`}>{headline}</p>
          {detail && <p className={`mt-1 font-semibold text-[var(--color-ink-800)] ${senior ? 'text-2xl' : 'text-lg'}`}>{detail}</p>}
          {senior && (
            <button onClick={() => speak(spoken, preferences.language)} className="mt-4 flex items-center gap-2 rounded-full bg-[var(--color-ink-950)] px-6 py-4 text-lg font-bold text-white">
              <Repeat2 size={22} aria-hidden />
              Repeat
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-ink-700)]">{t('guardianHint')}</p>
      )}
    </section>
  )
}
