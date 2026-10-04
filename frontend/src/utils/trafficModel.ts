import type { TransportMode } from '@/types'

/**
 * Deterministic, time-of-day traffic and crowd model for the demo dataset.
 * These are modelled estimates, NOT live readings, and are labelled as such
 * wherever they are shown.
 */

// Smooth bump centred on `mid` hours with half-width `width` hours.
function bump(hour: number, mid: number, width: number): number {
  const d = (hour - mid) / width
  return Math.exp(-d * d)
}

/** Fractional local hour (0-24) for a Date. */
export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}

/** 0 (free flowing) to 1 (peak congestion) for road traffic. */
export function trafficLevel(hour: number, weekend = false): number {
  const morning = bump(hour, 9.2, 1.3)
  const evening = bump(hour, 18.6, 1.6)
  const midday = 0.25 * bump(hour, 13, 2.5)
  const base = Math.max(morning, evening, midday)
  return Math.min(1, weekend ? base * 0.6 : base)
}

/** Multiplier on road-leg time (bus, auto). 1 = free flow, up to about 1.7 at peak. */
export function roadSlowdown(hour: number, weekend = false): number {
  return 1 + 0.7 * trafficLevel(hour, weekend)
}

/** 0-100 crowding for a mode at a given hour. Road modes crowd with the peaks, Metro/rail crowd harder. */
export function crowdLevel(mode: TransportMode, hour: number, weekend = false): number {
  if (mode === 'walk' || mode === 'auto') return 0
  const peak = Math.max(bump(hour, 9.0, 1.1), bump(hour, 18.3, 1.4))
  const shoulder = 0.3 * bump(hour, 13, 2.5)
  const raw = Math.max(peak, shoulder)
  const scale = mode === 'suburban-rail' ? 100 : mode === 'bus' ? 92 : 78
  const wk = weekend ? 0.55 : 1
  return Math.round(Math.min(100, (raw * scale + 8) * wk))
}

export function crowdLabel(percent: number): 'Quiet' | 'Moderate' | 'Busy' | 'Packed' {
  if (percent < 30) return 'Quiet'
  if (percent < 55) return 'Moderate'
  if (percent < 80) return 'Busy'
  return 'Packed'
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}
