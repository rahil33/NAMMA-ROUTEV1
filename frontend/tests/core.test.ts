import { describe, expect, it } from 'vitest'
import { searchLocations } from '../src/data/chennaiLocations'
import { parseArriveBy, parseVoiceCommand } from '../src/utils/voiceCommand'
import { crowdLevel, roadSlowdown } from '../src/utils/trafficModel'
import { generateDemoJourneys } from '../src/data/mockJourneys'
import { scoreJourney } from '../src/utils/commuterIntel'
import { adviseDeparture } from '../src/utils/departureAdvisor'

const [tambaram, guindy] = [searchLocations('tambaram')[0], searchLocations('guindy')[0]]
const at = (h: number, m = 0) => new Date(2026, 8, 30, h, m) // a Wednesday

describe('location search', () => {
  it('ignores dots and spaces', () => expect(searchLocations('tnagar')[0].id).toBe('loc-t-nagar'))
  it('matches Tamil aliases', () => expect(searchLocations('தாம்பரம்')[0].id).toBe('loc-tambaram'))
  it('ranks exact before partial', () => expect(searchLocations('airport')[0].id).toBe('loc-airport'))
})

describe('voice commands', () => {
  it('parses arrival times', () => {
    expect(parseArriveBy('arrive by 9 30 am')?.hhmm).toBe('09:30')
    expect(parseArriveBy('arrive by 5 pm')?.hhmm).toBe('17:00')
    expect(parseArriveBy('go to guindy')).toBeNull()
  })
  it('keeps the time out of place names', () => {
    const i = parseVoiceCommand('from Tambaram to Guindy arrive by 9 30 am')
    expect(i.origin?.id).toBe('loc-tambaram')
    expect(i.destination?.id).toBe('loc-guindy')
    expect(i.arriveBy).toBe('09:30')
  })
})

describe('traffic and crowd model', () => {
  it('slows roads at peak, not at night', () => {
    expect(roadSlowdown(9)).toBeGreaterThan(1.5)
    expect(roadSlowdown(23)).toBeLessThan(1.05)
  })
  it('crowds more at peak', () => expect(crowdLevel('metro', 9)).toBeGreaterThan(crowdLevel('metro', 14)))
})

describe('journeys and scoring', () => {
  it('is deterministic for the same inputs', () => {
    const a = generateDemoJourneys(tambaram, guindy, at(9)).map((j) => j.durationMin)
    const b = generateDemoJourneys(tambaram, guindy, at(9)).map((j) => j.durationMin)
    expect(a).toEqual(b)
  })
  it('weights sum to 1 and values stay within 0-100', () => {
    const s = scoreJourney(generateDemoJourneys(tambaram, guindy, at(9))[0], 'fastest')
    expect(s.factors.reduce((t, f) => t + f.weight, 0)).toBeCloseTo(1)
    for (const f of s.factors) expect(f.value >= 0 && f.value <= 100).toBe(true)
  })
})

describe('departure advisor', () => {
  it('flags an impossible target', () => {
    const a = adviseDeparture(tambaram, guindy, { now: at(9), arriveBy: at(9, 10) })
    expect(a.arriveBy?.meetsTarget).toBe(false)
  })
  it('meets a comfortable target', () => {
    const a = adviseDeparture(tambaram, guindy, { now: at(8), arriveBy: at(11) })
    expect(a.arriveBy?.meetsTarget).toBe(true)
    expect(a.best.arriveAt.getTime()).toBeLessThanOrEqual(at(11).getTime())
  })
})

describe('tickets', () => {
  it('only ticketable legs carry fares, and totals add up', async () => {
    const { ticketableLegs, totalTicketFare } = await import('../src/services/ticketService')
    const j = generateDemoJourneys(tambaram, guindy, at(9))[0]
    const legs = ticketableLegs(j)
    expect(legs.every((s) => ['bus', 'metro', 'suburban-rail'].includes(s.mode))).toBe(true)
    expect(totalTicketFare(j)).toBe(legs.reduce((s, l) => s + (l.fareRupees ?? 0), 0))
  })
})
