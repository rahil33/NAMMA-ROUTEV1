import type { ComfortInfo, Journey } from '@/types'
import { api } from '@/services/api'
import { fetchRoadPath } from '@/services/roadRouteService'
import { assessComfort, samplePath, type CommunityReport, type OsmNode, type OsmWay } from '@/utils/comfort'

const OVERPASS = (import.meta.env.VITE_OVERPASS_URL as string | undefined) ?? 'https://overpass-api.de/api/interpreter'
const TIMEOUT_MS = 9000
const cache = new Map<string, Promise<{ ways: OsmWay[]; bumps: OsmNode[] } | null>>()

async function overpass(path: [number, number][]): Promise<{ ways: OsmWay[]; bumps: OsmNode[] } | null> {
  // `around` takes a polyline; ~150 m spacing keeps the query small while covering the whole road.
  const pts = samplePath(path, 150).slice(0, 90).map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(',')
  if (!pts) return null
  const hit = cache.get(pts)
  if (hit) return hit
  const request = (async () => {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    try {
      const q = `[out:json][timeout:12];(way["highway"](around:20,${pts});node["traffic_calming"](around:20,${pts}););out tags geom;`
      const res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal })
      if (!res.ok) return null
      const data = (await res.json()) as { elements?: { type: string; tags?: Record<string, string>; lat?: number; lon?: number; geometry?: { lat: number; lon: number }[] }[] }
      const ways: OsmWay[] = []
      const bumps: OsmNode[] = []
      for (const e of data.elements ?? []) {
        if (e.type === 'way' && e.geometry && e.tags) ways.push({ tags: e.tags, geometry: e.geometry })
        else if (e.type === 'node' && e.lat !== undefined && e.lon !== undefined) bumps.push({ lat: e.lat, lon: e.lon })
      }
      return { ways, bumps }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  })()
  cache.set(pts, request)
  // Don't keep failures: a later search may succeed.
  void request.then((r) => { if (!r) cache.delete(pts) })
  return request
}

async function communityReports(path: [number, number][]): Promise<CommunityReport[] | null> {
  const lats = path.map((p) => p[1]), lngs = path.map((p) => p[0])
  const pad = 0.0005
  const q = new URLSearchParams({ minLat: String(Math.min(...lats) - pad), minLng: String(Math.min(...lngs) - pad), maxLat: String(Math.max(...lats) + pad), maxLng: String(Math.max(...lngs) + pad) })
  try {
    return (await api<{ reports: CommunityReport[] }>(`/api/road-reports?${q}`, { timeoutMs: 6000 })).reports
  } catch {
    return null
  }
}

/** The road-following path of a journey: walking, bus and auto legs (rail/metro don't ride on roads). */
async function roadPathOf(journey: Journey): Promise<[number, number][]> {
  const coords: [number, number][] = []
  for (const seg of journey.segments) {
    if (seg.mode === 'metro' || seg.mode === 'suburban-rail') continue
    const a = seg.polyline[0]
    const b = seg.polyline[seg.polyline.length - 1]
    if (!a || !b) continue
    const road = await fetchRoadPath(seg.mode, a, b)
    coords.push(...(road?.coords ?? []))
  }
  return coords
}

async function assessOne(journey: Journey): Promise<ComfortInfo | undefined> {
  const path = await roadPathOf(journey)
  if (path.length < 2) return undefined
  const [osm, reports] = await Promise.all([overpass(path), communityReports(path)])
  return assessComfort({ path, ways: osm?.ways ?? null, bumps: osm?.bumps ?? null, reports })
}

/**
 * Attaches a road-comfort assessment to each journey. Never throws and never delays planning for long:
 * on any failure the journey simply has no `comfort`, and ranking falls back to standard routing.
 */
export async function attachComfort(journeys: Journey[], budgetMs = 12000): Promise<Journey[]> {
  const work = Promise.all(journeys.slice(0, 5).map((j) => assessOne(j).catch(() => undefined)))
  const timeout = new Promise<undefined[]>((resolve) => setTimeout(() => resolve([]), budgetMs))
  const results = (await Promise.race([work, timeout])) as (ComfortInfo | undefined)[]
  return journeys.map((j, i) => (results[i] ? { ...j, comfort: results[i] } : j))
}

export async function reportRoadIssue(kind: CommunityReport['kind'], lat: number, lng: number): Promise<void> {
  await api('/api/road-reports', { body: { kind, lat, lng } })
}
