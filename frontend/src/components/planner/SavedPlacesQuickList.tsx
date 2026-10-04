import { Bookmark, Briefcase, GraduationCap, Home as HomeIcon } from 'lucide-react'
import type { SavedPlace, PlaceKind } from '@/types'

const KIND_ICON: Record<PlaceKind, React.ReactNode> = {
  home: <HomeIcon size={14} />,
  work: <Briefcase size={14} />,
  college: <GraduationCap size={14} />,
  custom: <Bookmark size={14} />,
}

export function SavedPlacesQuickList({ places, onSelect }: { places: SavedPlace[]; onSelect: (place: SavedPlace) => void }) {
  if (places.length === 0) return null

  return (
    <section aria-labelledby="saved-places-heading">
      <h2 id="saved-places-heading" className="mb-3 flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
        <Bookmark size={15} aria-hidden />
        Saved places
      </h2>
      <div className="flex flex-wrap gap-2">
        {places.map((place) => (
          <button
            key={place.id}
            onClick={() => onSelect(place)}
            className="flex items-center gap-1.5 rounded-full bg-white/85 px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-white"
          >
            <span className="text-[var(--color-line-teal-600)]">{KIND_ICON[place.kind]}</span>
            {place.label}
          </button>
        ))}
      </div>
    </section>
  )
}
