import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config, googleEnabled, otpMode, twilioVerifyEnabled } from './config.ts'
import {
  clearCookie, createSession, destroySession, publicUser, readCookies, requireAuth, setCookie, signValue, unsignValue,
  userFromRequest,
} from './http.ts'
import { loadDb, persist, type User } from './store.ts'
import { normalizePhone } from './sms.ts'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${(await scrypt(pw, salt, 64)).toString('hex')}`
}
async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(pw, Buffer.from(saltHex, 'hex'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const limiter = (windowMin: number, max: number) =>
  rateLimit({
    windowMs: windowMin * 60_000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' },
  })

const safeNext = (n: unknown) => (typeof n === 'string' && /^\/[A-Za-z0-9/_\-?=&.]*$/.test(n) && !n.startsWith('//') ? n : '/')
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

function newUser(partial: Partial<User> & { name: string }): User {
  const user: User = { id: randomUUID(), createdAt: new Date().toISOString(), ...partial }
  loadDb().users.push(user)
  persist()
  return user
}

// ---- OTP -------------------------------------------------------------------------------------
interface PendingOtp { hash: string; expiresAt: number; attempts: number; sentAt: number }
const pendingOtps = new Map<string, PendingOtp>()
const OTP_TTL_MS = 5 * 60_000
const OTP_RESEND_MS = 30_000
const otpHash = (phone: string, code: string) => createHash('sha256').update(`${config.sessionSecret}:${phone}:${code}`).digest('hex')

async function twilioVerify(path: 'Verifications' | 'VerificationCheck', params: Record<string, string>): Promise<Response> {
  const { accountSid, authToken, verifyServiceSid } = config.twilio
  return fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  })
}

export function authRouter(): Router {
  const r = Router()

  r.get('/config', (_req, res) => {
    res.json({ google: googleEnabled(), otp: otpMode(), password: true })
  })

  r.get('/me', (req, res) => {
    const user = userFromRequest(req)
    res.json({ user: user ? publicUser(user) : null })
  })

  r.post('/signup', limiter(15, 10), async (req, res) => {
    const { name, email, password } = (req.body ?? {}) as Record<string, unknown>
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 80) return void res.status(400).json({ error: 'invalid_name', message: 'Please enter your name.' })
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) return void res.status(400).json({ error: 'invalid_email', message: 'Please enter a valid email address.' })
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) return void res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters.' })
    const lower = email.trim().toLowerCase()
    if (loadDb().users.some((u) => u.email === lower)) return void res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists. Try signing in.' })
    const user = newUser({ name: name.trim(), email: lower, passwordHash: await hashPassword(password) })
    createSession(res, user.id)
    res.status(201).json({ user: publicUser(user) })
  })

  r.post('/login', limiter(15, 20), async (req, res) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>
    if (typeof email !== 'string' || typeof password !== 'string') return void res.status(400).json({ error: 'invalid', message: 'Enter your email and password.' })
    const user = loadDb().users.find((u) => u.email === email.trim().toLowerCase())
    // Always run a hash comparison so timing doesn't reveal whether the account exists.
    const ok = user?.passwordHash ? await checkPassword(password, user.passwordHash) : (await checkPassword(password, 'aa:bb'), false)
    if (!user || !ok) return void res.status(401).json({ error: 'bad_credentials', message: 'Email or password is incorrect.' })
    createSession(res, user.id)
    res.json({ user: publicUser(user) })
  })

  r.post('/logout', (req, res) => {
    destroySession(req, res)
    res.json({ ok: true })
  })

  // ---- Mobile number + OTP ----
  r.post('/otp/request', limiter(10, 8), async (req, res) => {
    const mode = otpMode()
    if (mode === 'off') return void res.status(503).json({ error: 'otp_unavailable', message: 'Phone sign-in is not available right now. Please use email or Google.' })
    const phone = normalizePhone(String((req.body as Record<string, unknown> | undefined)?.phone ?? ''))
    if (!phone) return void res.status(400).json({ error: 'invalid_phone', message: 'Enter a valid mobile number.' })
    const prev = pendingOtps.get(phone)
    if (prev && Date.now() - prev.sentAt < OTP_RESEND_MS) return void res.status(429).json({ error: 'too_soon', message: 'Please wait 30 seconds before requesting another code.' })

    if (mode === 'twilio') {
      try {
        const out = await twilioVerify('Verifications', { To: phone, Channel: 'sms' })
        if (!out.ok) return void res.status(502).json({ error: 'sms_failed', message: 'We could not send the code. Check the number and try again.' })
      } catch {
        return void res.status(502).json({ error: 'sms_failed', message: 'The SMS service did not respond. Please try again.' })
      }
      pendingOtps.set(phone, { hash: '', expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() })
      return void res.json({ ok: true, phone, mode })
    }
    // Development-only mode: the code is printed to the server console, never returned to the browser.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    pendingOtps.set(phone, { hash: otpHash(phone, code), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() })
    console.log(`[dev-otp] code for ${phone}: ${code}`)
    res.json({ ok: true, phone, mode })
  })

  r.post('/otp/verify', limiter(10, 20), async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const phone = normalizePhone(String(body.phone ?? ''))
    const code = String(body.code ?? '').trim()
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
    const pending = phone ? pendingOtps.get(phone) : undefined
    if (!phone || !/^\d{4,8}$/.test(code)) return void res.status(400).json({ error: 'invalid', message: 'Enter the code we sent you.' })
    if (!pending || pending.expiresAt < Date.now()) return void res.status(400).json({ error: 'expired', message: 'That code has expired. Request a new one.' })
    if (pending.attempts >= 5) { pendingOtps.delete(phone); return void res.status(429).json({ error: 'locked', message: 'Too many wrong codes. Request a new one.' }) }
    pending.attempts += 1

    let approved = false
    if (twilioVerifyEnabled()) {
      try {
        const out = await twilioVerify('VerificationCheck', { To: phone, Code: code })
        approved = out.ok && ((await out.json()) as { status?: string }).status === 'approved'
      } catch {
        return void res.status(502).json({ error: 'sms_failed', message: 'The SMS service did not respond. Please try again.' })
      }
    } else {
      approved = pending.hash === otpHash(phone, code)
    }
    if (!approved) return void res.status(401).json({ error: 'wrong_code', message: 'That code is not correct.' })
    pendingOtps.delete(phone)
    const db = loadDb()
    let user = db.users.find((u) => u.phone === phone)
    if (!user) user = newUser({ name: name || `Traveller ${phone.slice(-4)}`, phone })
    createSession(res, user.id)
    res.json({ user: publicUser(user) })
  })

  // ---- Google OAuth (authorization code + PKCE, server side) ----
  r.get('/google/start', (req, res) => {
    if (!googleEnabled()) return void res.redirect(`${config.appUrl}/#/login?error=google_unavailable`)
    const state = randomBytes(16).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    setCookie(res, 'nr_oauth', signValue(JSON.stringify({ state, verifier, next: safeNext(req.query.next) })), 600)
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: `${config.publicUrl}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    })
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  })

  r.get('/google/callback', async (req, res) => {
    const fail = (code: string) => res.redirect(`${config.appUrl}/#/login?error=${code}`)
    const raw = unsignValue(readCookies(req).nr_oauth)
    clearCookie(res, 'nr_oauth')
    if (!googleEnabled() || !raw) return fail('google_failed')
    const saved = JSON.parse(raw) as { state: string; verifier: string; next: string }
    if (req.query.error || typeof req.query.code !== 'string' || req.query.state !== saved.state) return fail('google_cancelled')
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: `${config.publicUrl}/api/auth/google/callback`,
          grant_type: 'authorization_code',
          code_verifier: saved.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!tokenRes.ok) return fail('google_failed')
      const { access_token } = (await tokenRes.json()) as { access_token?: string }
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${access_token ?? ''}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!infoRes.ok) return fail('google_failed')
      const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string }
      if (!info.sub) return fail('google_failed')
      const db = loadDb()
      const email = info.email_verified && info.email ? info.email.toLowerCase() : undefined
      let user = db.users.find((u) => u.googleSub === info.sub) ?? (email ? db.users.find((u) => u.email === email) : undefined)
      if (user) { user.googleSub = info.sub; persist() }
      else user = newUser({ name: info.name ?? email ?? 'Traveller', email, googleSub: info.sub })
      createSession(res, user.id)
      res.redirect(`${config.appUrl}/#${saved.next}`)
    } catch {
      fail('google_failed')
    }
  })

  r.get('/account', requireAuth, (req, res) => res.json({ user: publicUser(req.user!) }))
  return r
}

