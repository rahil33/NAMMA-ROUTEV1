import type { Journey, JourneySegment, OptimizeFor, SavedJourneyRecord } from '@/types'
import { outdoorExposureMin } from '@/utils/exposure'
import { haversineKm } from '@/utils/geo'
import { formatDistance } from '@/utils/formatting'

// All values below are derived from NammaRoute's generated demo data.
// Nothing here uses live feeds, and every UI surface labels it that way.

export interface ScoreFactor {
  key: 'time' | 'fare' | 'walking' | 'transfers' | 'reliability' | 'comfort' | 'crowd'
  label: string
  value: number // 0-100, higher is better
  weight: number
  /** The underlying measured value, in plain words (e.g. "34 min"). */
  rawText: string
}

export interface JourneyScore {
  score: number
  factors: ScoreFactor[]
  explanation: string
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// Assumed reliability by mode (demo estimate, not measured punctuality).
const MODE_RELIABILITY: Record<string, number> = { metro: 92, 'suburban-rail': 78, bus: 62, auto: 70, walk: 100 }

const BASE_WEIGHTS: Record<ScoreFactor['key'], number> = {
  time: 0.22, fare: 0.14, walking: 0.12, transfers: 0.12, reliability: 0.16, comfort: 0.12, crowd: 0.12,
}

const BOOST: Record<OptimizeFor, ScoreFactor['key']> = {
  fastest: 'time', cheapest: 'fare', 'least-walking': 'walking', 'fewest-transfers': 'transfers', accessible: 'comfort', comfortable: 'comfort', balanced: 'reliability',
}

// Modelled crowding: leans on the worst leg, softened by the average (demo estimate, not live).
function crowdScore(journey: Journey): number {
  const levels = journey.segments.map((s) => s.crowdPercent).filter((n): n is number => n !== undefined)
  if (!levels.length) return 100
  const peak = Math.max(...levels)
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length
  return 100 - (0.6 * peak + 0.4 * avg)
}

export function scoreJourney(journey: Journey, optimizeFor: OptimizeFor, rainMode = false): JourneyScore {
  const transit = journey.segments.filter((s) => s.mode !== 'walk')
  // Traffic risk: share of the trip lost to modelled road congestion (up to about 25 points).
  const trafficRisk = Math.min(25, ((journey.trafficDelayMin ?? 0) / Math.max(1, journey.durationMin)) * 100)
  const reliability = transit.length
    ? transit.reduce((sum, s) => sum + (MODE_RELIABILITY[s.mode] ?? 70), 0) / transit.length -
      journey.transfers * 4 -
      trafficRisk
    : 100
  const raw: Record<ScoreFactor['key'], number> = {
    time: 100 - journey.durationMin * 1.1,
    fare: 100 - journey.fareRupees * 0.9,
    walking: 100 - journey.walkingMeters / 10,
    transfers: 100 - journey.transfers * 28,
    reliability,
    crowd: crowdScore(journey),
    comfort: 100 - outdoorExposureMin(journey) * (rainMode ? 5 : 3) - (journey.accessible ? 0 : 6),
  }
  const weights = { ...BASE_WEIGHTS }
  weights[BOOST[optimizeFor]] += 0.2
  if (rainMode) weights.comfort += 0.1
  const total = Object.values(weights).reduce((a, b) => a + b, 0)

  const labels: Record<ScoreFactor['key'], string> = {
    time: 'Time', fare: 'Fare', walking: 'Walking', transfers: 'Transfers', reliability: 'Reliability', comfort: 'Comfort', crowd: 'Crowd',
  }
  const rawText: Record<ScoreFactor['key'], string> = {
    time: `${journey.durationMin} min`,
    fare: `₹${journey.fareRupees}`,
    walking: `${Math.round(journey.walkingMeters)} m`,
    transfers: `${journey.transfers} transfer${journey.transfers === 1 ? '' : 's'}`,
    reliability: trafficRisk > 0 ? `~${journey.trafficDelayMin} min traffic delay` : 'no traffic delay',
    comfort: `${outdoorExposureMin(journey)} min outdoors`,
    crowd: journey.peakCrowdPercent !== undefined ? `${journey.peakCrowdPercent}% peak crowding` : 'no transit crowding',
  }
  const factors = (Object.keys(raw) as ScoreFactor['key'][]).map((key) => ({
    key, label: labels[key], value: clamp(raw[key]), weight: weights[key] / total, rawText: rawText[key],
  }))
  const score = clamp(factors.reduce((s, f) => s + f.value * f.weight, 0))
  const best = [...factors].sort((a, b) => b.value - a.value)[0]
  const worst = [...factors].sort((a, b) => a.value - b.value)[0]
  const explanation =
    best.key === worst.key
      ? `Balanced on ${best.label.toLowerCase()}.`
      : `Strong on ${best.label.toLowerCase()}, weakest on ${worst.label.toLowerCase()}.`
  return { score, factors, explanation }
}

export type RiskLevel = 'Comfortable' | 'Tight' | 'Risky'
export interface ConnectionRisk { level: RiskLevel; gapMin: number; at: string }

/**
 * Simulated: the demo data has no timetables, so the arrival-vs-departure gap is
 * a deterministic pseudo-gap per transfer. It is labelled simulated in the UI.
 */
export function connectionRisks(journey: Journey): ConnectionRisk[] {
  const risks: ConnectionRisk[] = []
  journey.segments.forEach((seg, i) => {
    if (i === 0 || seg.mode === 'walk' || seg.mode === 'auto') return
    const prev = journey.segments[i - 1]
    const prevTransit = prev.mode !== 'walk' ? prev : journey.segments[i - 2]
    if (!prevTransit || prevTransit.mode === 'walk') return
    const baseGap = (prevTransit.durationMin * 3 + i * 2) % 9 + 1
    // Congestion and packed platforms eat into the buffer (modelled, demo only).
    const squeeze = Math.round((prevTransit.trafficDelayMin ?? 0) / 3) + ((prevTransit.crowdPercent ?? 0) >= 80 ? 1 : 0)
    const gapMin = Math.max(1, baseGap - squeeze)
    risks.push({ level: gapMin >= 6 ? 'Comfortable' : gapMin >= 3 ? 'Tight' : 'Risky', gapMin, at: seg.from })
  })
  return risks
}

export function worstRisk(risks: ConnectionRisk[]): RiskLevel | null {
  if (risks.length === 0) return null
  if (risks.some((r) => r.level === 'Risky')) return 'Risky'
  if (risks.some((r) => r.level === 'Tight')) return 'Tight'
  return 'Comfortable'
}

export type Confidence = 'High' | 'Medium' | 'Limited'
/** Demo routes contain no live feeds, so confidence is honestly capped at Limited. */
export function journeyConfidence(now = new Date()): { level: Confidence; reason: string; source: string; lastUpdated: Date } {
  return {
    level: 'Limited',
    reason: 'Built entirely from simulated demo data. No live vehicle or timetable feed is used.',
    source: 'Simulated demo data (modelled traffic and crowding)',
    lastUpdated: now,
  }
}

function plural(n: number, word: string) { return `${n} ${word}${n === 1 ? '' : 's'}` }

/** "Ride Metro for 12 min → Walk 180m → Platform 2 → Board Metro" */
export function nextActionText(journey: Journey, index: number): string {
  const steps: string[] = []
  const cur: JourneySegment | undefined = journey.segments[index]
  if (!cur) return 'You have arrived.'
  if (cur.mode === 'walk') steps.push(`Walk ${formatDistance(cur.distanceMeters ?? 0)} to ${cur.to}`)
  else if (cur.mode === 'auto') steps.push(`Take an auto to ${cur.to}`)
  else steps.push(`Get off in ${plural(Math.max(1, Math.round(cur.durationMin / 3)), 'stop')} at ${cur.to}`)
  const next = journey.segments[index + 1]
  if (next) {
    if (next.mode === 'walk') steps.push(`Walk ${formatDistance(next.distanceMeters ?? 0)}`)
    if (next.platform) steps.push(next.platform)
    if (next.mode !== 'walk') steps.push(`Board ${next.lineName ?? next.mode}`)
  } else steps.push(`Arrive at ${journey.destination.name}`)
  return steps.join(' → ')
}

export const ARRIVAL_BUFFER_MIN = 8

export function leaveNowPlan(journey: Journey, now = new Date()) {
  const depart = new Date(Math.ceil((now.getTime() + 5 * 60000) / 300000) * 300000)
  const arrive = new Date(depart.getTime() + journey.durationMin * 60000)
  return { depart, arrive, minutesUntil: Math.max(0, Math.round((depart.getTime() - now.getTime()) / 60000)) }
}

export function commuteMemory(records: SavedJourneyRecord[]) {
  const groups = new Map<string, SavedJourneyRecord[]>()
  for (const r of records) {
    const key = `${r.journey.origin.id}|${r.journey.destination.id}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const top = [...groups.values()].sort((a, b) => b.length - a.length)[0]
  if (!top || top.length < 2) return null
  const mins = top.map((r) => { const d = new Date(r.searchedAt); return d.getHours() * 60 + d.getMinutes() }).sort((a, b) => a - b)
  const mid = mins[Math.floor(mins.length / 2)]
  const [latest, ...earlier] = top
  const avgEarlier = earlier.reduce((s, r) => s + r.journey.durationMin, 0) / earlier.length
  return {
    from: latest.journey.origin.name,
    to: latest.journey.destination.name,
    usualTime: `${((mid / 60) | 0) % 12 || 12}:${String(mid % 60).padStart(2, '0')} ${mid >= 720 ? 'PM' : 'AM'}`,
    minutesFaster: Math.round(avgEarlier - latest.journey.durationMin),
  }
}

/** Monthly totals. CO2 and savings are rough estimates, not measurements. */
export function passengerInsights(records: SavedJourneyRecord[], now = new Date()) {
  const month = records.filter((r) => {
    const d = new Date(r.searchedAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const km = month.reduce((s, r) => s + haversineKm(r.journey.origin, r.journey.destination), 0)
  const autoCost = month.reduce((s, r) => s + 30 + haversineKm(r.journey.origin, r.journey.destination) * 17, 0)
  const spent = month.reduce((s, r) => s + r.journey.fareRupees, 0)
  return {
    journeys: month.length,
    km: Math.round(km * 10) / 10,
    walkMeters: Math.round(month.reduce((s, r) => s + r.journey.walkingMeters, 0)),
    savedRupees: Math.max(0, Math.round(autoCost - spent)),
    co2Kg: Math.round(km * 0.1 * 10) / 10,
  }
}
