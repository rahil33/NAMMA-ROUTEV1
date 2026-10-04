import type { Location } from '@/types'

export type StationKind = 'metro' | 'rail' | 'bus'

/** Station/stop type of a location, or null for an ordinary place. Uses `kind` when set, else the name/area text. */
export function stationKind(loc: Pick<Location, 'name' | 'area' | 'aliases' | 'kind'>): StationKind | null {
  if (loc.kind) return loc.kind === 'place' ? null : loc.kind
  const text = `${loc.name} ${loc.area} ${(loc.aliases ?? []).join(' ')}`
  if (/\bmetro\b/i.test(text)) return 'metro'
  if (/\b(rail|railway|junction|egmore|central|station)\b/i.test(text)) return 'rail'
  if (/\b(bus|terminus|terminal|cmbt|kcbt|koyambedu|kilambakkam)\b/i.test(text)) return 'bus'
  return null
}

export const STATION_LABEL: Record<StationKind, string> = { metro: 'metro station', rail: 'railway station', bus: 'bus stop' }
