import { useId, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import type { Location } from '@/types'
import { searchLocations } from '@/data/chennaiLocations'

interface LocationSearchProps {
  label: string
  placeholder: string
  value: Location | null
  onChange: (location: Location | null) => void
  icon?: React.ReactNode
}

export function LocationSearch({ label, placeholder, value, onChange, icon }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const results = open ? searchLocations(query) : []

  return (
    <div className="relative">
      <label className="hero-text mb-1 block px-1 text-sm font-bold text-white" htmlFor={listId}>
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-transparent bg-white px-4 py-3.5 text-[var(--color-ink-950)] shadow-lg focus-within:border-[var(--color-primary)]">
        <span className="shrink-0 text-[var(--color-ink-700)]">{icon ?? <Search size={16} aria-hidden />}</span>
        {value && !open ? (
          <button
            type="button"
            className="flex flex-1 items-center justify-between text-left text-sm"
            onClick={() => {
              setQuery('')
              setOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <span>
              <span className="font-medium text-[var(--color-ink-950)]">{value.name}</span>
              <span className="ml-1.5 text-[var(--color-ink-700)]">{value.area}</span>
            </span>
          </button>
        ) : (
          <input
            id={listId}
            ref={inputRef}
            type="text"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-700)]"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-listbox`}
          />
        )}
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              onChange(null)
              setQuery('')
              setOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className="shrink-0 rounded-full p-1 text-[var(--color-ink-700)] hover:bg-black/5"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-2xl bg-white py-1.5 text-[var(--color-ink-950)] shadow-[var(--shadow-soft)]"
          >
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--color-ink-700)]">No matching stops or areas</li>
            )}
            {results.map((loc) => (
              <li key={loc.id} role="option" aria-selected={value?.id === loc.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(loc)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/5"
                >
                  <MapPin size={15} className="shrink-0 text-[var(--color-line-teal-600)]" aria-hidden />
                  <span>
                    <span className="font-bold text-[var(--color-ink-950)]">{loc.name}</span>
                    <span className="ml-1.5 text-[var(--color-ink-700)]">{loc.area}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
