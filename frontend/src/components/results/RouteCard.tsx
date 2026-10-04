import { ComfortChip } from '@/components/results/Comfort'
import { ChevronDown, ChevronRight, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { Journey } from '@/types'
import { ModeIcon } from '@/components/common/ModeIcon'
import { Chip } from '@/components/common/Badge'
import { formatClock, formatDistance, formatDuration, formatFare, MODE_COLOR, MODE_LABEL, OPTIMIZE_LABEL } from '@/utils/formatting'
import { usePreferences } from '@/context/preferences'
import { useJourney } from '@/context/journey'
import { useT } from '@/i18n/useT'
import { PriorityParams } from '@/components/results/PriorityParams'
import { connectionRisks, journeyConfidence, scoreJourney, worstRisk } from '@/utils/commuterIntel'

function ScoreRing({ score }: { score: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center" role="img" aria-label={`Journey Score ${score} out of 100`}>
      <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90" aria-hidden>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(16,24,39,0.08)" strokeWidth="6" />
        <circle
          cx="34" cy="34" r={r} fill="none" stroke="#20D6C7" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
        />
      </svg>
      <span className="absolute text-xl font-extrabold leading-none">{score}</span>
    </span>
  )
}

export function RouteCard({
  journey,
  selected,
  recommended = false,
  onSelect,
  onOpenDetails,
}: {
  journey: Journey
  selected: boolean
  recommended?: boolean
  onSelect: () => void
  onOpenDetails: () => void
}) {
  const { preferences } = usePreferences()
  const { results } = useJourney()
  const t = useT()
  const score = scoreJourney(journey, preferences.optimizeFor, preferences.rainMode)
  const risk = worstRisk(connectionRisks(journey))
  const confidence = journeyConfidence()
  const strengths = score.factors.filter((f) => f.value >= 80).map((f) => f.label)
  const totalMin = journey.segments.reduce((s, x) => s + x.durationMin, 0) || 1

  return (
    <article
      className={`rounded-[var(--radius-sheet)] p-5 transition duration-300 ${
        selected
          ? 'bg-white shadow-[0_22px_60px_-20px_rgba(32,214,199,0.55)] ring-2 ring-[var(--color-primary)]'
          : 'soft-card hover:-translate-y-0.5'
      }`}
    >
      <button onClick={onSelect} className="block w-full text-left" aria-pressed={selected}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${recommended ? 'bg-[var(--color-primary)] text-[var(--color-ink-950)]' : 'bg-black/5 text-[var(--color-ink-800)]'}`}>
            {recommended ? t('recommended') : (OPTIMIZE_LABEL[journey.tag] ?? journey.tag)}
          </span>
          {journey.rainOptimized && <Chip tone="good">Rain-friendly</Chip>}
          {!journey.accessible && <Chip tone="warn">Step-free not confirmed</Chip>}
          {journey.comfort && <ComfortChip comfort={journey.comfort} />}
        </div>

        <div className="flex items-center gap-4">
          <ScoreRing score={score.score} />
          <div className="min-w-0">
            <p className="text-2xl font-extrabold leading-tight tracking-tight">
              {formatClock(journey.departAt)} → {formatClock(journey.arriveAt)}
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-700)]">
              Journey Score · {formatDuration(journey.durationMin)}
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Journey summary">
          {[journey.fareKnown === false ? 'Fare n/a' : formatFare(journey.fareRupees), formatDuration(journey.durationMin), `${formatDistance(journey.walkingMeters)} walk`, `${journey.transfers} ${journey.transfers === 1 ? 'transfer' : 'transfers'}`].map((label) => (
            <li key={label} className="rounded-full bg-[var(--color-surface-0)] px-3.5 py-1.5 text-sm font-bold">{label}</li>
          ))}
        </ul>

        {/* Mode strip, proportional to time */}
        <div className="mt-4 flex gap-1" aria-label="Route by mode">
          {journey.segments.map((seg) => (
            <span
              key={seg.id}
              className="flex min-w-[44px] items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-bold"
              style={{ flexGrow: Math.max(seg.durationMin, 4) / totalMin * 10, backgroundColor: MODE_COLOR[seg.mode] + '22', color: '#101827' }}
              title={`${MODE_LABEL[seg.mode]} ${seg.durationMin} min`}
            >
              <ModeIcon mode={seg.mode} size={14} />
              <span className="hidden sm:inline">{MODE_LABEL[seg.mode]}</span>
            </span>
          ))}
        </div>

        <PriorityParams
          journey={journey}
          results={results}
          priorities={preferences.priorities}
          rainMode={preferences.rainMode}
          budgetRupees={preferences.budgetRupees}
        />

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-[var(--color-surface-0)] p-3">
            <p className="flex items-center gap-1 font-bold">
              {risk === 'Risky' ? <TriangleAlert size={13} className="text-[var(--color-warn-600)]" aria-hidden /> : <ShieldCheck size={13} className="text-[var(--color-line-teal-600)]" aria-hidden />}
              {t('connection')}
            </p>
            <p className="mt-0.5 text-[var(--color-ink-700)]">{risk ? `${risk} (simulated)` : 'Direct, no connection'}</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-0)] p-3">
            <p className="font-bold">{t('journeyConfidence')}</p>
            <p className="mt-0.5 text-[var(--color-ink-700)]">{confidence.level} · {t('demoSchedule')}</p>
            <p className="text-xs text-[var(--color-ink-700)]">{confidence.source} · generated {confidence.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </button>

      <details className="group mt-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-[var(--color-line-teal-600)]">
          {t('whyRoute')}
          <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-3 flex flex-col gap-2.5">
          {score.factors.map((f) => (
            <li key={f.key}>
              <div className="flex justify-between text-xs font-semibold">
                <span>{f.label} <span className="font-normal text-[var(--color-ink-700)]">· {f.rawText} · {Math.round(f.weight * 100)}% weight</span></span>
                <span>{f.value} / 100</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/8">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${f.value}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--color-ink-700)]">
          {strengths.length > 0 ? `Ranked well on ${strengths.join(', ').toLowerCase()}. ` : ''}{score.explanation}
        </p>
      </details>

      <button onClick={onOpenDetails} className="mt-4 flex w-full items-center justify-center gap-1 rounded-full bg-[var(--color-ink-950)] py-3.5 text-sm font-bold text-white transition active:scale-[0.98]">
        View journey details
        <ChevronRight size={16} aria-hidden />
      </button>
    </article>
  )
}
