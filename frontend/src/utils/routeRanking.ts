import type { Journey, RoutePreference } from '@/types'
import { connectionRisks, worstRisk, type RiskLevel } from '@/utils/commuterIntel'
import { outdoorExposureMin } from '@/utils/exposure'

interface Weights {
  duration: number
  fare: number
  walking: number
  transfers: number
  accessibility: number
  comfort: number
}

const WEIGHTS_BY_OPTIMIZE: Record<RoutePreference['optimizeFor'], Weights> = {
  fastest: { duration: 0.85, fare: 0.0375, walking: 0.0375, transfers: 0.0375, accessibility: 0.0375, comfort: 0 },
  cheapest: { duration: 0.0375, fare: 0.85, walking: 0.0375, transfers: 0.0375, accessibility: 0.0375, comfort: 0 },
  'least-walking': { duration: 0.0375, fare: 0.0375, walking: 0.85, transfers: 0.0375, accessibility: 0.0375, comfort: 0 },
  'fewest-transfers': { duration: 0.0375, fare: 0.0375, walking: 0.0375, transfers: 0.85, accessibility: 0.0375, comfort: 0 },
  accessible: { duration: 0.1, fare: 0.05, walking: 0.1, transfers: 0.1, accessibility: 0.65, comfort: 0 },
  comfortable: { duration: 0.15, fare: 0.05, walking: 0.1, transfers: 0.1, accessibility: 0.1, comfort: 0.5 },
  balanced: { duration: 0.3, fare: 0.2, walking: 0.1, transfers: 0.1, accessibility: 0.05, comfort: 0.25 },
}

/** Averages the preset weights so several priorities are ranked together as one blended score. */
function blendWeights(priorities: RoutePreference['optimizeFor'][]): Weights {
  const total: Weights = { duration: 0, fare: 0, walking: 0, transfers: 0, accessibility: 0, comfort: 0 }
  for (const p of priorities) {
    const w = WEIGHTS_BY_OPTIMIZE[p]
    total.duration += w.duration
    total.fare += w.fare
    total.walking += w.walking
    total.transfers += w.transfers
    total.accessibility += w.accessibility
    total.comfort += w.comfort
  }
  const n = priorities.length
  return {
    duration: total.duration / n,
    fare: total.fare / n,
    walking: total.walking / n,
    transfers: total.transfers / n,
    accessibility: total.accessibility / n,
    comfort: total.comfort / n,
  }
}

const RAIN_MODE_ADJUSTMENT: Weights = { duration: -0.2, fare: -0.05, walking: 0.55, transfers: 0.1, accessibility: 0, comfort: 0 }


const RISK_SCORE: Record<RiskLevel, number> = { Comfortable: 0, Tight: 0.5, Risky: 1 }

function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0)
  return values.map((v) => (v - min) / (max - min))
}

/**
 * Ranks journeys with a deterministic weighted-score formula based on the
 * user's chosen optimize criteria, accessibility requirements and Rain Mode.
 * No model inference is involved — the same inputs always produce the same
 * ordering, which is a hackathon requirement.
 */
export function rankJourneys(journeys: Journey[], preference: RoutePreference): Journey[] {
  if (journeys.length === 0) return journeys

  const requiresWheelchair = preference.accessibility.wheelchair
  let pool = journeys
  if (requiresWheelchair) {
    const strict = journeys.filter((j) => j.accessible)
    pool = strict.length > 0 ? strict : journeys
  }

  const durationScores = normalize(pool.map((j) => j.durationMin))
  const fareScores = normalize(pool.map((j) => j.fareRupees))
  const walkScores = normalize(pool.map((j) => (preference.rainMode ? outdoorExposureMin(j) : j.walkingMeters)))
  const transferScores = normalize(pool.map((j) => j.transfers))
  const accessScores = pool.map((j) => (j.accessible ? 0 : 1))

  const base = blendWeights(preference.priorities?.length ? preference.priorities : [preference.optimizeFor])
  const weights: Weights = preference.rainMode
    ? {
        duration: Math.max(0, base.duration + RAIN_MODE_ADJUSTMENT.duration),
        fare: Math.max(0, base.fare + RAIN_MODE_ADJUSTMENT.fare),
        walking: base.walking + RAIN_MODE_ADJUSTMENT.walking,
        transfers: base.transfers + RAIN_MODE_ADJUSTMENT.transfers,
        accessibility: base.accessibility + RAIN_MODE_ADJUSTMENT.accessibility,
        comfort: base.comfort,
      }
    : { ...base }

  if (preference.accessibility.minimizeWalking) weights.walking += 0.5
  if (preference.accessibility.minimizeTransfers) weights.transfers += 0.5
  if (preference.accessibility.limitedWalking) weights.walking += 0.6
  if (preference.accessibility.avoidStairs ||
    preference.accessibility.avoidSteepSlopes ||
    preference.accessibility.wheelchair) weights.accessibility += 0.5

  // Comfort needs road-condition data. Where the data is missing or thin, a route drifts toward a neutral
  // score (0.5) instead of being rewarded or punished; with no data at all the comfort weight is dropped and the rest renormalised,
  // i.e. standard routing.
  const hasComfortData = pool.some((j) => j.comfort !== undefined)
  const comfortScores = pool.map((j) => {
    if (!j.comfort) return 0.5
    const c = j.comfort
    return ((100 - c.score) / 100) * c.coverage + 0.5 * (1 - c.coverage)
  })
  if (!hasComfortData && weights.comfort > 0) {
    const scale = 1 / (1 - weights.comfort)
    weights.duration *= scale
    weights.fare *= scale
    weights.walking *= scale
    weights.transfers *= scale
    weights.accessibility *= scale
    weights.comfort = 0
  }

  const riskScores = pool.map((j) => RISK_SCORE[worstRisk(connectionRisks(j)) ?? 'Comfortable'])
  const riskWeight =
    0.05 +
    (preference.accessibility.minimizeTransfers ? 0.15 : 0) +
    (preference.accessibility.limitedWalking || requiresWheelchair ? 0.1 : 0)

  const scored = pool.map((journey, i) => {
    const score =
      durationScores[i] * weights.duration +
      fareScores[i] * weights.fare +
      walkScores[i] * weights.walking +
      transferScores[i] * weights.transfers +
      accessScores[i] * weights.accessibility +
      comfortScores[i] * weights.comfort +
      riskScores[i] * riskWeight
    return { journey, score }
  })

  const budget = preference.budgetRupees
  const overBudget = (j: Journey) => (budget !== undefined && j.fareRupees > budget ? 1 : 0)
  // Within-budget routes always come first; ties fall back to duration, then id, so order is stable.
  scored.sort(
    (a, b) =>
      overBudget(a.journey) - overBudget(b.journey) ||
      a.score - b.score ||
      a.journey.durationMin - b.journey.durationMin ||
      a.journey.id.localeCompare(b.journey.id),
  )
  return scored.map((s) => s.journey)
}
