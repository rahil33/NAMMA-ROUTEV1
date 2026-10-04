import { motion } from 'framer-motion'

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-full bg-white/70 p-1.5 shadow-inner"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active ? 'text-[var(--color-ink-950)]' : 'text-[var(--color-ink-800)] hover:bg-black/5'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${label}`}
                className="absolute inset-0 rounded-full bg-[var(--color-primary)]"
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-medium text-[var(--color-ink-950)]">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-[var(--color-ink-700)]">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`absolute inset-0 rounded-full transition-colors ${
            checked ? 'bg-[var(--color-primary)]' : 'bg-black/15'
          }`}
        />
        <span
          className={`absolute h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  )
}
