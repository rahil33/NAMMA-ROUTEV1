import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CloudRain, Play, Ticket } from 'lucide-react'
import { JourneyTimeline } from '@/components/journey/JourneyTimeline'
import { MapView } from '@/components/map/MapView'
import { MapStyleToggle } from '@/components/map/MapStyleToggle'
import { Button } from '@/components/common/Button'
import { DataSourceBadge } from '@/components/common/Badge'
import { ComfortPanel } from '@/components/results/Comfort'
import { TransitInfo } from '@/components/results/TransitInfo'
import { JourneyRides } from '@/components/rides/JourneyRides'
import { useT } from '@/i18n/useT'
import { useJourney } from '@/context/journey'
import { usePreferences } from '@/context/preferences'
import { TurnList } from '@/components/journey/TurnList'
import { pathKey, useRoadPaths } from '@/services/roadRouteService'
import { PriorityParams } from '@/components/results/PriorityParams'
import { issueTickets, ticketableLegs, totalTicketFare } from '@/services/ticketService'
import { outdoorExposureMin } from '@/utils/exposure'
import { formatClock, formatDistance, formatDuration, formatFare, MODE_LABEL } from '@/utils/formatting'

export function JourneyDetails() {
  const navigate = useNavigate()
  const t = useT()
  const { selectedJourney, searchParams, results, search, startLiveJourney } = useJourney()
  const { preferences, setRainMode, setMapStyle } = usePreferences()
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [replanning, setReplanning] = useState(false)
  const roadPaths = useRoadPaths(selectedJourney ? [selectedJourney] : [])

  if (!selectedJourney || !searchParams) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-[var(--color-ink-700)]">Choose a route to see its details.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Plan a journey</Button>
      </div>
    )
  }

  async function toggleRainMode(enabled: boolean) {
    if (!searchParams) return
    setRainMode(enabled)
    setReplanning(true)
    await search({ ...searchParams, preference: { ...searchParams.preference, rainMode: enabled } })
    setReplanning(false)
    setActiveSegmentId(null)
  }

  const isLeastExposed = results.every((j) => outdoorExposureMin(selectedJourney) <= outdoorExposureMin(j))

  function start() {
    startLiveJourney()
    navigate('/live')
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="order-2 flex w-full flex-col overflow-y-auto border-black/10 p-4 lg:order-1 lg:w-[420px] lg:shrink-0">
        <div className="mb-3 flex items-start justify-between gap-2">
          <button onClick={() => navigate('/results')} className="flex items-center gap-1 text-xs font-medium text-[var(--color-ink-700)] hover:underline">
            <ArrowLeft size={12} aria-hidden />
            All routes
          </button>
          <DataSourceBadge journey={selectedJourney} />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight">
          {selectedJourney.origin.name} → {selectedJourney.destination.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-700)]">
          {formatClock(selectedJourney.departAt)} – {formatClock(selectedJourney.arriveAt)} · {formatDuration(selectedJourney.durationMin)} ·{' '}
          {selectedJourney.fareKnown === false ? 'Fare n/a' : formatFare(selectedJourney.fareRupees)} · {formatDistance(selectedJourney.walkingMeters)} walk
        </p>
        {selectedJourney.dataNotice && <p role="status" className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-xs font-medium">{selectedJourney.dataNotice}</p>}

        <PriorityParams
          journey={selectedJourney}
          results={results}
          priorities={preferences.priorities}
          rainMode={preferences.rainMode}
          budgetRupees={preferences.budgetRupees}
        />

        <button
          onClick={() => toggleRainMode(!preferences.rainMode)}
          aria-pressed={preferences.rainMode}
          disabled={replanning || results.length < 2}
          className={`mt-3 flex items-center justify-center gap-1.5 rounded-full border px-4 py-3 text-sm font-bold disabled:opacity-50 ${
            preferences.rainMode
              ? 'border-[var(--color-line-blue-500)] bg-[var(--color-line-blue-500)]/10 text-[var(--color-line-blue-500)]'
              : 'border-black/10 bg-white/70'
          }`}
        >
          <CloudRain size={15} aria-hidden />
          {preferences.rainMode ? 'Rain Mode on' : 'Turn on Rain Mode'}
        </button>
        {preferences.rainMode && (
          <p className="mt-2 rounded-[10px] bg-[var(--color-line-blue-500)]/10 px-3 py-2 text-xs text-[var(--color-line-blue-500)]">
            {selectedJourney.rainOptimized
              ? 'Rain Mode selected a route with less outdoor walking.'
              : isLeastExposed
                ? 'Rain Mode is on. This route is already among the least exposed options in the demo data.'
                : 'Rain Mode is on, but other routes have less outdoor exposure. Look for Rain-friendly routes in the results.'}{' '}
            Based on demo data only, not live weather.
          </p>
        )}

        {selectedJourney.comfort && <ComfortPanel comfort={selectedJourney.comfort} />}

        <div className="mt-5">
          <JourneyTimeline journey={selectedJourney} activeSegmentId={activeSegmentId} onSegmentClick={setActiveSegmentId} />
        </div>

        <div className="mt-2 flex flex-col gap-3">
          {selectedJourney.segments.map((seg) => {
            const path = roadPaths[pathKey(selectedJourney.id, seg.id)]
            return path && path.steps.length > 1 ? <TurnList key={seg.id} path={path} title={`${MODE_LABEL[seg.mode]}: ${seg.from} → ${seg.to}`} /> : null
          })}
        </div>

        <TransitInfo journey={selectedJourney} />
        <JourneyRides journey={selectedJourney} budgetRupees={preferences.budgetRupees} />

        {ticketableLegs(selectedJourney).length > 0 && (
          <Button
            className="mt-4 w-full"
            size="lg"
            variant="secondary"
            onClick={() => {
              issueTickets(selectedJourney)
              navigate('/tickets')
            }}
          >
            <Ticket size={16} aria-hidden />
            {t('getTickets', { fare: formatFare(totalTicketFare(selectedJourney)) })}
          </Button>
        )}

        <Button className="mt-4 w-full" size="lg" onClick={start}>
          <Play size={16} aria-hidden />
          Start journey
        </Button>
      </div>

      <div className="relative order-1 min-h-[40vh] flex-1 lg:order-2 lg:min-h-0">
        <MapView
          journeys={[selectedJourney]}
          selectedJourneyId={selectedJourney.id}
          highlightSegmentId={activeSegmentId}
          showTurns
          mapStyle={preferences.mapStyle}
          className="h-full w-full"
        />
        <div className="glass-surface pointer-events-none absolute left-3 top-3 rounded-3xl px-4 py-3">
          <p className="text-sm font-extrabold">{selectedJourney.origin.name} → {selectedJourney.destination.name}</p>
          <p className="text-xs font-semibold text-[var(--color-ink-700)]">{formatDuration(selectedJourney.durationMin)} · {formatFare(selectedJourney.fareRupees)} · {formatDistance(selectedJourney.walkingMeters)} walk</p>
        </div>
        <div className="pointer-events-none absolute right-14 top-3">
          <MapStyleToggle value={preferences.mapStyle} onChange={setMapStyle} />
        </div>
      </div>
    </div>
  )
}
