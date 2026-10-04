import type { TransportMode } from '@/types'

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function formatFare(rupees: number): string {
  return `₹${rupees}`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const MODE_LABEL: Record<TransportMode, string> = {
  walk: 'Walk',
  bus: 'Bus',
  metro: 'Metro',
  'suburban-rail': 'Train',
  auto: 'Auto',
}

export const OPTIMIZE_LABEL: Record<string, string> = {
  fastest: 'Fastest',
  cheapest: 'Cheapest',
  'least-walking': 'Least walking',
  'fewest-transfers': 'Fewest transfers',
  accessible: 'Accessible',
  comfortable: 'Comfortable',
  balanced: 'Balanced',
}

export const MODE_COLOR: Record<TransportMode, string> = {
  walk: '#6B7A86',
  bus: '#D9962B',
  metro: '#12A99C',
  'suburban-rail': '#3B6E9E',
  auto: '#8A5A44',
}
