import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'nr-'))
process.env.SESSION_SECRET = 'x'.repeat(40)
process.env.AUTH_DEV_OTP = 'true'
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com'
process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
process.env.PUBLIC_URL = 'http://localhost:5173'
delete process.env.UBER_SERVER_TOKEN
delete process.env.OTP_URL

let server: Server
let base = ''
const otpLogs: string[] = []

class Client {
  cookie = ''
  async call(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await fetch(base + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...init.headers },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      if (/Max-Age=0/i.test(c)) this.cookie = ''
      else this.cookie = pair
    }
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* redirect or empty */ }
    return { status: res.status, json, headers: res.headers, setCookie: res.headers.getSetCookie() }
  }
}

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { otpLogs.push(a.join(' ')) })
  const { createApp } = await import('../src/app.ts')
  server = createApp().listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => { server.close() })

describe('auth: email + password', () => {
  const c = new Client()
  it('rejects protected endpoints when signed out', async () => {
    expect((await c.call('/api/guardian')).status).toBe(401)
    expect((await c.call('/api/auth/me')).json.user).toBeNull()
  })
  it('validates signup input', async () => {
    expect((await c.call('/api/auth/signup', { body: { name: 'A', email: 'bad', password: 'longenough' } })).status).toBe(400)
    expect((await c.call('/api/auth/signup', { body: { name: 'A', email: 'a@b.co', password: 'short' } })).status).toBe(400)
  })
  it('signs up with an httpOnly session cookie, persists, then logs out and revokes', async () => {
    const r = await c.call('/api/auth/signup', { body: { name: 'Asha', email: 'Asha@Example.com', password: 'correct-horse' } })
    expect(r.status).toBe(201)
    expect(r.setCookie.join(';')).toMatch(/HttpOnly/i)
    expect(r.setCookie.join(';')).toMatch(/SameSite=Lax/i)
    expect(r.json.user.email).toBe('asha@example.com')
    expect((await c.call('/api/auth/me')).json.user.name).toBe('Asha')
    const stolen = c.cookie
    expect((await c.call('/api/auth/logout', { method: 'POST', body: {} })).status).toBe(200)
    expect((await c.call('/api/auth/me')).json.user).toBeNull()
    const replay = new Client(); replay.cookie = stolen
    expect((await replay.call('/api/auth/me')).json.user).toBeNull() // server-side session was revoked
  })
  it('rejects duplicates and wrong passwords, accepts correct login', async () => {
    expect((await c.call('/api/auth/signup', { body: { name: 'Asha', email: 'asha@example.com', password: 'correct-horse' } })).status).toBe(409)
    expect((await c.call('/api/auth/login', { body: { email: 'asha@example.com', password: 'nope-nope-nope' } })).status).toBe(401)
    expect((await c.call('/api/auth/login', { body: { email: 'asha@example.com', password: 'correct-horse' } })).status).toBe(200)
  })
  it('rejects tampered session cookies', async () => {
    const t = new Client(); t.cookie = 'nr_session=deadbeef.forged'
    expect((await t.call('/api/auth/me')).json.user).toBeNull()
  })
  it('blocks cross-site state-changing requests', async () => {
    const r = await c.call('/api/auth/logout', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
  })
})

describe('auth: mobile OTP (dev mode)', () => {
  const c = new Client()
  it('reports capabilities', async () => {
    const cfg = (await c.call('/api/auth/config')).json
    expect(cfg.otp).toBe('dev'); expect(cfg.google).toBe(true)
  })
  it('rejects invalid numbers', async () => {
    expect((await c.call('/api/auth/otp/request', { body: { phone: '123' } })).status).toBe(400)
  })
  it('sends a code (never returned to the browser), rejects wrong code, accepts the right one', async () => {
    const req = await c.call('/api/auth/otp/request', { body: { phone: '98765 43210' } })
    expect(req.status).toBe(200)
    expect(Object.keys(req.json).sort()).toEqual(['mode', 'ok', 'phone']) // no code field
    expect((await c.call('/api/auth/otp/request', { body: { phone: '9876543210' } })).status).toBe(429)
    const code = otpLogs.map((l) => l.match(/\+919876543210: (\d{6})/)?.[1]).filter(Boolean).pop()!
    expect((await c.call('/api/auth/otp/verify', { body: { phone: '9876543210', code: code === '000000' ? '111111' : '000000' } })).status).toBe(401)
    const ok = await c.call('/api/auth/otp/verify', { body: { phone: '9876543210', code, name: 'Raman' } })
    expect(ok.status).toBe(200)
    expect(ok.json.user.phone).toBe('+919876543210')
    expect((await c.call('/api/auth/me')).json.user.name).toBe('Raman')
    expect((await c.call('/api/auth/otp/verify', { body: { phone: '9876543210', code } })).status).toBe(400) // single use
  })
})

describe('auth: Google OAuth', () => {
  it('redirects to Google with state + PKCE and sets a signed state cookie', async () => {
    const c = new Client()
    const r = await c.call('/api/auth/google/start?next=/guardian')
    expect(r.status).toBe(302)
    const url = new URL(r.headers.get('location')!)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID)
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(r.setCookie.join(';')).toMatch(/nr_oauth=.*HttpOnly/i)
  })
  it('rejects a callback with a mismatched state or no cookie', async () => {
    const c = new Client()
    const noCookie = await c.call('/api/auth/google/callback?code=abc&state=x')
    expect(noCookie.headers.get('location')).toMatch(/error=google_failed/)
    await c.call('/api/auth/google/start')
    const bad = await c.call('/api/auth/google/callback?code=abc&state=WRONG')
    expect(bad.headers.get('location')).toMatch(/error=google_cancelled/)
    expect((await c.call('/api/auth/me')).json.user).toBeNull()
  })
})

