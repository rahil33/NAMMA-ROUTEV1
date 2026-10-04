import { useJourneyHistory } from '@/hooks/useJourneyHistory'
import { DemoDataBadge } from '@/components/common/Badge'
import { passengerInsights } from '@/utils/commuterIntel'
import { formatDistance } from '@/utils/formatting'

export function Insights() {
  const { records } = useJourneyHistory()
  const i = passengerInsights(records)
  const stats = [
    ['Journeys this month', String(i.journeys)],
    ['Distance (straight-line)', `${i.km} km`],
    ['Walking', formatDistance(i.walkMeters)],
    ['Est. money saved vs autos', `₹${i.savedRupees}`],
    ['Est. CO₂ avoided', `${i.co2Kg} kg`],
  ]
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Passenger Insights</h1>
        <DemoDataBadge />
      </div>
      <dl className="grid grid-cols-2 gap-2.5">
        {stats.map(([label, value]) => (
          <div key={label} className="soft-card rounded-[var(--radius-card)] p-5">
            <dt className="text-xs text-[var(--color-ink-700)]">{label}</dt>
            <dd className="mt-1 text-3xl font-extrabold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-[var(--color-ink-700)]">
        Counts searched and completed journeys saved in this browser. Savings and CO₂ are rough estimates (autos at ~₹17/km, ~0.1 kg CO₂ per km avoided), not measurements.
      </p>
    </div>
  )
}
