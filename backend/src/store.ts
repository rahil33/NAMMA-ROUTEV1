import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.ts'

// Small JSON-file store: durable across restarts, zero infrastructure. It is single-process and
// not meant for high write volume; swap this module for Postgres/Supabase when you scale out.

export interface User {
  id: string
  name: string
  email?: string
  phone?: string
  passwordHash?: string
  googleSub?: string
  createdAt: string
}
export interface Session { id: string; userId: string; expiresAt: number }
export interface GuardianConfig {
  enabled: boolean
  name: string
  phone: string
  deviationMeters: number
  inactivityMinutes: number | null
  notifyStartEnd: boolean
}
export interface TrackEvent { type: 'start' | 'end' | 'deviation' | 'inactivity' | 'sos' | 'info'; at: number; message: string }
export interface Share {
  token: string
  userId: string
  riderName: string
  title: string
  origin: string
  destination: string
  startedAt: number
  endedAt?: number
  last?: { lat: number; lng: number; accuracy?: number; at: number }
  trail: [number, number][]
  events: TrackEvent[]
}
export interface RoadReport {
  id: string
  userId: string
  lat: number
  lng: number
  kind: 'pothole' | 'speed-breaker' | 'rough-road' | 'closure' | 'waterlogging'
  at: number
}
export interface DB {
  users: User[]
  sessions: Session[]
  guardians: Record<string, GuardianConfig>
  shares: Share[]
  reports: RoadReport[]
}

const empty = (): DB => ({ users: [], sessions: [], guardians: {}, shares: [], reports: [] })
let db: DB | null = null
let file = ''
let timer: NodeJS.Timeout | null = null

export function loadDb(): DB {
  if (db) return db
  mkdirSync(config.dataDir, { recursive: true })
  file = join(config.dataDir, 'db.json')
  db = existsSync(file) ? { ...empty(), ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<DB>) } : empty()
  return db
}

export function flushDb(): void {
  if (!db) return
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 })
  renameSync(tmp, file)
}

/** Debounced write so bursts of location pings don't hammer the disk. */
export function persist(): void {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flushDb()
  }, 400)
  timer.unref()
}

export function resetDbForTests(): void {
  db = empty()
}