describe('rides: no invented prices', () => {
  const q = 'plat=13.0827&plng=80.2755&dlat=13.0067&dlng=80.2206'
  it('validates coordinates', async () => {
    expect((await new Client().call('/api/rides/options?plat=x')).status).toBe(400)
  })
  it('returns deep-link-only options without fares when no provider API is configured', async () => {
    const r = await new Client().call(`/api/rides/options?${q}`)
    expect(r.status).toBe(200)
    expect(r.json.apiProviders).toEqual([])
    expect(r.json.options.length).toBeGreaterThanOrEqual(3)
    for (const o of r.json.options) {
      expect(o.source).toBe('deeplink')
      expect(o.fare).toBeUndefined()
      expect(o.etaMin).toBeUndefined()
      expect(o.deepLink).toMatch(/^https:\/\//)
    }
    expect(r.json.options.find((o: any) => o.provider === 'uber').deepLink).toContain('pickup[latitude]=13.0827')
  })
})

describe('transit', () => {
  it('reports honestly when no planner is configured', async () => {
    const c = new Client()
    expect((await c.call('/api/transit/status')).json.planner).toBe('none')
    expect((await c.call('/api/transit/plan?fromLat=1&fromLng=1&toLat=2&toLng=2')).status).toBe(503)
  })
})

describe('guardian + SOS', () => {
  const c = new Client()
  let token = ''
  it('requires sign-in', async () => {
    expect((await new Client().call('/api/guardian/sos', { body: {} })).status).toBe(401)
  })
  it('stores guardian config and validates the phone', async () => {
    await c.call('/api/auth/signup', { body: { name: 'Meena', email: 'meena@example.com', password: 'a-long-password' } })
    expect((await c.call('/api/guardian', { method: 'PUT', body: { enabled: true, phone: 'abc' } })).status).toBe(400)
    const ok = await c.call('/api/guardian', { method: 'PUT', body: { enabled: true, name: 'Son', phone: '9123456789', deviationMeters: 50, inactivityMinutes: 10 } })
    expect(ok.json.guardian.phone).toBe('+919123456789')
    expect(ok.json.guardian.deviationMeters).toBe(100) // clamped
    expect((await c.call('/api/guardian')).json.smsConfigured).toBe(false)
  })
  it('starts a share, accepts pings, exposes a public read-only view without private fields', async () => {
    const s = await c.call('/api/guardian/share/start', { body: { title: 'Home', origin: 'Guindy', destination: 'Adyar' } })
    expect(s.status).toBe(201)
    expect(s.json.delivery).toEqual({ sent: false, reason: 'sms_unconfigured' }) // honest: nothing was sent
    token = s.json.token
    expect((await c.call(`/api/guardian/share/${token}/ping`, { body: { lat: 13.0, lng: 80.2, accuracy: 12 } })).status).toBe(200)
    expect((await c.call(`/api/guardian/share/${token}/ping`, { body: { lat: 999, lng: 80.2 } })).status).toBe(400)
    const pub = await new Client().call(`/api/track/${token}`)
    expect(pub.json.last.lat).toBe(13.0)
    expect(pub.json.riderName).toBe('Meena')
    expect(JSON.stringify(pub.json)).not.toMatch(/userId|phone|email/)
    expect((await new Client().call('/api/track/not-a-token')).status).toBe(404)
  })
  it("won't let another user write to someone else's share", async () => {
    const other = new Client()
    await other.call('/api/auth/signup', { body: { name: 'Eve', email: 'eve@example.com', password: 'a-long-password' } })
    expect((await other.call(`/api/guardian/share/${token}/ping`, { body: { lat: 1, lng: 1 } })).status).toBe(404)
  })
  it('records SOS and reports truthfully that no SMS could be sent', async () => {
    const r = await c.call('/api/guardian/sos', { body: { lat: 13.0, lng: 80.2, token } })
    expect(r.status).toBe(200)
    expect(r.json.guardianConfigured).toBe(true)
    expect(r.json.delivery.sent).toBe(false)
    const events = (await new Client().call(`/api/track/${token}`)).json.events
    expect(events.map((e: any) => e.type)).toContain('sos')
  })
  it('records deviation/inactivity/end events and ends the share', async () => {
    expect((await c.call(`/api/guardian/share/${token}/event`, { body: { type: 'deviation' } })).status).toBe(200)
    expect((await c.call(`/api/guardian/share/${token}/event`, { body: { type: 'bogus' } })).status).toBe(400)
    await c.call(`/api/guardian/share/${token}/event`, { body: { type: 'end' } })
    const pub = (await new Client().call(`/api/track/${token}`)).json
    expect(pub.endedAt).toBeTruthy()
    expect((await c.call(`/api/guardian/share/${token}/ping`, { body: { lat: 13, lng: 80 } })).status).toBe(404)
  })
})

describe('road reports', () => {
  it('requires auth to report; bbox query is public and strips user ids', async () => {
    expect((await new Client().call('/api/road-reports', { body: { lat: 13, lng: 80, kind: 'pothole' } })).status).toBe(401)
    const c = new Client()
    await c.call('/api/auth/signup', { body: { name: 'R', email: 'r@example.com', password: 'a-long-password' } })
    expect((await c.call('/api/road-reports', { body: { lat: 13.01, lng: 80.21, kind: 'nonsense' } })).status).toBe(400)
    expect((await c.call('/api/road-reports', { body: { lat: 13.01, lng: 80.21, kind: 'pothole' } })).status).toBe(201)
    const r = await new Client().call('/api/road-reports?minLat=13&minLng=80&maxLat=13.1&maxLng=80.3')
    expect(r.json.reports).toHaveLength(1)
    expect(JSON.stringify(r.json)).not.toMatch(/userId/)
  })
})

describe('config with empty env values (as copied from .env.example)', () => {
  it('falls back to defaults instead of using empty strings', async () => {
    process.env.DATA_DIR = ''; process.env.PORT = ''; process.env.FRONTEND_DIST = ''
    const { config } = await import('../src/config.ts?empty')
    expect(config.port).toBe(8787)
    expect(config.dataDir).toMatch(/backend[\\/]data$/)
    expect(config.frontendDist).toMatch(/frontend[\\/]dist$/)
  })
})

describe('windows path handling', () => {
  it('converts file URLs to valid Windows paths (no doubled drive letter)', async () => {
    const { fileURLToPath } = await import('node:url')
    const win = fileURLToPath(new URL('../data', 'file:///C:/Users/rahil/namma-route/backend/src/config.ts'), { windows: true })
    expect(win).toBe('C:\\Users\\rahil\\namma-route\\backend\\data')
    expect(new URL('../data', 'file:///C:/Users/rahil/x/backend/src/config.ts').pathname).toBe('/C:/Users/rahil/x/backend/data') // the old, broken source
  })
})
