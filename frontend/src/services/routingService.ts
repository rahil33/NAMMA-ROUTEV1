import type { Journey, JourneySearchParams } from '@/types'
import { generateDemoJourneys } from '@/data/mockJourneys'
import { outdoorExposureMin } from '@/utils/exposure'
import { loadRoutes, saveRoutes } from '@/services/offlineCache'
import { rankJourneys } from '@/utils/routeRanking'
import { attachComfort } from '@/services/roadConditionService'
import { planLiveTransit, transitStatus } from '@/services/transitService'

/**
 * Contract the UI depends on. A future implementation backed by
 * OpenTripPlanner / OpenRouteService should satisfy this same interface so
 * pages never need to change.
 */
export interface RoutingService {
  planJourney(params: JourneySearchParams): Promise<Journey[]>
}

const DEMO_LATENCY_MS = 420
const MINUTE_MS = 60000

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shiftToArrival(journey: Journey, arriveBy: Date): Journey {
  const departAt = new Date(arriveBy.getTime() - journey.durationMin * MINUTE_MS)
  return { ...journey, departAt: departAt.toISOString(), arriveAt: arriveBy.toISOString() }
}

const wantsComfort = (p: JourneySearchParams) => {
  const set = p.preference.priorities?.length ? p.preference.priorities : [p.preference.optimizeFor]
  return set.includes('comfortable') || set.includes('balanced')
}

/**
 * Uses a configured live planner (OpenTripPlanner via the API) when one exists. Otherwise, or when it is
 * unreachable, the existing demo generator is used and the results say so (`source`, `dataNotice`).
 */
class AppRoutingService implements RoutingService {
  async planJourney(params: JourneySearchParams): Promise<Journey[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = loadRoutes(params.origin.id, params.destination.id)
      if (cached) return this.finish(cached, params)
    }

    let journeys: Journey[] | null = null
    let notice: string | undefined
    const status = await transitStatus()
    if (status?.planner === 'otp') {
      try {
        const live = await planLiveTransit(params)
        if (live.length) journeys = live
        else notice = 'The live transit planner found no routes for this trip, so demo estimates are shown.'
      } catch {
        notice = 'Live transit data is unavailable right now, so demo estimates are shown.'
      }
    }
    if (!journeys) {
      await wait(DEMO_LATENCY_MS)
      const base = new Date(params.arriveBy ?? params.departAt)
      journeys = generateDemoJourneys(params.origin, params.destination, base).map((j) => ({ ...j, source: 'demo' as const, dataNotice: notice }))
      if (params.arriveBy) {
        const arriveBy = new Date(params.arriveBy)
        journeys = journeys.map((j) => shiftToArrival(j, arriveBy))
      }
    }
    saveRoutes(params.origin.id, params.destination.id, journeys)
    return this.finish(journeys, params)
  }

  private async finish(input: Journey[], params: JourneySearchParams): Promise<Journey[]> {
    const journeys = wantsComfort(params) && typeof navigator !== 'undefined' && navigator.onLine ? await attachComfort(input) : input
    const ranked = rankJourneys(journeys, params.preference)
    if (!params.preference.rainMode) return ranked

    // A route is only called rain-friendly when it is genuinely less exposed than
    // the route the user would have been shown first without Rain Mode.
    const baseline = rankJourneys(journeys, { ...params.preference, rainMode: false })[0]
    const baselineExposure = outdoorExposureMin(baseline)
    return ranked.map((j) => ({ ...j, rainOptimized: outdoorExposureMin(j) < baselineExposure }))
  }
}

export const routingService: RoutingService = new AppRoutingService()
