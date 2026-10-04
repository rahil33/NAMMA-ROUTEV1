import type { Location } from '@/types'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: Location, b: Location): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Builds a gently curved polyline between two points so alternative routes
 * are visually distinguishable on the map instead of overlapping straight
 * lines. `bend` shifts the midpoint perpendicular to the direct line,
 * roughly in km.
 */
export function curvedPolyline(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  bend = 0,
  steps = 12,
): [number, number][] {
  const midLat = (from.lat + to.lat) / 2
  const midLng = (from.lng + to.lng) / 2

  // Perpendicular direction to the from->to vector, scaled to degrees.
  const dLat = to.lat - from.lat
  const dLng = to.lng - from.lng
  const len = Math.hypot(dLat, dLng) || 1
  const perpLat = -dLng / len
  const perpLng = dLat / len
  const bendDeg = bend / 111 // ~111km per degree latitude

  const controlLat = midLat + perpLat * bendDeg
  const controlLng = midLng + perpLng * bendDeg

  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Quadratic Bezier interpolation
    const lat =
      (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * controlLat + t ** 2 * to.lat
    const lng =
      (1 - t) ** 2 * from.lng + 2 * (1 - t) * t * controlLng + t ** 2 * to.lng
    points.push([lng, lat])
  }
  return points
}
