import { describe, expect, it } from 'vitest'
import { decodePolyline, mapOtpItineraries } from '../src/transit.ts'

describe('OpenTripPlanner mapping (fixture shaped like an OTP 2 plan response)', () => {
  it('decodes polylines', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')[0]).toEqual([-120.2, 38.5])
  })
  it('maps legs and says when the fare is unknown', () => {
    const o = { id: 'a', name: 'A', area: '', lat: 13, lng: 80 }, d = { id: 'b', name: 'B', area: '', lat: 13.05, lng: 80.1 }
    const [j] = mapOtpItineraries([{ startTime: 1_800_000_000_000, endTime: 1_800_001_800_000, duration: 1800, walkDistance: 400, transfers: 0,
      legs: [
        { mode: 'WALK', startTime: 0, endTime: 0, distance: 400, duration: 300, from: { name: 'A', lat: 13, lon: 80 }, to: { name: 'Stop', lat: 13.001, lon: 80 } },
        { mode: 'SUBWAY', transitLeg: true, startTime: 0, endTime: 0, distance: 8000, duration: 1500, routeShortName: 'Blue', routeColor: '0000FF', from: { name: 'Stop', lat: 13.001, lon: 80 }, to: { name: 'B', lat: 13.05, lon: 80.1 } },
      ] }], o, d)
    expect(j.source).toBe('live'); expect(j.fareKnown).toBe(false)
    expect(j.modes).toEqual(['walk', 'metro']); expect(j.segments[1].lineColor).toBe('#0000FF'); expect(j.durationMin).toBe(30)
  })
})
