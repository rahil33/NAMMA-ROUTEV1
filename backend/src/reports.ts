import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from './http.ts'
import { loadDb, persist, type RoadReport } from './store.ts'

const KINDS: RoadReport['kind'][] = ['pothole', 'speed-breaker', 'rough-road', 'closure', 'waterlogging']
const MAX_AGE_MS = 90 * 86400_000
const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)

/** Community road-condition reports. These are the only "live" pothole signal we use. */
export function reportsRouter(): Router {
  const r = Router()
  r.get('/', (req, res) => {
    const [minLat, minLng, maxLat, maxLng] = [num(req.query.minLat), num(req.query.minLng), num(req.query.maxLat), num(req.query.maxLng)]
    if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return void res.status(400).json({ error: 'invalid_bbox', message: 'A bounding box is required.' })
    const cutoff = Date.now() - MAX_AGE_MS
    const reports = loadDb().reports
      .filter((p) => p.at > cutoff && p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng)
      .slice(-500)
      .map(({ lat, lng, kind, at }) => ({ lat, lng, kind, at }))
    res.json({ reports })
  })
  r.post('/', requireAuth, rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many reports. Please wait a minute.' } }), (req, res) => {
    const { lat, lng, kind } = (req.body ?? {}) as Record<string, unknown>
    if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !KINDS.includes(kind as RoadReport['kind'])) {
      return void res.status(400).json({ error: 'invalid_report', message: 'Report needs a location and a type.' })
    }
    const db = loadDb()
    db.reports = db.reports.filter((p) => p.at > Date.now() - MAX_AGE_MS)
    db.reports.push({ id: randomUUID(), userId: req.user!.id, lat, lng, kind: kind as RoadReport['kind'], at: Date.now() })
    persist()
    res.status(201).json({ ok: true })
  })
  return r
}
