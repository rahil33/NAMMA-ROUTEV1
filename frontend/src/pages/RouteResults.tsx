import { useMemo, useState } from 'react'
import type { Journey } from '@/types'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import { RouteCard } from '@/components/results/RouteCard'
import { MapView } from '@/components/map/MapView'
import { MapStyleToggle } from '@/components/map/MapStyleToggle'
import { DataSourceBadge } from '@/components/common/Badge'
import { ResultsNotes } from '@/components/results/Comfort'
import { useJourney } from '@/context/journey'
import { usePreferences } from '@/context/preferences'
import { SearchAlongRoute } from '@/components/map/SearchAlongRoute'
import { poiService, type PoiCategory } from '@/services/poiService'

export function RouteResults() {
  const navigate = useNavigate()
  const { searchParams, results, loading, selectedJourney, selectJourney } = useJourney()
  const { preferences, setMapStyle } = usePreferences()
  const [sheetExpanded, setSheetExpanded] = useState(true)
  const [fitToken, setFitToken] = useState(0)
  const [poiCategories, setPoiCategories] = useState<PoiCategory[]>([])
  const pois = useMemo(
    () => (selectedJourney ? poiService.searchAlongRoute(selectedJourney, poiCategories) : []),
    [selectedJourney, poiCategories],
  )

  if (!searchParams) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-[var(--color-ink-700)]">Plan a journey first to see route options.</p>
        <button onClick={() => navigate('/')} className="text-sm font-medium text-[var(--color-line-teal-600)] hover:underline">
          Back to planner
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Desktop: card list */}
      <div className="hidden w-[380px] shrink-0 flex-col overflow-y-auto p-4 lg:flex">
        <ResultsHeader searchParams={searchParams} journey={results[0]} onBack={() => navigate('/')} />
        <RainModeNote preference={searchParams.preference} topIsRainFriendly={Boolean(results[0]?.rainOptimized)} />
        {!loading && <ResultsNotes journeys={results} priorities={searchParams.preference.priorities?.length ? searchParams.preference.priorities : [searchParams.preference.optimizeFor]} />}
        <div className="mt-3 flex flex-col gap-4">
          {loading && <LoadingCards />}
          {!loading &&
            results.map((journey, i) => (
              <RouteCard
                key={journey.id}
                journey={journey}
                recommended={i === 0}
                selected={journey.id === selectedJourney?.id}
                onSelect={() => selectJourney(journey.id)}
                onOpenDetails={() => {
                  selectJourney(journey.id)
                  navigate('/details')
                }}
              />
            ))}
        </div>
      </div>

      {/* Map (shared) */}
      <div className="relative min-h-[45vh] flex-1 lg:min-h-0">
        <MapView
          journeys={results}
          selectedJourneyId={selectedJourney?.id ?? null}
          mapStyle={preferences.mapStyle}
          fitToken={fitToken}
          onSelectJourney={selectJourney}
          pois={pois}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-3 pr-14 lg:p-4 lg:pr-14">
          <button
            onClick={() => navigate('/')}
            className="glass-surface pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full lg:hidden"
            aria-label="Back to planner"
          >
            <ArrowLeft size={16} aria-hidden />
          </button>
          <SearchAlongRoute active={poiCategories} onChange={setPoiCategories} />
        </div>
        <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-end gap-2">
          <MapStyleToggle value={preferences.mapStyle} onChange={setMapStyle} />
          <button
            onClick={() => setFitToken((t) => t + 1)}
            className="glass-surface flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
          >
            <Maximize2 size={12} aria-hidden />
            Fit to route
          </button>
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className={`glass-surface z-10 flex flex-col rounded-t-[var(--radius-sheet)] lg:hidden ${
          sheetExpanded ? 'max-h-[62vh]' : 'max-h-[92px]'
        } transition-[max-height] duration-200`}
      >
        <button
          onClick={() => setSheetExpanded((v) => !v)}
          className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[var(--color-ink-700)]"
          aria-expanded={sheetExpanded}
        >
          <span className="h-1 w-9 rounded-full bg-black/15" />
          {sheetExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <div className="overflow-y-auto px-4 pb-4">
          <ResultsHeader searchParams={searchParams} journey={results[0]} onBack={() => navigate('/')} compact />
          <RainModeNote preference={searchParams.preference} topIsRainFriendly={Boolean(results[0]?.rainOptimized)} />
          {!loading && <ResultsNotes journeys={results} priorities={searchParams.preference.priorities?.length ? searchParams.preference.priorities : [searchParams.preference.optimizeFor]} />}
          <div className="mt-3 flex flex-col gap-4">
            {loading && <LoadingCards />}
            {!loading &&
              results.map((journey, i) => (
                <RouteCard
                  key={journey.id}
                  journey={journey}
                  recommended={i === 0}
                  selected={journey.id === selectedJourney?.id}
                  onSelect={() => selectJourney(journey.id)}
                  onOpenDetails={() => {
                    selectJourney(journey.id)
                    navigate('/details')
                  }}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultsHeader({
  searchParams,
  journey,
  onBack,
  compact,
}: {
  searchParams: NonNullable<ReturnType<typeof useJourney>['searchParams']>
  journey?: Journey
  onBack: () => void
  compact?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        {!compact && (
          <button onClick={onBack} className="mb-2 flex items-center gap-1 text-xs font-medium text-[var(--color-ink-700)] hover:underline">
            <ArrowLeft size={12} aria-hidden />
            Edit search
          </button>
        )}
        <h1 className="text-xl font-extrabold tracking-tight">
          {searchParams.origin.name} <span className="text-[var(--color-ink-700)]">→</span> {searchParams.destination.name}
        </h1>
      </div>
      <DataSourceBadge journey={journey} />
    </div>
  )
}

function RainModeNote({
  preference,
  topIsRainFriendly,
}: {
  preference: { rainMode: boolean; accessibility: { wheelchair: boolean } }
  topIsRainFriendly: boolean
}) {
  return (
    <>
      {preference.accessibility.wheelchair && (
        <p className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-xs text-[var(--color-ink-800)]">
          Wheelchair preference is on: routes are limited to step-free options in the demo data, which is not verified.
        </p>
      )}
      {preference.rainMode && <RainModeMessage topIsRainFriendly={topIsRainFriendly} />}
    </>
  )
}

function RainModeMessage({ topIsRainFriendly }: { topIsRainFriendly: boolean }) {
  return (
    <p className="mt-2 rounded-2xl bg-[var(--color-line-blue-500)]/10 px-4 py-3 text-xs text-[var(--color-line-blue-500)]">
      {topIsRainFriendly
        ? 'Rain Mode selected a route with less outdoor walking. '
        : 'Rain Mode is on, but the top route does not reduce outdoor exposure versus your default pick. Routes marked Rain-friendly do. '}
      This uses demo data, not live weather or flood information.
    </p>
  )
}

function LoadingCards() {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-[var(--radius-sheet)] bg-white/60" />
      ))}
    </div>
  )
}
