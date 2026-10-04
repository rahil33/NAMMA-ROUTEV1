import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config, smsEnabled } from './config.ts'
import { requireAuth } from './http.ts'
import { loadDb, persist, type GuardianConfig, type Share, type TrackEvent } from './store.ts'
import { normalizePhone, sendSms } from './sms.ts'

const DEFAULT: GuardianConfig = { enabled: false, name: '', phone: '', deviationMeters: 300, inactivityMinutes: null, notifyStartEnd: true }
const SHARE_TTL_MS = 24 * 3600_000
const THROTTLE_MS = 5 * 60_000
const lastSms = new Map<string, number>() // `${token}:${type}` -> time

const mapsLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const validLat = (v: unknown): v is number => finite(v) && Math.abs(v) <= 90
const validLng = (v: unknown): v is number => finite(v) && Math.abs(v) <= 180

function purgeShares() {
  const db = loadDb()
  const cutoff = Date.now() - SHARE_TTL_MS
  db.shares = db.shares.filter((s) => (s.endedAt ?? s.startedAt) > cutoff)
}

async function notify(userId: string, text: string): Promise<{ sent: boolean; reason?: string }> {
  const g = loadDb().guardians[userId]
  if (!g?.enabled || !g.phone) return { sent: false, reason: 'no_guardian' }
  if (!smsEnabled()) return { sent: false, reason: 'sms_unconfigured' }
  return (await sendSms(g.phone, text)) ? { sent: true } : { sent: false, reason: 'sms_failed' }
}

