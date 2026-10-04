import { useSyncExternalStore } from 'react'
import type { Journey } from '@/types'
import { api } from '@/services/api'
import { distanceM, distanceToPathM, isOffRoute } from '@/utils/deviation'
import type { GuardianConfig } from '@/services/guardianConfigStore'

// One journey-sharing session per tab. It lives outside React so StrictMode remounts or route changes
// never send duplicate "started"/"ended" messages to a guardian.

export type Permission = 'unknown' | 'granted' | 'denied' | 'unsupported'
export interface SessionState {
  phase: 'idle' | 'starting' | 'sharing' | 'error'
  token: string | null
  permission: Permission
  lastPos: { lat: number; lng: number; accuracy?: number; at: number } | null
  /** Why deviation alerts are or aren't active. */
  deviation: 'off' | 'active' | 'demo-journey'
  offRoute: boolean
  checkInDeadline: number | null
  message: string | null
  /** false when we know the guardian could not be messaged automatically (no SMS provider / not signed in). */
  autoAlerts: boolean | null
}

const INITIAL: SessionState = { phase: 'idle', token: null, permission: 'unknown', lastPos: null, deviation: 'off', offRoute: false, checkInDeadline: null, message: null, autoAlerts: null }
const PING_MS = 15_000
const CHECK_MS = 20_000
const MOVE_M = 40
const CHECKIN_WINDOW_MS = 60_000

let state: SessionState = INITIAL
const listeners = new Set<() => void>()
const set = (patch: Partial<SessionState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let watchId: number | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let checkTimer: ReturnType<typeof setInterval> | null = null
let cfg: GuardianConfig | null = null
let plannedPath: [number, number][] = []
let recentDistances: number[] = []
let anchor: { lat: number; lng: number; at: number } | null = null
let lastPinged = 0
let deviationSent = 0
let inactivitySent = false

const plannedPathOf = (j: Journey): [number, number][] => j.segments.flatMap((s) => s.polyline)

function onFix(p: GeolocationPosition) {
  const { latitude: lat, longitude: lng, accuracy } = p.coords
  set({ permission: 'granted', lastPos: { lat, lng, accuracy, at: Date.now() } })
  if (!anchor || distanceM(lat, lng, anchor.lat, anchor.lng) > MOVE_M) {
    anchor = { lat, lng, at: Date.now() }
    inactivitySent = false
    if (state.checkInDeadline) set({ checkInDeadline: null })
  }
  if (cfg && state.deviation === 'active') {
    recentDistances.push(distanceToPathM(lat, lng, plannedPath))
    recentDistances = recentDistances.slice(-6)
    const off = isOffRoute(recentDistances, cfg.deviationMeters, accuracy)
    set({ offRoute: off })
    if (off && Date.now() - deviationSent > 5 * 60_000) {
      deviationSent = Date.now()
      void sendEvent('deviation')
    }
  }
}

function onGeoError(e: GeolocationPositionError) {
  set({ permission: e.code === e.PERMISSION_DENIED ? 'denied' : state.permission, message: e.code === e.PERMISSION_DENIED ? 'Location is off, so your guardian can’t see where you are. Turn on location permission for this site.' : state.message })
}

async function ping() {
  const pos = state.lastPos
  if (!pos || !state.token || Date.now() - lastPinged < PING_MS - 500) return
  lastPinged = Date.now()
  try {
    await api(`/api/guardian/share/${state.token}/ping`, { body: { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }, timeoutMs: 8000 })
  } catch {
    /* offline blips are fine; the next ping carries the newest position */
  }
}

async function sendEvent(type: 'deviation' | 'inactivity' | 'end') {
  if (!state.token) return
  try {
    const r = await api<{ delivery: { sent: boolean } }>(`/api/guardian/share/${state.token}/event`, { body: { type }, timeoutMs: 8000 })
    if (!r.delivery.sent && type !== 'end') set({ message: 'We couldn’t message your guardian automatically. Use the SOS button if you need help.' })
  } catch {
    if (type !== 'end') set({ message: 'No connection, so your guardian could not be alerted. Use the SOS button if you need help.' })
  }
}

function checkInactivity() {
  if (!cfg?.inactivityMinutes || !anchor) return
  const idleMs = Date.now() - anchor.at
  if (state.checkInDeadline) {
    if (Date.now() > state.checkInDeadline && !inactivitySent) {
      inactivitySent = true
      set({ checkInDeadline: null })
      void sendEvent('inactivity')
    }
  } else if (idleMs > cfg.inactivityMinutes * 60_000 && !inactivitySent) {
    set({ checkInDeadline: Date.now() + CHECKIN_WINDOW_MS })
    if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 600])
  }
}

export const guardianSession = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },

  async start(journey: Journey, config: GuardianConfig): Promise<void> {
    if (state.phase === 'starting' || state.phase === 'sharing') return
    cfg = config
    plannedPath = plannedPathOf(journey)
    recentDistances = []
    anchor = null
    inactivitySent = false
    deviationSent = 0
    // Deviation alerts compare real GPS with the planned path, which is only meaningful for planner-backed journeys.
    set({ ...INITIAL, phase: 'starting', deviation: journey.source === 'live' ? 'active' : 'demo-journey' })
    try {
      const r = await api<{ token: string; delivery: { sent: boolean; reason?: string } }>('/api/guardian/share/start', {
        body: { title: `${journey.origin.name} to ${journey.destination.name}`, origin: journey.origin.name, destination: journey.destination.name },
      })
      set({ phase: 'sharing', token: r.token, autoAlerts: r.delivery.sent || r.delivery.reason !== 'sms_unconfigured' })
    } catch {
      set({ phase: 'error', message: 'Could not start live location sharing. Check your connection. SOS still works.' })
      return
    }
    if (!('geolocation' in navigator)) {
      set({ permission: 'unsupported', message: 'This device can’t share its location.' })
      return
    }
    watchId = navigator.geolocation.watchPosition(onFix, onGeoError, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 })
    pingTimer = setInterval(() => void ping(), PING_MS)
    checkTimer = setInterval(checkInactivity, CHECK_MS)
  },

  /** The traveller tapped "I'm OK" on the inactivity prompt. */
  confirmOk() {
    anchor = state.lastPos ? { lat: state.lastPos.lat, lng: state.lastPos.lng, at: Date.now() } : anchor && { ...anchor, at: Date.now() }
    inactivitySent = false
    set({ checkInDeadline: null })
  },

  async end(): Promise<void> {
    if (state.phase === 'idle') return
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    if (pingTimer) clearInterval(pingTimer)
    if (checkTimer) clearInterval(checkTimer)
    watchId = pingTimer = checkTimer = null
    if (state.token) await sendEvent('end') // always recorded; the server decides about SMS from the guardian settings
    set({ ...INITIAL, permission: state.permission, lastPos: state.lastPos })
  },
}

export function useGuardianSession(): SessionState {
  return useSyncExternalStore(guardianSession.subscribe, guardianSession.getState, guardianSession.getState)
}
