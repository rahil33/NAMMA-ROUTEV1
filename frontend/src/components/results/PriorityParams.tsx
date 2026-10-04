import { Trophy } from 'lucide-react'
import type { Journey, OptimizeFor } from '@/types'
import { useT } from '@/i18n/useT'
import type { MessageKey } from '@/i18n/messages'
import { formatDistance, formatDuration, formatFare } from '@/utils/formatting'
import { outdoorExposureMin } from '@/utils/exposure'

interface Param {
  key: string
  label: string
  value: string
  best: boolean
  warn?: boolean
}

const LABEL: Record<OptimizeFor, MessageKey> = {
  fastest: 'optFastest',
  cheapest: 'optCheapest',
  'least-walking': 'optLeastWalking',
  'fewest-transfers': 'optFewestTransfers',
  accessible: 'optAccessible',
  comfortable: 'optComfortable',
  balanced: 'optBalanced',
}

const isBest = (own: number, all: number[]) => own <= Math.min(...all)

/** The measured values behind each option the traveller combined, compared against the other routes. */
export function PriorityParams({
  journey,
  results,
  priorities,
  rainMode,
  budgetRupees,
}: {
  journey: Journey
  results: Journey[]
  priorities: OptimizeFor[]
  rainMode: boolean
  budgetRupees?: number
}) {
  const t = useT()
  const params: Param[] = priorities.map((p) => {
    switch (p) {
      case 'fastest':
        return { key: p, label: t(LABEL[p]), value: formatDuration(journey.durationMin), best: isBest(journey.durationMin, results.map((j) => j.durationMin)) }
      case 'cheapest':
        return { key: p, label: t(LABEL[p]), value: formatFare(journey.fareRupees), best: isBest(journey.fareRupees, results.map((j) => j.fareRupees)) }
      case 'least-walking':
        return { key: p, label: t(LABEL[p]), value: formatDistance(journey.walkingMeters), best: isBest(journey.walkingMeters, results.map((j) => j.walkingMeters)) }
      case 'fewest-transfers':
        return { key: p, label: t(LABEL[p]), value: String(journey.transfers), best: isBest(journey.transfers, results.map((j) => j.transfers)) }
      case 'accessible':
        return { key: p, label: t(LABEL[p]), value: journey.accessible ? t('stepFree') : t('unconfirmed'), best: journey.accessible, warn: !journey.accessible }
      case 'comfortable': {
        const c = journey.comfort
        const value = !c ? 'No road data' : c.limited ? `~${c.score}/100 (limited data)` : `${c.score}/100`
        const all = results.map((j) => j.comfort).filter((x): x is NonNullable<typeof x> => Boolean(x))
        return { key: p, label: t(LABEL[p]), value, best: Boolean(c) && !c!.limited && c!.score >= Math.max(...all.map((x) => x.score)), warn: !c || c.limited }
      }
      case 'balanced':
        return { key: p, label: t(LABEL[p]), value: `${formatDuration(journey.durationMin)} · ${formatFare(journey.fareRupees)}`, best: false }
    }
  })
  if (rainMode) {
    const own = outdoorExposureMin(journey)
    params.push({ key: 'rain', label: t('rainMode'), value: t('outdoors', { n: String(Math.round(own)) }), best: isBest(own, results.map(outdoorExposureMin)) })
  }
  if (budgetRupees !== undefined) {
    const over = journey.fareRupees - budgetRupees
    params.push({
      key: 'budget',
      label: '₹',
      value: over <= 0 ? t('withinBudget', { n: String(budgetRupees) }) : t('overBudget', { n: String(over) }),
      best: over <= 0,
      warn: over > 0,
    })
  }
  if (params.length === 0) return null
  return (
    <div className="mt-2.5" aria-label={t('yourPriorities')}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-700)]">{t('yourPriorities')}</p>
      <ul className="flex flex-wrap gap-1.5">
        {params.map((p) => (
          <li
            key={p.key}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
              p.warn
                ? 'border-[var(--color-warn-600)]/30 bg-[var(--color-warn-600)]/10 text-[var(--color-warn-600)]'
                : p.best
                  ? 'border-[var(--color-line-teal-600)]/40 bg-[var(--color-line-teal-600)]/10 text-[var(--color-line-teal-600)]'
                  : 'border-black/10 bg-white/70 text-[var(--color-ink-800)]'
            }`}
          >
            {p.best && !p.warn && <Trophy size={11} aria-label={t('bestOfAll')} />}
            <span className="font-medium">{p.label}:</span> {p.value}
          </li>
        ))}
      </ul>
    </div>
  )
}
