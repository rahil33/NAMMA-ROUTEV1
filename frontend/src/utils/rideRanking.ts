// Ranks last-mile ride options using ONLY figures returned by a provider API.
// Options without a fare are never ranked and never given a made-up price.

export interface RideOptionDto {
  id: string
  provider: 'uber' | 'ola' | 'rapido' | 'namma-yatri'
  providerName: string
  product: string
  vehicle: 'cab' | 'auto' | 'bike'
  source: 'api' | 'deeplink'
  fare?: { low: number; high: number; currency: string }
  etaMin?: number
  tripMin?: number
  deepLink: string
  note: string
  error?: string
}
export interface RideResponseDto {
  route: { distanceKm: number; durationMin: number; source: 'osrm' } | null
  options: RideOptionDto[]
  apiProviders: string[]
  generatedAt: string
}

/** Rupees one minute of the traveller's time is treated as worth when finding "best value". Shown to the user. */
export const VALUE_OF_TIME_PER_MIN = 2

export const midFare = (o: RideOptionDto): number | null => (o.fare ? (o.fare.low + o.fare.high) / 2 : null)

/** Pickup wait + ride time, when both are known from the provider/road network. */
export function totalMinutes(o: RideOptionDto, routeMin: number | undefined): number | null {
  const trip = o.tripMin ?? routeMin
  return o.etaMin !== undefined && trip !== undefined ? o.etaMin + trip : null
}

export interface RideRecommendation {
  cheapest: RideOptionDto | null
  fastest: RideOptionDto | null
  bestValue: RideOptionDto | null
  pricedCount: number
  /** Set when a budget was given: how the options relate to it. */
  budget: { rupees: number; withinCount: number; allOver: boolean } | null
}

export function recommendRides(options: RideOptionDto[], routeMin: number | undefined, budgetRupees?: number): RideRecommendation {
  const priced = options.filter((o) => o.source === 'api' && o.fare)
  let pool = priced
  let budget: RideRecommendation['budget'] = null
  if (budgetRupees !== undefined && priced.length) {
    const within = priced.filter((o) => (o.fare as NonNullable<RideOptionDto['fare']>).low <= budgetRupees)
    budget = { rupees: budgetRupees, withinCount: within.length, allOver: within.length === 0 }
    // Recommend within budget whenever something fits; otherwise fall back to everything and flag it.
    if (within.length) pool = within
  }
  const by = (score: (o: RideOptionDto) => number | null) =>
    pool.reduce<{ o: RideOptionDto; s: number } | null>((best, o) => {
      const s = score(o)
      return s !== null && (!best || s < best.s) ? { o, s } : best
    }, null)?.o ?? null

  return {
    cheapest: by(midFare),
    fastest: by((o) => totalMinutes(o, routeMin)),
    bestValue: by((o) => {
      const m = midFare(o)
      const t = totalMinutes(o, routeMin)
      return m !== null && t !== null ? m + VALUE_OF_TIME_PER_MIN * t : null
    }),
    pricedCount: priced.length,
    budget,
  }
}
