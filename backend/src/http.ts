import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config, isProd } from './config.ts'
import { loadDb, persist, type User } from './store.ts'

export const SESSION_COOKIE = 'nr_session'

const sign = (value: string) => createHmac('sha256', config.sessionSecret).update(value).digest('base64url')

export function signValue(value: string): string {
  return `${value}.${sign(value)}`
}

export function unsignValue(signed: string | undefined): string | null {
  if (!signed) return null
  const i = signed.lastIndexOf('.')
  if (i < 1) return null
  const value = signed.slice(0, i)
  const a = Buffer.from(signed.slice(i + 1))
  const b = Buffer.from(sign(value))
  return a.length === b.length && timingSafeEqual(a, b) ? value : null
}

export function readCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function setCookie(res: Response, name: string, value: string, maxAgeSec: number): void {
  const attrs = [
  `${name}=${encodeURIComponent(value)}`,
  'Path=/',
  'HttpOnly',
  'SameSite=None',
  `Max-Age=${maxAgeSec}`,
]
  if (isProd) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

export const clearCookie = (res: Response, name: string) => setCookie(res, name, '', 0)

export function createSession(res: Response, userId: string): void {
  const db = loadDb()
  const now = Date.now()
  db.sessions = db.sessions.filter((s) => s.expiresAt > now)
  const id = randomBytes(32).toString('hex')
  const maxAge = config.sessionDays * 86400
  db.sessions.push({ id, userId, expiresAt: now + maxAge * 1000 })
  persist()
  setCookie(res, SESSION_COOKIE, signValue(id), maxAge)
}

export function destroySession(req: Request, res: Response): void {
  const id = unsignValue(readCookies(req)[SESSION_COOKIE])
  if (id) {
    const db = loadDb()
    db.sessions = db.sessions.filter((s) => s.id !== id)
    persist()
  }
  clearCookie(res, SESSION_COOKIE)
}

export function userFromRequest(req: Request): User | null {
  const id = unsignValue(readCookies(req)[SESSION_COOKIE])
  if (!id) return null
  const db = loadDb()
  const session = db.sessions.find((s) => s.id === id && s.expiresAt > Date.now())
  return session ? (db.users.find((u) => u.id === session.userId) ?? null) : null
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = userFromRequest(req)
  if (!user) {
    res.status(401).json({ error: 'auth_required', message: 'Please sign in to continue.' })
    return
  }
  req.user = user
  next()
}

/** Blocks cross-site state-changing requests (cookies are SameSite=Lax, this is defence in depth). */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.headers.origin
  if (origin) {
    const allowed = new Set([
  config.publicUrl,
  config.appUrl,
  process.env.FRONTEND_URL,
].filter(Boolean))
    // Same-origin requests (Host header match) are always fine.
    const sameHost = (() => {
      try {
        return new URL(origin).host === req.headers.host
      } catch {
        return false
      }
    })()
    if (!allowed.has(origin) && !sameHost) {
      res.status(403).json({ error: 'bad_origin', message: 'Request origin not allowed.' })
      return
    }
  }
  next()
}

export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email ?? null,
  phone: u.phone ?? null,
  provider: u.googleSub ? 'google' : u.phone && !u.passwordHash ? 'phone' : 'password',
})
