import { useCallback, useEffect, useRef, useState } from 'react'
import { Accessibility, Armchair, ChevronLeft, ChevronRight, CloudRain, Footprints, IndianRupee, Layers, Repeat, Scale, Timer } from 'lucide-react'
import type { OptimizeFor } from '@/types'
import { useT } from '@/i18n/useT'
import type { MessageKey } from '@/i18n/messages'

const OPTIONS: { value: OptimizeFor; label: MessageKey; icon: React.ReactNode }[] = [
  { value: 'fastest', label: 'optFastest', icon: <Timer size={14} /> },
  { value: 'cheapest', label: 'optCheapest', icon: <IndianRupee size={14} /> },
  { value: 'least-walking', label: 'optLeastWalking', icon: <Footprints size={14} /> },
  { value: 'fewest-transfers', label: 'optFewestTransfers', icon: <Repeat size={14} /> },
  { value: 'accessible', label: 'optAccessible', icon: <Accessibility size={14} /> },
  { value: 'comfortable', label: 'optComfortable', icon: <Armchair size={14} /> },
  { value: 'balanced', label: 'optBalanced', icon: <Scale size={14} /> },
]

export function OptimizeSelector({
  priorities,
  onChange,
  rainMode,
  onRainModeChange,
}: {
  priorities: OptimizeFor[]
  onChange: (v: OptimizeFor[]) => void
  rainMode: boolean
  onRainModeChange: (v: boolean) => void
}) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: true })
  const [combineOn, setCombineOn] = useState(false)
  // Voice input can select several priorities at once, which implies combine mode.
  const combine = combineOn || priorities.length > 1

  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    updateEdges()
    window.addEventListener('resize', updateEdges)
    return () => window.removeEventListener('resize', updateEdges)
  }, [updateEdges])

  function nudge(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  }

  function pick(value: OptimizeFor) {
    if (!combine) return onChange([value])
    const next = priorities.includes(value) ? priorities.filter((p) => p !== value) : [...priorities, value]
    if (next.length > 0) onChange(next)
  }

  function toggleCombine() {
    if (combine) {
      setCombineOn(false)
      onChange(priorities.slice(0, 1))
    } else setCombineOn(true)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateEdges}
          role="group"
          aria-label={t('scrollOptions')}
          className="flex flex-wrap gap-2"
        >
          {OPTIONS.map((opt) => {
            const active = priorities.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                role={combine ? 'checkbox' : 'radio'}
                aria-checked={active}
                onClick={() => pick(opt.value)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  active ? 'bg-[var(--color-ink-950)] text-white shadow-md' : 'bg-white/80 text-[var(--color-ink-800)] hover:bg-white'
                }`}
              >
                {opt.icon}
                {t(opt.label)}
              </button>
            )
          })}
        </div>
        {edge.left && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Scroll left"
            className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
        )}
        {edge.right && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Scroll right"
            className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleCombine}
          aria-pressed={combine}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
            combine
              ? 'border-[var(--color-line-teal-600)] bg-[var(--color-line-teal-600)]/10 text-[var(--color-line-teal-600)]'
              : 'border-transparent bg-white/80 text-[var(--color-ink-800)] hover:bg-white'
          }`}
        >
          <Layers size={16} aria-hidden />
          {t('combine')}
        </button>
        <button
          type="button"
          onClick={() => onRainModeChange(!rainMode)}
          aria-pressed={rainMode}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
            rainMode
              ? 'border-[var(--color-line-blue-500)] bg-[var(--color-line-blue-500)]/10 text-[var(--color-line-blue-500)]'
              : 'border-transparent bg-white/80 text-[var(--color-ink-800)] hover:bg-white'
          }`}
        >
          <CloudRain size={16} aria-hidden />
          {t('rainMode')}
        </button>
      </div>
      <p className="text-xs text-[var(--color-ink-700)]">
        {combine
          ? `${t('blending')}: ${priorities.map((p) => t(OPTIONS.find((o) => o.value === p)?.label ?? 'optFastest')).join(' + ')}. ${t('combineHint')}`
          : ''}
      </p>
    </div>
  )
}
