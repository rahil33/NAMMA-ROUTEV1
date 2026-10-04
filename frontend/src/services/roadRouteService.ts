import { useEffect, useRef, useState } from 'react'
import type { Journey, TransportMode } from '@/types'

// Road-following geometry and turn-by-turn steps from public OSM routing servers (needs network in the browser).
// Metro and rail keep their own line; if a request fails the mock polyline is used, so the map never breaks.
export interface TurnStep {
  text: string
  location: [number, number]
  distance: number
  rotation: number
  isTurn: boolean
}
export interface RoadPath {
  coords: [number, number][]
  steps: TurnStep[]
}

const cache = new Map<string, Promise<RoadPath | null>>()
export const pathKey = (journeyId: string, segmentId: string) => `${journeyId}|${segmentId}`

const ROTATION: Record<string, number> = {
  left: -90, 'slight left': -45, 'sharp left': -135, right: 90, 'slight right': 45, 'sharp right': 135, uturn: 180, straight: 0,
}

function describe(type: string, modifier: string | undefined, name: string): string {
  const on = name ? ` onto ${name}` : ''
  if (type === 'depart') return name ? `Start on ${name}` : 'Start'
  if (type === 'arrive') return 'Arrive at your stop'
  if (type === 'roundabout' || type === 'rotary') return `Enter the roundabout${on}`
  if (modifier === 'uturn') return 'Make a U-turn'
  if (!modifier || modifier === 'straight' || type === 'continue') return name ? `Continue on ${name}` : 'Continue straight'
  if (modifier.startsWith('slight')) return `Bear ${modifier.replace('slight ', '')}${on}`
  return `Turn ${modifier}${on}`
}

interface OsrmStep { distance: number; name: string; maneuver: { type: string; modifier?: string; location: [number, number] } }

export function fetchRoadPath(mode: TransportMode, a: [number, number], b: [number, number]): Promise<RoadPath | null> {
  const walk = mode === 'walk'
  const base = walk ? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot' : 'https://routing.openstreetmap.de/routed-car/route/v1/driving'
  const url = `${base}/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson&steps=true`
  const hit = cache.get(url)
  if (hit) return hit
  const request = (async () => {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 9000)
    try {
      const res = await fetch(url, { signal: ctl.signal })
      if (!res.ok) return null
      const data = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] }
      const route = data.routes?.[0]
      if (!route || route.geometry.coordinates.length < 2) return null
      const steps = route.legs.flatMap((l) => l.steps).map<TurnStep>((s) => ({
        text: describe(s.maneuver.type, s.maneuver.modifier, s.name),
        location: s.maneuver.location,
        distance: s.distance,
        rotation: ROTATION[s.maneuver.modifier ?? 'straight'] ?? 0,
        isTurn: s.maneuver.type !== 'depart' && s.maneuver.type !== 'arrive' && s.maneuver.modifier !== undefined && s.maneuver.modifier !== 'straight',
      }))
      return { coords: route.geometry.coordinates, steps }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  })()
  cache.set(url, request)
  return request
}

/** Road geometry + turns for every walking/bus/auto segment of the given journeys, keyed by pathKey(). */
export function useRoadPaths(journeys: Journey[]): Record<string, RoadPath> {
  const [paths, setPaths] = useState<Record<string, RoadPath>>({})
  const latest = useRef(journeys)
  useEffect(() => {
    latest.current = journeys
  })
  const ids = journeys.map((j) => j.id).join('|')
  useEffect(() => {
    let alive = true
    for (const j of latest.current) {
      for (const seg of j.segments) {
        if (seg.mode === 'metro' || seg.mode === 'suburban-rail') continue
        const a = seg.polyline[0]
        const b = seg.polyline[seg.polyline.length - 1]
        if (!a || !b) continue
        void fetchRoadPath(seg.mode, a, b).then((p) => {
          if (alive && p) setPaths((prev) => ({ ...prev, [pathKey(j.id, seg.id)]: p }))
        })
      }
    }
    return () => {
      alive = false
    }
  }, [ids])
  return paths
}
