import { AlertTriangle, ArrowDownToLine, CheckCircle2, HelpCircle } from 'lucide-react'
import type { Journey, JourneySegment } from '@/types'
import { ModeIcon } from '@/components/common/ModeIcon'
import { formatDistance, formatDuration, formatFare, MODE_LABEL, MODE_COLOR } from '@/utils/formatting'

function AccessibilityNote({ segment }: { segment: JourneySegment }) {
  const a = segment.accessibility
  if (a.wheelchairAccessible === 'unknown') {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-ink-700)]">
        <HelpCircle size={12} aria-hidden />
        Accessibility data unavailable
      </span>
    )
  }
  if (a.wheelchairAccessible) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-ok-600)]">
        <CheckCircle2 size={12} aria-hidden />
        {a.note ?? 'Step-free per demo data'}
        {!a.verified && ' (unverified)'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-[var(--color-warn-600)]">
      <AlertTriangle size={12} aria-hidden />
      {a.hasSteps ? 'Steps involved (demo data)' : 'Not wheelchair accessible (demo data)'}
    </span>
  )
}

function stationAccessSteps(segment: JourneySegment): string[] {
  const a = segment.accessibility
  let access = 'Vertical access data unavailable'
  if (a.hasElevator === true) access = 'Elevator'
  else if (a.hasEscalator === true) access = 'Escalator'
  else if (a.hasSteps) access = 'Stairs'
  return ['Station entrance', 'Indoor concourse', access, segment.platform ?? 'Platform']
}

export function JourneyTimeline({
  journey,
  activeSegmentId,
  onSegmentClick,
}: {
  journey: Journey
  activeSegmentId: string | null
  onSegmentClick: (segmentId: string) => void
}) {
  return (
    <ol className="relative flex flex-col gap-0">
      {journey.segments.map((segment, i) => {
        const isLast = i === journey.segments.length - 1
        const active = segment.id === activeSegmentId
        return (
          <li key={segment.id} className="relative pl-8">
            {!isLast && (
              <span
                className="absolute left-[13px] top-7 bottom-0 w-0.5"
                style={{ backgroundColor: MODE_COLOR[segment.mode] + '55' }}
                aria-hidden
              />
            )}
            <button
              onClick={() => onSegmentClick(segment.id)}
              className={`mb-4 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
                active ? 'bg-black/[0.04] ring-1 ring-inset ring-[var(--color-line-teal-500)]/40' : 'hover:bg-black/[0.02]'
              }`}
            >
              <span
                className="absolute left-0 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white"
                style={{ borderColor: MODE_COLOR[segment.mode] }}
              >
                <ModeIcon mode={segment.mode} size={14} />
              </span>
              <span className="flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold">{MODE_LABEL[segment.mode]}</span>
                  {segment.lineName && (
                    <span className="text-xs font-medium text-[var(--color-ink-700)]">{segment.lineName}</span>
                  )}
                  {segment.isTransfer && (
                    <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-700)]">
                      Transfer
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-ink-700)]">
                  {segment.from} → {segment.to}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-ink-800)]">
                  <span>{formatDuration(segment.durationMin)}</span>
                  {segment.distanceMeters !== undefined && <span>{formatDistance(segment.distanceMeters)}</span>}
                  {!!segment.fareRupees && <span>{formatFare(segment.fareRupees)}</span>}
                  {segment.platform && <span>{segment.platform}</span>}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs capitalize text-[var(--color-ink-700)]">
                  <ArrowDownToLine size={11} aria-hidden />
                  {segment.environment}
                </span>
                {(segment.mode === 'metro' || segment.mode === 'suburban-rail') && (
                  <span className="mt-1.5 block text-[11px] leading-relaxed text-[var(--color-ink-700)]">
                    {stationAccessSteps(segment).join(' → ')}
                  </span>
                )}
                <span className="mt-1 block">
                  <AccessibilityNote segment={segment} />
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
