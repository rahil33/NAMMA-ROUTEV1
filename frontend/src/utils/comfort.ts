import type { ComfortInfo } from '@/types'

// Road-comfort scoring from real, queryable data only:
//  - OpenStreetMap tags on the roads along the path (surface, smoothness, steps, construction)
//  - OpenStreetMap traffic_calming nodes (speed bumps / humps / tables)
//  - community reports submitted through this app
// Satellite imagery is NOT used: it cannot reliably show live potholes. Where OSM carries little
// surface data, `coverage` is low and the result is marked `limited` so the UI and ranking say so.

export interface OsmWay { tags: Record<string, string>; geometry: { lat: number; lon: number }[] }
export interface OsmNode { lat: number; lon: number }
export interface CommunityReport { lat: number; lng: number; kind: 'pothole' | 'speed-breaker' | 'rough-road' | 'closure' | 'waterlogging' }

const ROUGH_SMOOTHNESS = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'])
const ROUGH_SURFACE = new Set(['unpaved', 'dirt', 'gravel', 'ground', 'sand', 'mud', 'earth', 'grass', 'cobblestone', 'sett', 'pebblestone', 'compacted', 'fine_gravel', 'unhewn_cobblestone'])

const M_PER_DEG = 111_320
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dx = (aLng - bLng) * M_PER_DEG * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180))
  const dy = (aLat - bLat) * M_PER_DEG
  return Math.hypot(dx, dy)
}
function distToSegmentM(pLat: number, pLng: number, a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const k = Math.cos(pLat * (Math.PI / 180))
  const ax = (a.lon - pLng) * M_PER_DEG * k, ay = (a.lat - pLat) * M_PER_DEG
  const bx = (b.lon - pLng) * M_PER_DEG * k, by = (b.lat - pLat) * M_PER_DEG
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

export interface Sample { lat: number; lng: number; stepM: number }

/** Points roughly every `stepM` metres along a [lng, lat] path. Each carries the distance it represents. */
export function samplePath(coords: [number, number][], stepM = 40): Sample[] {
  if (coords.length < 2) return []
  const out: Sample[] = []
  let carry = 0
  let last = coords[0]
  out.push({ lat: last[1], lng: last[0], stepM: 0 })
  for (let i = 1; i < coords.length; i++) {
    let d = distM(last[1], last[0], coords[i][1], coords[i][0])
    while (carry + d >= stepM) {
      const f = (stepM - carry) / d
      last = [last[0] + (coords[i][0] - last[0]) * f, last[1] + (coords[i][1] - last[1]) * f]
      out.push({ lat: last[1], lng: last[0], stepM })
      d = distM(last[1], last[0], coords[i][1], coords[i][0])
      carry = 0
    }
    carry += d
    last = coords[i]
  }
  return out
}

export interface AssessInput {
  path: [number, number][]
  /** null = the OSM lookup failed; [] = it succeeded and found nothing. */
  ways: OsmWay[] | null
  bumps: OsmNode[] | null
  reports: CommunityReport[] | null
}

export function assessComfort({ path, ways, bumps, reports }: AssessInput): ComfortInfo | undefined {
  if (ways === null && bumps === null && reports === null) return undefined
  const samples = samplePath(path)
  const totalM = samples.reduce((s, p) => s + p.stepM, 0)
  if (totalM === 0) return undefined

  const sources: string[] = []
  const notes: string[] = []
  let knownM = 0, roughM = 0, stepsM = 0, constructionHits = 0

  if (ways) {
    sources.push('OpenStreetMap road tags')
    let lastConstruction = ''
    for (const s of samples) {
      let best: OsmWay | null = null
      let bestD = 20 // metres
      for (const w of ways) {
        for (let i = 1; i < w.geometry.length; i++) {
          const d = distToSegmentM(s.lat, s.lng, w.geometry[i - 1], w.geometry[i])
          if (d < bestD) { bestD = d; best = w }
        }
      }
      if (!best) continue
      const { surface, smoothness, highway } = best.tags
      if (surface || smoothness) {
        knownM += s.stepM
        if ((smoothness && ROUGH_SMOOTHNESS.has(smoothness)) || (surface && ROUGH_SURFACE.has(surface))) roughM += s.stepM
      }
      if (highway === 'steps') stepsM += s.stepM
      if (highway === 'construction' || best.tags.access === 'no') {
        const key = `${best.geometry[0]?.lat},${best.geometry[0]?.lon}`
        if (key !== lastConstruction) constructionHits += 1
        lastConstruction = key
      }
    }
  } else {
    notes.push('Road-surface data could not be loaded.')
  }

  let speedBumps = 0
  if (bumps) {
    if (!sources.includes('OpenStreetMap road tags')) sources.push('OpenStreetMap road tags')
    const kept: OsmNode[] = []
    for (const n of bumps) {
      if (samples.some((s) => distM(s.lat, s.lng, n.lat, n.lon) <= 25) && !kept.some((k) => distM(k.lat, k.lon, n.lat, n.lon) < 12)) kept.push(n)
    }
    speedBumps = kept.length
  }

  let communityReports = 0
  let closures = 0
  if (reports) {
    sources.push('Community reports')
    for (const r of reports) {
      if (!samples.some((s) => distM(s.lat, s.lng, r.lat, r.lng) <= 30)) continue
      if (r.kind === 'closure') closures += 1
      else communityReports += 1
    }
  }

  const coverage = Math.min(1, knownM / totalM)
  const limited = coverage < 0.3
  const roughShare = roughM / totalM

  const score = Math.round(
    Math.max(
      0,
      100 -
        Math.min(30, speedBumps * 3) -
        Math.min(40, roughShare * 100 * 1.5) -
        Math.min(30, communityReports * 5) -
        Math.min(20, (stepsM / totalM) * 100 * 2) -
        (closures + constructionHits > 0 ? 15 : 0),
    ),
  )

  if (limited) notes.push('Limited road-condition data along this route, so the score is only indicative.')
  if (speedBumps) notes.push(`${speedBumps} mapped speed bump${speedBumps > 1 ? 's' : ''}.`)
  if (roughM > 0) notes.push(`About ${Math.round(roughM)} m of rough or unpaved surface.`)
  if (communityReports) notes.push(`${communityReports} recent community report${communityReports > 1 ? 's' : ''} of potholes or rough road.`)
  if (stepsM > 0) notes.push('Includes steps, which are hard with limited mobility.')
  if (closures + constructionHits > 0) notes.push('A closure or construction is reported near the route. Live road-closure feeds are not connected.')
  if (!notes.length) notes.push('No issues found in the data we have.')

  return { score, coverage: Math.round(coverage * 100) / 100, limited, speedBumps, roughMeters: Math.round(roughM), communityReports, sources, notes }
}
