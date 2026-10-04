import type { MapStyleKind } from '@/types'

const OPTIONS: { value: MapStyleKind; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
]

export function MapStyleToggle({ value, onChange }: { value: MapStyleKind; onChange: (v: MapStyleKind) => void }) {
  return (
    <div className="glass-surface pointer-events-auto flex gap-1 rounded-full p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
            value === opt.value
              ? 'bg-[var(--color-primary)] text-[var(--color-ink-950)]'
              : 'text-[var(--color-ink-900)] hover:bg-black/5'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
