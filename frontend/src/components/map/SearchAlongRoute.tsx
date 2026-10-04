import { useState } from 'react'
import { Search } from 'lucide-react'
import { POI_CATEGORIES, type PoiCategory } from '@/services/poiService'
import { useT } from '@/i18n/useT'
import type { MessageKey } from '@/i18n/messages'

const LABEL: Record<PoiCategory, MessageKey> = {
  'bus-stop': 'poiBusStop',
  station: 'poiStation',
  food: 'poiFood',
  atm: 'poiAtm',
  hospital: 'poiHospital',
  restroom: 'poiRestroom',
}

export function SearchAlongRoute({ active, onChange }: { active: PoiCategory[]; onChange: (v: PoiCategory[]) => void }) {
  const t = useT()
  const [query, setQuery] = useState('')

  function toggle(id: PoiCategory) {
    onChange(active.includes(id) ? active.filter((c) => c !== id) : [...active, id])
  }

  function submit(e: React.SyntheticEvent) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    const hits = POI_CATEGORIES.filter((c) => t(LABEL[c.id]).toLowerCase().includes(q)).map((c) => c.id)
    if (hits.length > 0) onChange(hits)
    setQuery('')
  }

  return (
    <div className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-2">
      <form onSubmit={submit} role="search" className="glass-surface flex items-center gap-2 rounded-full px-4 py-2.5">
        <Search size={16} className="shrink-0 text-[var(--color-ink-700)]" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchAlong')}
          aria-label={t('searchAlong')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </form>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {POI_CATEGORIES.map((c) => {
          const on = active.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold shadow-sm ${
                on ? 'border-transparent bg-[var(--color-primary)] text-[var(--color-ink-950)]' : 'border-transparent bg-white/90 text-[var(--color-ink-900)]'
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              {t(LABEL[c.id])}
            </button>
          )
        })}
      </div>
      {active.length > 0 && <p className="w-fit rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">{t('poiDemo')}</p>}
    </div>
  )
}
