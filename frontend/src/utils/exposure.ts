import type { Journey } from '@/types'

const WALK_METERS_PER_MIN = 75
const BUS_WAIT_MIN = 5

/** Minutes spent exposed to the weather: walking plus waiting at open-air bus stops (demo estimate). */
export function outdoorExposureMin(journey: Journey): number {
  const busLegs = journey.segments.filter((s) => s.mode === 'bus').length
  return journey.walkingMeters / WALK_METERS_PER_MIN + busLegs * BUS_WAIT_MIN
}
