import { CheckCircle2, Circle } from 'lucide-react'
import type { LiveJourneyState } from '@/types'
import { ModeIcon } from '@/components/common/ModeIcon'
import { formatDuration, MODE_LABEL, MODE_COLOR } from '@/utils/formatting'

export function LiveProgress({ state }: { state: LiveJourneyState }) {
  return (
    <ol className="flex flex-col gap-0">
      {state.journey.segments.map((segment, i) => {
        const done = i < state.currentSegmentIndex || state.status === 'completed'
        const current = i === state.currentSegmentIndex && state.status !== 'completed'
        return (
          <li key={segment.id} className="relative pl-8">
            {i < state.journey.segments.length - 1 && (
              <span
                className="absolute left-[13px] top-7 bottom-0 w-0.5"
                style={{ backgroundColor: done ? MODE_COLOR[segment.mode] : MODE_COLOR[segment.mode] + '33' }}
                aria-hidden
              />
            )}
            <div className={`mb-4 flex items-start gap-3 rounded-2xl p-2.5 ${current ? 'bg-[var(--color-primary)]/20' : ''}`}>
              <span
                className="absolute left-0 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white"
                style={{ borderColor: current ? 'var(--color-line-teal-600)' : MODE_COLOR[segment.mode] }}
              >
                {done ? (
                  <CheckCircle2 size={15} className="text-[var(--color-ok-600)]" aria-hidden />
                ) : current ? (
                  <ModeIcon mode={segment.mode} size={14} />
                ) : (
                  <Circle size={13} className="text-[var(--color-ink-700)]/40" aria-hidden />
                )}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {MODE_LABEL[segment.mode]}
                  {current && (
                    <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-950)]">
                      NOW
                    </span>
                  )}
                </span>
                <span className="block text-xs text-[var(--color-ink-700)]">
                  {segment.from} → {segment.to} · {formatDuration(segment.durationMin)}
                </span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
