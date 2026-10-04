import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from './config.ts'
import type { Journey, JourneySegment, Location, TransportMode } from './types.ts'

// Public-transport planning through OpenTripPlanner (OTP 2.x legacy REST plan API) fed with a GTFS
// feed you are licensed to use. Chennai Metro Rail and MTC do not publish a public live API, so when
// OTP_URL is not configured this router reports `configured: false` and the app says so honestly.

interface OtpLeg {
  mode: string
  startTime: number
  endTime: number
  distance: number
  duration: number
  from: { name: string; lat: number; lon: number }
  to: { name: string; lat: number; lon: number }
  legGeometry?: { points: string }
  routeShortName?: string
  routeLongName?: string
  routeColor?: string
  transitLeg?: boolean
}
interface OtpItinerary {
  startTime: number
  endTime: number
  duration: number
  walkDistance: number
  transfers: number
  legs: OtpLeg[]
  fare?: { fare?: { regular?: { cents: number; currency?: { defaultFractionDigits?: number } } } }
}

export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = []
  let i = 0, lat = 0, lng = 0
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b: number
      do {
        b = str.charCodeAt(i++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    out.push([lng / 1e5, lat / 1e5]) // [lng, lat], as the app's segments expect
  }
  return out
}

const MODE: Record<string, TransportMode> = { WALK: 'walk', BUS: 'bus', SUBWAY: 'metro', TRAM: 'metro', RAIL: 'suburban-rail', CAR: 'auto' }

export function mapOtpItineraries(itineraries: OtpItinerary[], origin: Location, destination: Location): Journey[] {
  return itineraries.map((it, n) => {
    const segments: JourneySegment[] = it.legs.map((leg, i) => {
      const mode = MODE[leg.mode] ?? 'bus'
      const transit = mode !== 'walk' && mode !== 'auto'
      return {
        id: `otp-${n}-${i}`,
        mode,
        from: leg.from.name,
        to: leg.to.name,
        durationMin: Math.max(1, Math.round(leg.duration / 60)),
        distanceMeters: Math.round(leg.distance),
        lineName: leg.routeShortName ?? leg.routeLongName,
        lineColor: leg.routeColor ? `#${leg.routeColor}` : undefined,
        environment: transit ? 'transit' : 'outdoor',
        // OTP only reports accessibility when the GTFS feed carries wheelchair data, which we do not assume.
        accessibility: { wheelchairAccessible: 'unknown', hasElevator: 'unknown', hasEscalator: 'unknown', hasSteps: false, verified: false },
        polyline: leg.legGeometry ? decodePolyline(leg.legGeometry.points) : [[leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]],
      }
    })
    const cents = it.fare?.fare?.regular?.cents
    const digits = it.fare?.fare?.regular?.currency?.defaultFractionDigits ?? 2
    const transitCount = it.legs.filter((l) => l.transitLeg).length
    return {
      id: `otp-${n}-${it.startTime}`,
      origin, destination,
      departAt: new Date(it.startTime).toISOString(),
      arriveAt: new Date(it.endTime).toISOString(),
      durationMin: Math.max(1, Math.round(it.duration / 60)),
      fareRupees: cents !== undefined ? Math.round(cents / 10 ** digits) : 0,
      fareKnown: cents !== undefined,
      source: 'live',
      walkingMeters: Math.round(it.walkDistance),
      transfers: it.transfers ?? Math.max(0, transitCount - 1),
      modes: [...new Set(segments.map((s) => s.mode))],
      segments,
      accessible: false,
      tag: 'balanced',
    } satisfies Journey
  })
}

const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)

export function transitRouter(): Router {
  const r = Router()
  r.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many requests.' } }))

  r.get('/status', (_req, res) => {
    res.json({
      planner: config.otpUrl ? 'otp' : 'none',
      chennaiOneUrl: config.chennaiOneUrl || null,
      officialLinks: [
        { id: 'cmrl', label: 'Chennai Metro Rail (timings, fares)', url: 'https://chennaimetrorail.org' },
      ],
    })
  })

  r.get('/plan', async (req, res) => {
    if (!config.otpUrl) return void res.status(503).json({ error: 'transit_unconfigured', message: 'Live transit planning is not configured.' })
    const q = req.query
    const [fLat, fLng, tLat, tLng] = [num(q.fromLat), num(q.fromLng), num(q.toLat), num(q.toLng)]
    if (![fLat, fLng, tLat, tLng].every(Number.isFinite)) return void res.status(400).json({ error: 'invalid_coordinates', message: 'Origin and destination are required.' })
    const when = typeof q.time === 'string' && !Number.isNaN(Date.parse(q.time)) ? new Date(q.time) : new Date()
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(when).map((p) => [p.type, p.value]))
    const params = new URLSearchParams({
      fromPlace: `${fLat},${fLng}`, toPlace: `${tLat},${tLng}`,
      date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`,
      arriveBy: q.arriveBy === 'true' ? 'true' : 'false', mode: 'TRANSIT,WALK', numItineraries: '5', showIntermediateStops: 'false',
    })
    try {
      const otp = await fetch(`${config.otpUrl}/otp/routers/default/plan?${params}`, { signal: AbortSignal.timeout(12_000) })
      if (!otp.ok) return void res.status(502).json({ error: 'transit_upstream', message: 'The transit planner returned an error.' })
      const body = (await otp.json()) as { plan?: { itineraries?: OtpItinerary[] }; error?: { msg?: string } }
      const origin: Location = { id: String(q.oId ?? 'origin'), name: String(q.oName ?? 'Start'), area: '', lat: fLat, lng: fLng }
      const destination: Location = { id: String(q.dId ?? 'dest'), name: String(q.dName ?? 'Destination'), area: '', lat: tLat, lng: tLng }
      res.json({ journeys: mapOtpItineraries(body.plan?.itineraries ?? [], origin, destination), message: body.error?.msg ?? null })
    } catch {
      res.status(502).json({ error: 'transit_unreachable', message: 'The transit planner could not be reached.' })
    }
  })
  return r
}