export function guardianRouter(): Router {
  const r = Router()
  r.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many requests.' } }))

  r.get('/', requireAuth, (req, res) => {
    res.json({ guardian: loadDb().guardians[req.user!.id] ?? DEFAULT, smsConfigured: smsEnabled() })
  })

  r.put('/', requireAuth, (req, res) => {
    const b = (req.body ?? {}) as Partial<GuardianConfig>
    const phone = b.phone ? normalizePhone(String(b.phone)) : ''
    if (b.enabled && !phone) return void res.status(400).json({ error: 'invalid_phone', message: 'Enter a valid guardian mobile number.' })
    const next: GuardianConfig = {
      enabled: Boolean(b.enabled),
      name: String(b.name ?? '').trim().slice(0, 80),
      phone: phone ?? '',
      deviationMeters: finite(b.deviationMeters) ? Math.min(2000, Math.max(100, Math.round(b.deviationMeters))) : DEFAULT.deviationMeters,
      inactivityMinutes: finite(b.inactivityMinutes) ? Math.min(120, Math.max(3, Math.round(b.inactivityMinutes))) : null,
      notifyStartEnd: b.notifyStartEnd !== false,
    }
    loadDb().guardians[req.user!.id] = next
    persist()
    res.json({ guardian: next, smsConfigured: smsEnabled() })
  })

  r.post('/share/start', requireAuth, async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>
    purgeShares()
    const db = loadDb()
    const share: Share = {
      token: randomBytes(18).toString('base64url'), userId: req.user!.id, riderName: req.user!.name,
      title: String(b.title ?? 'Journey').slice(0, 120), origin: String(b.origin ?? '').slice(0, 80), destination: String(b.destination ?? '').slice(0, 80),
      startedAt: Date.now(), trail: [], events: [{ type: 'start', at: Date.now(), message: 'Journey started' }],
    }
    db.shares.push(share)
    persist()
    const url = `${config.publicUrl}/#/track/${share.token}`
    const g = db.guardians[share.userId]
    let delivery: { sent: boolean; reason?: string } = { sent: false, reason: 'not_requested' }
    if (g?.enabled && g.notifyStartEnd) delivery = await notify(share.userId, `${share.riderName} started a journey: ${share.origin} to ${share.destination}. Follow live: ${url}`)
    res.status(201).json({ token: share.token, url, delivery })
  })

  const ownShare = (req: Parameters<typeof requireAuth>[0], token: string): Share | undefined =>
    loadDb().shares.find((s) => s.token === token && s.userId === req.user!.id)

  r.post('/share/:token/ping', requireAuth, (req, res) => {
    const share = ownShare(req, String(req.params.token))
    if (!share || share.endedAt) return void res.status(404).json({ error: 'no_share', message: 'No active journey share.' })
    const { lat, lng, accuracy } = (req.body ?? {}) as Record<string, unknown>
    if (!validLat(lat) || !validLng(lng)) return void res.status(400).json({ error: 'invalid_coordinates', message: 'Invalid position.' })
    share.last = { lat, lng, accuracy: finite(accuracy) ? accuracy : undefined, at: Date.now() }
    share.trail.push([lng, lat])
    if (share.trail.length > 600) share.trail.splice(0, share.trail.length - 600)
    persist()
    res.json({ ok: true })
  })

  r.post('/share/:token/event', requireAuth, async (req, res) => {
    const share = ownShare(req, String(req.params.token))
    if (!share) return void res.status(404).json({ error: 'no_share', message: 'No such journey share.' })
    const type = String((req.body as Record<string, unknown> | undefined)?.type)
    if (!['deviation', 'inactivity', 'end'].includes(type)) return void res.status(400).json({ error: 'invalid_type', message: 'Unknown event.' })
    const where = share.last ? ` Last seen: ${mapsLink(share.last.lat, share.last.lng)}` : ''
    const url = `${config.publicUrl}/#/track/${share.token}`
    const copy: Record<string, string> = {
      deviation: `${share.riderName} has moved away from the planned route to ${share.destination}.${where} Live: ${url}`,
      inactivity: `${share.riderName} has not moved or responded for a while during their journey.${where} Live: ${url}`,
      end: `${share.riderName} has arrived: ${share.origin} to ${share.destination}.`,
    }
    const ev: TrackEvent = { type: type as TrackEvent['type'], at: Date.now(), message: copy[type].split(' Live:')[0] }
    share.events.push(ev)
    if (type === 'end') share.endedAt = Date.now()
    persist()
    const g = loadDb().guardians[share.userId]
    let delivery: { sent: boolean; reason?: string } = { sent: false, reason: 'throttled' }
    const key = `${share.token}:${type}`
    if (type === 'end' ? g?.notifyStartEnd !== false : Date.now() - (lastSms.get(key) ?? 0) > THROTTLE_MS) {
      lastSms.set(key, Date.now())
      delivery = await notify(share.userId, copy[type])
    }
    res.json({ ok: true, delivery })
  })

  // SOS works with or without an active journey share.
  r.post('/sos', requireAuth, async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>
    const user = req.user!
    const hasPos = validLat(b.lat) && validLng(b.lng)
    const share = typeof b.token === 'string' ? ownShare(req, b.token) : undefined
    if (share && hasPos) share.last = { lat: b.lat as number, lng: b.lng as number, at: Date.now() }
    share?.events.push({ type: 'sos', at: Date.now(), message: 'SOS pressed' })
    persist()
    const where = hasPos ? ` Location: ${mapsLink(b.lat as number, b.lng as number)}` : ' Location unavailable.'
    const track = share ? ` Live: ${config.publicUrl}/#/track/${share.token}` : ''
    const delivery = await notify(user.id, `SOS from ${user.name}: they need help.${where}${track}`)
    const guardian = loadDb().guardians[user.id]
    res.json({ ok: true, delivery, guardianConfigured: Boolean(guardian?.enabled && guardian.phone) })
  })

  return r
}

/** Public, read-only live view for the guardian. The unguessable token is the credential. */
export function trackRouter(): Router {
  const r = Router()
  r.use(rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many requests.' } }))
  r.get('/:token', (req, res) => {
    purgeShares()
    const s = loadDb().shares.find((x) => x.token === req.params.token)
    res.setHeader('Cache-Control', 'no-store')
    if (!s) return void res.status(404).json({ error: 'not_found', message: 'This tracking link has expired or is not valid.' })
    res.json({
      riderName: s.riderName, title: s.title, origin: s.origin, destination: s.destination,
      startedAt: s.startedAt, endedAt: s.endedAt ?? null, last: s.last ?? null, trail: s.trail.slice(-200), events: s.events.slice(-30),
    })
  })
  return r
}
