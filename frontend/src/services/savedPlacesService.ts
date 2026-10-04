import type { SavedPlace, PlaceKind } from '@/types'
import { CHENNAI_LOCATIONS } from '@/data/chennaiLocations'

const STORAGE_KEY = 'nammaroute.savedPlaces.v1'

export interface SavedPlacesService {
  list(): Promise<SavedPlace[]>
  upsert(kind: PlaceKind, label: string, locationId: string): Promise<SavedPlace>
  remove(id: string): Promise<void>
}

function readAll(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDefaults()
    return JSON.parse(raw) as SavedPlace[]
  } catch {
    return seedDefaults()
  }
}

function writeAll(places: SavedPlace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places))
  } catch {
    // Storage unavailable (private browsing, quota) — fail silently, in
    // keeping with a demo-first, non-blocking UX.
  }
}

function seedDefaults(): SavedPlace[] {
  const home = CHENNAI_LOCATIONS.find((l) => l.id === 'loc-velachery')!
  const work = CHENNAI_LOCATIONS.find((l) => l.id === 'loc-sholinganallur')!
  const seeded: SavedPlace[] = [
    { id: 'place-home', kind: 'home', label: 'Home', location: home, createdAt: new Date().toISOString() },
    { id: 'place-work', kind: 'work', label: 'Work', location: work, createdAt: new Date().toISOString() },
  ]
  writeAll(seeded)
  return seeded
}

// Swap this implementation for a Supabase-backed one later; the interface
// above stays identical.
class LocalSavedPlacesService implements SavedPlacesService {
  async list(): Promise<SavedPlace[]> {
    return readAll()
  }

  async upsert(kind: PlaceKind, label: string, locationId: string): Promise<SavedPlace> {
    const location = CHENNAI_LOCATIONS.find((l) => l.id === locationId)
    if (!location) throw new Error('Unknown location')
    const places = readAll()
    const existingIdx = kind !== 'custom' ? places.findIndex((p) => p.kind === kind) : -1
    const place: SavedPlace = {
      id: existingIdx >= 0 ? places[existingIdx].id : `place-${crypto.randomUUID()}`,
      kind,
      label,
      location,
      createdAt: new Date().toISOString(),
    }
    if (existingIdx >= 0) {
      places[existingIdx] = place
    } else {
      places.push(place)
    }
    writeAll(places)
    return place
  }

  async remove(id: string): Promise<void> {
    writeAll(readAll().filter((p) => p.id !== id))
  }
}

export const savedPlacesService: SavedPlacesService = new LocalSavedPlacesService()
