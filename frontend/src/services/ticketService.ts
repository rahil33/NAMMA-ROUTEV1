import type { Journey, JourneySegment, TransportMode } from '@/types'

// DEMO tickets only. NammaRoute has no agreement or API connection with MTC, CMRL
// or Southern Railway, so these QR codes will NOT open a real gate or satisfy a
// conductor. The provider interface below is where a real operator integration
// would plug in later.

export type TicketMode = Extract<TransportMode, 'bus' | 'metro' | 'suburban-rail'>

export interface Ticket {
  id: string
  journeyId: string
  mode: TicketMode
  lineName?: string
  from: string
  to: string
  fareRupees: number
  issuedAt: string
  validUntil: string
  /** Text encoded in the QR code. */
  payload: string
  isDemo: true
}

export interface TicketProvider {
  readonly name: string
  issue(journey: Journey): Ticket[]
}

const STORAGE_KEY = 'nammaroute.tickets.v1'
const VALID_MINUTES = 120
const TICKET_MODES: TransportMode[] = ['bus', 'metro', 'suburban-rail']

const isTicketed = (s: JourneySegment): s is JourneySegment & { mode: TicketMode } =>
  TICKET_MODES.includes(s.mode) && (s.fareRupees ?? 0) > 0

/** Legs that can carry a ticket (walking and autos don't). */
export function ticketableLegs(journey: Journey) {
  return journey.segments.filter(isTicketed)
}

export function totalTicketFare(journey: Journey): number {
  return ticketableLegs(journey).reduce((sum, s) => sum + (s.fareRupees ?? 0), 0)
}

class DemoTicketProvider implements TicketProvider {
  readonly name = 'NammaRoute demo tickets'

  issue(journey: Journey): Ticket[] {
    const issued = new Date()
    const valid = new Date(issued.getTime() + VALID_MINUTES * 60000)
    return ticketableLegs(journey).map((s, i) => {
      const id = `T${issued.getTime().toString(36).toUpperCase()}${i}`
      return {
        id,
        journeyId: journey.id,
        mode: s.mode,
        lineName: s.lineName,
        from: s.from,
        to: s.to,
        fareRupees: s.fareRupees ?? 0,
        issuedAt: issued.toISOString(),
        validUntil: valid.toISOString(),
        payload: `NAMMAROUTE-DEMO|${id}|${s.mode}|${s.from}|${s.to}|${s.fareRupees ?? 0}|${valid.toISOString()}`,
        isDemo: true as const,
      }
    })
  }
}

export const ticketProvider: TicketProvider = new DemoTicketProvider()

export function loadTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Ticket[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(tickets: Ticket[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets.slice(0, 40)))
  } catch {
    /* storage unavailable; tickets last for this session only */
  }
  window.dispatchEvent(new Event('nammaroute:tickets'))
}

/** Issues tickets for a journey, skipping any leg that already has one. */
export function issueTickets(journey: Journey): Ticket[] {
  const existing = loadTickets()
  const have = new Set(existing.filter((t) => t.journeyId === journey.id).map((t) => `${t.from}|${t.to}|${t.mode}`))
  const fresh = ticketProvider.issue(journey).filter((t) => !have.has(`${t.from}|${t.to}|${t.mode}`))
  if (fresh.length) save([...fresh, ...existing])
  return fresh
}

export function removeTicket(id: string) {
  save(loadTickets().filter((t) => t.id !== id))
}

export function isExpired(t: Ticket, now = new Date()): boolean {
  return new Date(t.validUntil).getTime() < now.getTime()
}

export const TICKETS_EVENT = 'nammaroute:tickets'
