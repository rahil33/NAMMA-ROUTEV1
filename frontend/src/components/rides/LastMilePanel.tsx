import { Bike, Car, ExternalLink, Loader2, RefreshCw, Zap } from 'lucide-react'
import { useRideOptions, type Point } from '@/services/rideService'
import { recommendRides, totalMinutes, VALUE_OF_TIME_PER_MIN, type RideOptionDto } from '@/utils/rideRanking'
import { formatDuration } from '@/utils/formatting'
import { Button } from '@/components/common/Button'

const VehicleIcon = ({ v }: { v: RideOptionDto['vehicle'] }) => (v === 'bike' ? <Bike size={18} aria-hidden /> : v === 'auto' ? <Zap size={18} aria-hidden /> : <Car size={18} aria-hidden />)
const fare = (o: RideOptionDto) => (o.fare ? (Math.round(o.fare.low) === Math.round(o.fare.high) ? `₹${Math.round(o.fare.low)}` : `₹${Math.round(o.fare.low)}–${Math.round(o.fare.high)}`) : null)

export function LastMilePanel({ title, from, to, budgetRupees }: { title: string; from: Point; to: Point; budgetRupees?: number }) {
  const { state, retry } = useRideOptions(from, to)

  return (
    <section className="soft-card rounded-[var(--radius-card)] p-4" aria-label={title}>
      <h3 className="text-base font-extrabold tracking-tight">{title}</h3>
      <p className="text-xs font-medium text-[var(--color-ink-700)]">{from.name} → {to.name}</p>

      {state.status === 'loading' && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink-700)]"><Loader2 size={16} className="animate-spin" aria-hidden /> Checking ride options…</p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="mt-3 rounded-2xl bg-[var(--color-warn-600)]/10 p-3 text-sm">
          <p className="font-semibold text-[var(--color-warn-600)]">{state.unreachable ? 'Ride comparison is unavailable right now.' : state.message}</p>
          <Button className="mt-2" size="sm" variant="secondary" onClick={retry}><RefreshCw size={14} aria-hidden /> Try again</Button>
        </div>
      )}

      {state.status === 'ready' && <Ready data={state.data} budgetRupees={budgetRupees} />}
    </section>
  )
}

function Ready({ data, budgetRupees }: { data: NonNullable<Extract<ReturnType<typeof useRideOptions>['state'], { status: 'ready' }>['data']>; budgetRupees?: number }) {
  const routeMin = data.route?.durationMin
  const rec = recommendRides(data.options, routeMin, budgetRupees)
  const picks: [string, RideOptionDto | null][] = [['Cheapest', rec.cheapest], ['Fastest', rec.fastest], ['Best value', rec.bestValue]]
  const labelsFor = (o: RideOptionDto) => picks.filter(([, p]) => p?.id === o.id).map(([l]) => l)

  return (
    <>
      {data.route ? (
        <p className="mt-2 text-sm font-semibold">
          {data.route.distanceKm} km · about {formatDuration(data.route.durationMin)} by road
          <span className="ml-1 text-xs font-normal text-[var(--color-ink-700)]">(road-network estimate, without traffic)</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-ink-700)]">Road distance isn’t available right now.</p>
      )}

      {rec.pricedCount === 0 ? (
        <p className="mt-3 rounded-2xl bg-black/5 p-3 text-sm">
          Live fares aren’t connected for any provider here, so we can’t rank by price or ETA. Open an app below to see its own fare and pickup time.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Recommendations">
          {picks.map(([label, o]) => (
            <div key={label} className={`rounded-2xl p-2.5 text-center ${o ? 'bg-[var(--color-ink-950)] text-white' : 'bg-black/5 text-[var(--color-ink-700)]'}`}>
              <p className="text-xs font-bold">{label}</p>
              {o ? (
                <>
                  <p className="text-sm font-extrabold">{fare(o)}</p>
                  <p className="text-[11px] opacity-80">{o.providerName} {o.product !== o.providerName ? o.product : ''}</p>
                </>
              ) : (
                <p className="text-[11px]">Needs ETA data</p>
              )}
            </div>
          ))}
        </div>
      )}
      {rec.budget && (
        <p role="status" className={`mt-2 text-xs font-semibold ${rec.budget.allOver ? 'text-[var(--color-warn-600)]' : 'text-[var(--color-ok-600)]'}`}>
          {rec.budget.allOver ? `Every priced option is above your ₹${Math.round(rec.budget.rupees)} budget.` : `Recommendations are limited to options within your ₹${Math.round(rec.budget.rupees)} budget.`}
        </p>
      )}
      {rec.pricedCount > 0 && <p className="mt-1 text-[11px] text-[var(--color-ink-700)]">“Best value” counts ₹{VALUE_OF_TIME_PER_MIN} per minute of your time. Fares are estimates; the provider confirms the final price.</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {data.options.map((o) => {
          const total = totalMinutes(o, routeMin)
          const tags = labelsFor(o)
          return (
            <li key={o.id} className="rounded-2xl border border-black/10 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-[var(--color-ink-800)]"><VehicleIcon v={o.vehicle} /></span>
                  <div>
                    <p className="text-sm font-extrabold">{o.providerName}{o.product !== o.providerName ? ` · ${o.product}` : ''}</p>
                    <p className="text-xs text-[var(--color-ink-700)]">{o.source === 'api' ? 'Estimate from provider API' : 'External app (no live price)'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{fare(o) ?? 'Fare in app'}</p>
                  <p className="text-xs text-[var(--color-ink-700)]">{o.etaMin !== undefined ? `Pickup ~${o.etaMin} min` : 'ETA in app'}</p>
                </div>
              </div>
              {total !== null && <p className="mt-1 text-xs font-semibold">Total about {formatDuration(total)} including pickup</p>}
              {tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="rounded-full bg-[var(--color-primary)]/30 px-2 py-0.5 text-[11px] font-bold">{t}</span>)}</p>}
              {o.error && <p className="mt-1 text-xs font-semibold text-[var(--color-warn-600)]">{o.note}</p>}
              <a
                href={o.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-4 text-sm font-bold text-[var(--color-ink-950)]"
              >
                Continue in {o.providerName} <ExternalLink size={14} aria-hidden />
              </a>
              {!o.error && <p className="mt-1 text-[11px] text-[var(--color-ink-700)]">{o.note}</p>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
