import type { Journey, Location } from '@/types'
import { generateDemoJourneys } from '@/data/mockJourneys'
import { ARRIVAL_BUFFER_MIN } from '@/utils/commuterIntel'

// Deterministic "best time to leave" engine. It re-plans the same trip at
// several departure times using the modelled traffic and crowd estimates
// (demo data, not live) and compares them. No randomness, no AI.

export interface DepartureSlot {
  departAt: Date
  arriveAt: Date
  durationMin: number
  peakCrowdPercent: number
  trafficDelayMin: number
  journey: Journey
  cost: number // lower is better
}

export interface DepartureAdvice {
  slots: DepartureSlot[]
  best: DepartureSlot
  leaveNow: DepartureSlot
  /** Minutes saved by waiting for the best slot instead of leaving now (0 if now is best). */
  savingMin: number
  /** Minutes to wait from now until the best slot. */
  waitMin: number
  reason: string
  /** Present only when an arrival target was given. */
  arriveBy?: { target: Date; meetsTarget: boolean; latestDeparture?: DepartureSlot }
}

const STEP_MIN = 10
const WINDOW_MIN = 90
const CROWD_WEIGHT = 0.12 // one crowd point costs about 0.12 minutes of comfort

function roundUp5(d: Date): Date {
  return new Date(Math.ceil(d.getTime() / 300000) * 300000)
}

function cheapestForSlot(origin: Location, destination: Location, departAt: Date): DepartureSlot {
  let best: DepartureSlot | undefined
  for (const j of generateDemoJourneys(origin, destination, departAt)) {
    const crowd = j.peakCrowdPercent ?? 0
    const cost = j.durationMin + crowd * CROWD_WEIGHT
    if (!best || cost < best.cost) {
      best = {
        departAt,
        arriveAt: new Date(j.arriveAt),
        durationMin: j.durationMin,
        peakCrowdPercent: crowd,
        trafficDelayMin: j.trafficDelayMin ?? 0,
        journey: j,
        cost,
      }
    }
  }
  return best as DepartureSlot
}

export function adviseDeparture(
  origin: Location,
  destination: Location,
  opts: { now?: Date; arriveBy?: Date; bufferMin?: number } = {},
): DepartureAdvice {
  const now = opts.now ?? new Date()
  const start = roundUp5(new Date(now.getTime() + 5 * 60000))
  const slots: DepartureSlot[] = []
  for (let m = 0; m <= WINDOW_MIN; m += STEP_MIN) {
    slots.push(cheapestForSlot(origin, destination, new Date(start.getTime() + m * 60000)))
  }
  const leaveNow = slots[0]
  let best = slots.reduce((a, b) => (b.cost < a.cost - 1 ? b : a), slots[0]) // ties favour leaving earlier

  let arriveBy: DepartureAdvice['arriveBy']
  if (opts.arriveBy) {
    const limit = opts.arriveBy.getTime() - (opts.bufferMin ?? ARRIVAL_BUFFER_MIN) * 60000
    // Scan departures in the two hours before the latest workable one, so far-off targets still work.
    const first = Math.max(start.getTime(), limit - 120 * 60000)
    const target: DepartureSlot[] = []
    for (let t = first; t <= limit; t += STEP_MIN * 60000) target.push(cheapestForSlot(origin, destination, new Date(t)))
    const onTime = target.filter((s) => s.arriveAt.getTime() <= limit)
    const latest = onTime.length ? onTime.reduce((a, b) => (b.departAt > a.departAt ? b : a)) : undefined
    arriveBy = { target: opts.arriveBy, meetsTarget: !!latest, latestDeparture: latest }
    if (onTime.length) {
      // Leave as late as is safe, unless a slightly earlier one is clearly less congested or crowded.
      const minCost = Math.min(...onTime.map((s) => s.cost))
      best = onTime.filter((s) => s.cost <= minCost + 3).reduce((a, b) => (b.departAt > a.departAt ? b : a))
    }
  }

  const savingMin = Math.max(0, Math.round(leaveNow.arriveAt.getTime() - best.arriveAt.getTime()) / 60000)
  const waitMin = Math.round((best.departAt.getTime() - start.getTime()) / 60000) + 5
  const crowdDrop = leaveNow.peakCrowdPercent - best.peakCrowdPercent

  let reason: string
  if (best === leaveNow) reason = 'Leaving now is as good as it gets in the next 90 minutes (modelled).'
  else if (savingMin >= 3) reason = `Waiting ${waitMin} min gets you there about ${Math.round(savingMin)} min earlier, as road traffic eases (modelled).`
  else if (crowdDrop >= 15) reason = `Waiting ${waitMin} min avoids the busiest crowding, with a similar arrival time (modelled).`
  else reason = 'Little difference between leaving now and later (modelled).'

  return { slots, best, leaveNow, savingMin: Math.round(savingMin), waitMin: Math.max(0, waitMin), reason, arriveBy }
}
