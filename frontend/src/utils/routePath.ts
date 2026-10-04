type LngLat = [number, number]

const LNG_SCALE = 0.974 // cos(13°): keeps distances roughly isotropic around Chennai

function dist(a: LngLat, b: LngLat): number {
  return Math.hypot((b[0] - a[0]) * LNG_SCALE, b[1] - a[1])
}

/** Point at `fraction` (0–1) of the path length, plus the next vertex for direction. */
export function pointAlong(coords: LngLat[], fraction: number): { point: LngLat; next: LngLat } | null {
  if (coords.length === 0) return null
  if (coords.length === 1) return { point: coords[0], next: coords[0] }
  const lengths = coords.slice(1).map((c, i) => dist(coords[i], c))
  const total = lengths.reduce((a, b) => a + b, 0)
  let remaining = Math.min(Math.max(fraction, 0), 1) * total
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : Math.min(remaining / lengths[i], 1)
      const a = coords[i]
      const b = coords[i + 1]
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], next: b }
    }
    remaining -= lengths[i]
  }
  return null
}

/** Shifts a point sideways (perpendicular to the direction of travel) by roughly `meters`. */
export function offsetPoint(point: LngLat, next: LngLat, meters: number): LngLat {
  const dx = next[0] - point[0]
  const dy = next[1] - point[1]
  const len = Math.hypot(dx, dy) || 1
  const deg = meters / 111000
  return [point[0] + (-dy / len) * deg, point[1] + (dx / len) * deg]
}
