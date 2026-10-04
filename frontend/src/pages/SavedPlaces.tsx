import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Briefcase, GraduationCap, Home as HomeIcon, Repeat, Route, Trash2 } from 'lucide-react'
import type { PlaceKind, SavedJourneyRecord } from '@/types'
import { Button } from '@/components/common/Button'
import { CHENNAI_LOCATIONS } from '@/data/chennaiLocations'
import { useSavedPlaces } from '@/hooks/useSavedPlaces'
import { useJourneyHistory } from '@/hooks/useJourneyHistory'
import { useJourney } from '@/context/journey'
import { usePreferences } from '@/context/preferences'
import { formatClock, formatDuration, formatFare } from '@/utils/formatting'

const KIND_OPTIONS: { value: PlaceKind; label: string; icon: React.ReactNode }[] = [
  { value: 'home', label: 'Home', icon: <HomeIcon size={16} /> },
  { value: 'college', label: 'College', icon: <GraduationCap size={16} /> },
  { value: 'work', label: 'Work', icon: <Briefcase size={16} /> },
  { value: 'custom', label: 'Custom', icon: <Bookmark size={16} /> },
]

export function SavedPlaces() {
  const navigate = useNavigate()
  const { places, savePlace, removePlace } = useSavedPlaces()
  const { records, remove } = useJourneyHistory()
  const { search, openJourney } = useJourney()
  const { preferences } = usePreferences()

  const [kind, setKind] = useState<PlaceKind>('home')
  const [label, setLabel] = useState('')
  const [locationId, setLocationId] = useState(CHENNAI_LOCATIONS[0].id)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const finalLabel = label.trim() || KIND_OPTIONS.find((o) => o.value === kind)!.label
    await savePlace(kind, finalLabel, locationId)
    setLabel('')
  }

  function open(record: SavedJourneyRecord) {
    openJourney(record.journey)
    navigate('/details')
  }

  async function repeat(record: SavedJourneyRecord) {
    await search({
      origin: record.journey.origin,
      destination: record.journey.destination,
      departAt: new Date().toISOString(),
      preference: {
        optimizeFor: preferences.optimizeFor,
        priorities: preferences.priorities,
        rainMode: preferences.rainMode,
        budgetRupees: preferences.budgetRupees,
        accessibility: preferences.accessibility,
      },
    })
    navigate('/results')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 sm:py-10">
      <section aria-labelledby="places-heading">
        <h1 id="places-heading" className="mb-3 text-3xl font-extrabold tracking-tight">
          Saved places
        </h1>
        {places.length === 0 && <p className="text-sm text-[var(--color-ink-700)]">No saved places yet. Add Home, College, Work or your own below.</p>}
        <ul className="flex flex-col gap-2">
          {places.map((place) => (
            <li key={place.id} className="flex items-center justify-between gap-2 soft-card rounded-3xl px-4 py-3.5">
              <span className="flex items-center gap-2.5 text-sm">
                <span className="text-[var(--color-line-teal-600)]">{KIND_OPTIONS.find((o) => o.value === place.kind)?.icon}</span>
                <span>
                  <span className="font-medium">{place.label}</span>
                  <span className="ml-1.5 text-[var(--color-ink-700)]">{place.location.name}</span>
                </span>
              </span>
              <button
                aria-label={`Delete ${place.label}`}
                onClick={() => removePlace(place.id)}
                className="rounded-full p-1.5 text-[var(--color-ink-700)] hover:bg-black/5"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSave} className="soft-card mt-4 flex flex-col gap-3 rounded-[var(--radius-sheet)] p-5">
          <h2 className="text-sm font-semibold">Add or update a place</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Place type">
            {KIND_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                role="radio"
                aria-checked={kind === opt.value}
                onClick={() => setKind(opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-full border px-2 py-2.5 text-sm font-semibold ${
                  kind === opt.value
                    ? 'border-[var(--color-line-teal-600)] bg-[var(--color-line-teal-600)]/10 text-[var(--color-line-teal-600)]'
                    : 'border-black/10 bg-white/60'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          {kind === 'custom' && (
            <input
              aria-label="Place name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name, e.g. Gym"
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm"
            />
          )}
          <select
            aria-label="Location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm"
          >
            {CHENNAI_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.area}
              </option>
            ))}
          </select>
          <Button type="submit">Save place</Button>
        </form>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-xl font-extrabold tracking-tight">
          Journey history
        </h2>
        {records.length === 0 && <p className="text-sm text-[var(--color-ink-700)]">Searched and completed journeys appear here.</p>}
        <ul className="flex flex-col gap-2">
          {records.map((record) => (
            <li key={record.id} className="soft-card rounded-3xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium">{record.journey.origin.name}</span> →{' '}
                  <span className="font-medium">{record.journey.destination.name}</span>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-700)]">
                    {record.status === 'completed' ? 'Completed' : 'Searched'} {new Date(record.searchedAt).toLocaleDateString('en-IN')}{' '}
                    {formatClock(record.searchedAt)} · {formatDuration(record.journey.durationMin)} · {formatFare(record.journey.fareRupees)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => open(record)}>
                  <Route size={14} aria-hidden />
                  Open
                </Button>
                <Button size="sm" variant="secondary" onClick={() => repeat(record)}>
                  <Repeat size={14} aria-hidden />
                  Repeat
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(record.id)}>
                  <Trash2 size={14} aria-hidden />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
