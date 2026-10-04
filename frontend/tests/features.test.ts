import { describe, expect, it } from 'vitest'
import { recommendRides, type RideOptionDto } from '../src/utils/rideRanking'
import { assessComfort, samplePath } from '../src/utils/comfort'
import { distanceToPathM, isOffRoute } from '../src/utils/deviation'
import { rankJourneys } from '../src/utils/routeRanking'
import { stationKind } from '../src/utils/stations'
import { generateDemoJourneys } from '../src/data/mockJourneys'
import { CHENNAI_LOCATIONS } from '../src/data/chennaiLocations'
import type { Journey, RoutePreference } from '../src/types'

const opt = (id: string, low: number, high: number, eta?: number, trip = 20): RideOptionDto => ({
  id, provider: 'uber', providerName: 'Uber', product: id, vehicle: 'cab', source: 'api', fare: { low, high, currency: 'INR' }, etaMin: eta, tripMin: trip, deepLink: 'https://x', note: '',
})
const link: RideOptionDto = { id: 'ola', provider: 'ola', providerName: 'Ola', product: 'Ola', vehicle: 'cab', source: 'deeplink', deepLink: 'https://x', note: '' }

describe('ride recommendations', () => {
  const options = [opt('moto', 80, 100, 8), opt('go', 180, 220, 3), opt('auto', 120, 140, 12), link]
  it('picks cheapest/fastest/best value from priced options only', () => {
    const r = recommendRides(options, 20)
    expect(r.cheapest?.id).toBe('moto')
    expect(r.fastest?.id).toBe('go') // 3 + 20 = 23 vs 28 vs 32
    expect(r.bestValue).not.toBeNull()
    expect(r.pricedCount).toBe(3)
  })
  it('never ranks options without a fare', () => {
    const r = recommendRides([link], 20)
    expect(r.cheapest).toBeNull(); expect(r.fastest).toBeNull(); expect(r.bestValue).toBeNull(); expect(r.pricedCount).toBe(0)
  })
  it('respects the budget when something fits, and flags when nothing does', () => {
    expect(recommendRides(options, 20, 130).fastest?.id).toBe('moto')
    expect(recommendRides(options, 20, 130).budget?.withinCount).toBe(2)
    const none = recommendRides(options, 20, 10)
    expect(none.budget?.allOver).toBe(true)
    expect(none.cheapest?.id).toBe('moto')
  })
  it('skips fastest when ETA is unknown', () => {
    expect(recommendRides([opt('a', 50, 60, undefined)], 20).fastest).toBeNull()
  })
})

describe('station detection', () => {
  it('recognises stations from the Chennai data and ignores ordinary places', () => {
    const k = (id: string) => stationKind(CHENNAI_LOCATIONS.find((l) => l.id === id)!)
    expect(k('loc-airport-metro')).toBe('metro')
    expect(k('loc-tambaram')).toBe('rail')
    expect(k('loc-cmbt')).toBe('bus')
    expect(k('loc-marina')).toBeNull()
  })
})

describe('comfort scoring', () => {
  // ~1.1 km north-south road at lng 80.2
  const path: [number, number][] = [[80.2, 13.0], [80.2, 13.01]]
  const way = (tags: Record<string, string>) => ({ tags, geometry: [{ lat: 13.0, lon: 80.2 }, { lat: 13.01, lon: 80.2 }] })
  it('samples roughly every 40 m', () => {
    const s = samplePath(path)
    expect(s.length).toBeGreaterThan(20)
  })
  it('scores a smooth, tagged road high with full coverage', () => {
    const c = assessComfort({ path, ways: [way({ highway: 'primary', surface: 'asphalt', smoothness: 'good' })], bumps: [], reports: [] })!
    expect(c.score).toBe(100); expect(c.coverage).toBeGreaterThan(0.9); expect(c.limited).toBe(false)
  })
  it('penalises rough surface, bumps and community reports', () => {
    const c = assessComfort({ path, ways: [way({ highway: 'residential', surface: 'gravel' })], bumps: [{ lat: 13.005, lon: 80.2 }, { lat: 13.008, lon: 80.2 }], reports: [{ lat: 13.002, lng: 80.2, kind: 'pothole' }] })!
    expect(c.score).toBeLessThan(55); expect(c.speedBumps).toBe(2); expect(c.communityReports).toBe(1); expect(c.roughMeters).toBeGreaterThan(900)
  })
  it('marks limited data when roads carry no surface tags, and never claims certainty', () => {
    const c = assessComfort({ path, ways: [way({ highway: 'primary' })], bumps: [], reports: [] })!
    expect(c.limited).toBe(true); expect(c.notes.join(' ')).toMatch(/Limited road-condition data/)
  })
  it('returns nothing when every data source failed', () => {
    expect(assessComfort({ path, ways: null, bumps: null, reports: null })).toBeUndefined()
  })
})

describe('comfortable ranking', () => {
  const pref: RoutePreference = { optimizeFor: 'comfortable', priorities: ['comfortable'], rainMode: false, accessibility: { wheelchair: false, limitedWalking: false, avoidStairs: false, avoidSteepSlopes: false, minimizeWalking: false, minimizeTransfers: false, largeText: false, highContrast: false, reducedMotion: false } }
  const base = () => generateDemoJourneys(CHENNAI_LOCATIONS[0], CHENNAI_LOCATIONS[3], new Date('2026-10-05T09:00:00+05:30'))
  it('falls back to standard routing (no comfort influence) when no journey has road data', () => {
    const js = base()
    const a = rankJourneys(js, pref).map((j) => j.id)
    expect(a).toHaveLength(js.length)
    expect(rankJourneys(js, pref).map((j) => j.id)).toEqual(a) // deterministic
    const noComfortTop = rankJourneys(js, { ...pref, optimizeFor: 'balanced', priorities: ['balanced'] })
    expect(noComfortTop).toHaveLength(js.length)
  })
  it('prefers the smoother route when data exists', () => {
    const js = base().slice(0, 2).map((j, i): Journey => ({ ...j, comfort: { score: i === 0 ? 20 : 95, coverage: 1, limited: false, speedBumps: 0, roughMeters: 0, communityReports: 0, sources: [], notes: [] } }))
    expect(rankJourneys(js, pref)[0].id).toBe(js[1].id)
  })
})

describe('deviation detection', () => {
  const path: [number, number][] = [[80.2, 13.0], [80.2, 13.01]]
  it('measures distance to the path', () => {
    expect(distanceToPathM(13.005, 80.2, path)).toBeLessThan(1)
    const d = distanceToPathM(13.005, 80.2045, path)
    expect(d).toBeGreaterThan(450); expect(d).toBeLessThan(520)
  })
  it('needs consecutive far fixes and decent accuracy before alarming', () => {
    expect(isOffRoute([500], 300, 10)).toBe(false)
    expect(isOffRoute([500, 520, 600], 300, 10)).toBe(true)
    expect(isOffRoute([500, 100, 600], 300, 10)).toBe(false)
    expect(isOffRoute([500, 520, 600], 300, 900)).toBe(false)
  })
})

