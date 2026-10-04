// Off-route detection: distance (metres) from a GPS fix to the planned path.
const M_PER_DEG = 111_320

export function distanceToPathM(lat: number, lng: number, path: [number, number][]): number {
  if (path.length === 0) return Infinity
  const k = Math.cos(lat * (Math.PI / 180))
  let best = Infinity
  for (let i = 0; i < path.length; i++) {
    const [aLng, aLat] = path[i]
    const [bLng, bLat] = path[Math.min(i + 1, path.length - 1)]
    const ax = (aLng - lng) * M_PER_DEG * k, ay = (aLat - lat) * M_PER_DEG
    const bx = (bLng - lng) * M_PER_DEG * k, by = (bLat - lat) * M_PER_DEG
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return distanceToPathM(aLat, aLng, [[bLng, bLat]])
}

/**
 * Off-route only when the fix is accurate enough to trust, and stays beyond the threshold for
 * `needed` consecutive fixes (a single GPS jump must not alarm a guardian).
 */
export function isOffRoute(distancesM: number[], thresholdM: number, accuracyM: number | undefined, needed = 3): boolean {
  if (accuracyM !== undefined && accuracyM > thresholdM) return false
  return distancesM.length >= needed && distancesM.slice(-needed).every((d) => d > thresholdM)
}
