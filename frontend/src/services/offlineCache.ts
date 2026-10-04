import type { Journey } from '@/types'

const PREFIX = 'nammaroute.offline.v1.'

function key(originId: string, destinationId: string): string {
  return `${PREFIX}${originId}.${destinationId}`
}

export function saveRoutes(originId: string, destinationId: string, journeys: Journey[]): void {
  try {
    localStorage.setItem(key(originId, destinationId), JSON.stringify(journeys))
  } catch {
    // Non-blocking: caching is best-effort.
  }
}

export function loadRoutes(originId: string, destinationId: string): Journey[] | null {
  try {
    const raw = localStorage.getItem(key(originId, destinationId))
    return raw ? (JSON.parse(raw) as Journey[]) : null
  } catch {
    return null
  }
}
