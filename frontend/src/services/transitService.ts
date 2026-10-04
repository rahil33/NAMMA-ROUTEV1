import type { Journey, JourneySearchParams } from '@/types'
import { api } from '@/services/api'

export interface TransitStatus {
  planner: 'otp' | 'none'
  chennaiOneUrl: string | null
  officialLinks: { id: string; label: string; url: string }[]
}

let cached: Promise<TransitStatus | null> | null = null

/** What public-transport integrations this deployment has. null = the API is unreachable. */
export function transitStatus(): Promise<TransitStatus | null> {
  cached ??= api<TransitStatus>('/api/transit/status', { timeoutMs: 5000 }).catch(() => {
    cached = null // retry next time
    return null
  })
  return cached
}

export async function planLiveTransit(params: JourneySearchParams): Promise<Journey[]> {
  const { origin: o, destination: d } = params
  const q = new URLSearchParams({
    fromLat: String(o.lat), fromLng: String(o.lng), toLat: String(d.lat), toLng: String(d.lng),
    oId: o.id, oName: o.name, dId: d.id, dName: d.name,
    time: params.arriveBy ?? params.departAt, arriveBy: params.arriveBy ? 'true' : 'false',
  })
  const { journeys } = await api<{ journeys: Journey[] }>(`/api/transit/plan?${q}`, { timeoutMs: 15000 })
  // Server returns origin/destination without the app's richer Location data; restore it.
  return journeys.map((j) => ({ ...j, origin: o, destination: d }))
}
