import type { Journey, JourneySegment } from '@/types'
import { LastMilePanel } from '@/components/rides/LastMilePanel'
import { STATION_LABEL, stationKind } from '@/utils/stations'

const ends = (s: JourneySegment) => {
  const a = s.polyline[0]
  const b = s.polyline[s.polyline.length - 1]
  return a && b ? { from: { name: s.from, lng: a[0], lat: a[1] }, to: { name: s.to, lng: b[0], lat: b[1] } } : null
}

/**
 * Last-mile options for a chosen journey: one comparison per auto/cab leg of the plan, plus a direct-ride
 * comparison when the pickup or drop is a bus stop, railway or metro station.
 */
export function JourneyRides({ journey, budgetRupees }: { journey: Journey; budgetRupees?: number }) {
  const autoLegs = journey.segments.filter((s) => s.mode === 'auto')
  const originKind = stationKind(journey.origin)
  const destKind = stationKind(journey.destination)
  const station = originKind ? { place: journey.origin.name, kind: originKind, role: 'pickup' } : destKind ? { place: journey.destination.name, kind: destKind, role: 'drop' } : null
  if (autoLegs.length === 0 && !station) return null

  const nonAutoFare = journey.segments.filter((s) => s.mode !== 'auto').reduce((sum, s) => sum + (s.fareRupees ?? 0), 0)
  const remaining = budgetRupees !== undefined ? Math.max(0, budgetRupees - nonAutoFare) : undefined

  return (
    <div className="mt-5 flex flex-col gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">Last-mile rides</h2>
      {autoLegs.map((leg) => {
        const e = ends(leg)
        return e ? <LastMilePanel key={leg.id} title={`Ride for “${leg.from} → ${leg.to}”`} {...e} budgetRupees={remaining} /> : null
      })}
      {autoLegs.length === 0 && station && (
        <>
          <p className="text-xs text-[var(--color-ink-700)]">Your {station.role} is a {STATION_LABEL[station.kind]} ({station.place}). Compare a direct ride for the whole trip, or for the last stretch.</p>
          <LastMilePanel
            title="Ride the whole way"
            from={{ name: journey.origin.name, lat: journey.origin.lat, lng: journey.origin.lng }}
            to={{ name: journey.destination.name, lat: journey.destination.lat, lng: journey.destination.lng }}
            budgetRupees={budgetRupees}
          />
        </>
      )}
    </div>
  )
}
