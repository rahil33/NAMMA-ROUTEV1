import type { Journey } from '@/types'
import { offsetPoint, pointAlong } from '@/utils/routePath'

export type PoiCategory = 'bus-stop' | 'station' | 'food' | 'atm' | 'hospital' | 'restroom'

export interface Poi {
  id: string
  category: PoiCategory
  name: string
  lng: number
  lat: number
  offRouteMeters: number
}

export const POI_CATEGORIES: { id: PoiCategory; emoji: string }[] = [
  { id: 'bus-stop', emoji: '🚏' },
  { id: 'station', emoji: '🚉' },
  { id: 'food', emoji: '🍽️' },
  { id: 'atm', emoji: '🏧' },
  { id: 'hospital', emoji: '🏥' },
  { id: 'restroom', emoji: '🚻' },
]

/** Contract for "search along the route". Swap for an Overpass / Places-backed service later. */
export interface PoiService {
  searchAlongRoute(journey: Journey, categories: PoiCategory[]): Poi[]
}

const FRACTIONS = [0.12, 0.35, 0.6, 0.85]
const GENERIC_NAME: Record<'food' | 'atm' | 'hospital' | 'restroom', string> = {
  food: 'Tiffin stall',
  atm: 'ATM',
  hospital: 'Clinic',
  restroom: 'Public restroom',
}

class DemoPoiService implements PoiService {
  searchAlongRoute(journey: Journey, categories: PoiCategory[]): Poi[] {
    const path = journey.segments.flatMap((s) => s.polyline)
    const pois: Poi[] = []
    for (const category of categories) {
      if (category === 'bus-stop' || category === 'station') {
        const modes = category === 'bus-stop' ? ['bus'] : ['metro', 'suburban-rail']
        const seen = new Set<string>()
        for (const seg of journey.segments) {
          if (!modes.includes(seg.mode) || seg.polyline.length === 0) continue
          const ends = [
            { name: seg.from, at: seg.polyline[0] },
            { name: seg.to, at: seg.polyline[seg.polyline.length - 1] },
          ]
          for (const { name, at } of ends) {
            if (seen.has(name)) continue
            seen.add(name)
            pois.push({ id: `${category}-${name}`, category, name, lng: at[0], lat: at[1], offRouteMeters: 0 })
          }
        }
        continue
      }
      const shift = POI_CATEGORIES.findIndex((c) => c.id === category) * 0.02
      FRACTIONS.forEach((fraction, i) => {
        const spot = pointAlong(path, fraction + shift)
        if (!spot) return
        const meters = (i % 2 === 0 ? 1 : -1) * (45 + i * 20)
        const [lng, lat] = offsetPoint(spot.point, spot.next, meters)
        pois.push({
          id: `${category}-${i}`,
          category,
          name: `${GENERIC_NAME[category]} ${i + 1} (demo)`,
          lng,
          lat,
          offRouteMeters: Math.abs(meters),
        })
      })
    }
    return pois
  }
}

export const poiService: PoiService = new DemoPoiService()
