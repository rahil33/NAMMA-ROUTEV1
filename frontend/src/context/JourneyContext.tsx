import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Journey, JourneySearchParams, LiveJourneyState, ServiceAlert } from '@/types'
import { routingService } from '@/services/routingService'
import { usePreferences } from './preferences'
import { JourneyContext, type JourneyContextValue } from './journey'
import { useJourneyHistory } from '@/hooks/useJourneyHistory'

const DEMO_ALERT: ServiceAlert = {
  id: 'alert-demo-1',
  severity: 'minor',
  message: 'Demo alert: a 12-minute delay is simulated on your current line. No real service data is used.',
  isDemo: true,
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences()
  const { record } = useJourneyHistory()
  const [searchParams, setSearchParams] = useState<JourneySearchParams | null>(null)
  const [results, setResults] = useState<Journey[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null)
  const [liveState, setLiveState] = useState<LiveJourneyState | null>(null)

  const search = useCallback(
    async (params: JourneySearchParams) => {
      setLoading(true)
      setSearchParams(params)
      const journeys = await routingService.planJourney(params)
      setResults(journeys)
      setSelectedJourneyId(journeys[0]?.id ?? null)
      setLoading(false)
      if (preferences.privacy.storeHistory && journeys[0]) {
        await record(journeys[0], 'searched')
      }
    },
    [preferences.privacy.storeHistory, record],
  )

  const selectedJourney = useMemo(
    () => results.find((j) => j.id === selectedJourneyId) ?? null,
    [results, selectedJourneyId],
  )

  const selectJourney = useCallback((journeyId: string) => setSelectedJourneyId(journeyId), [])

  const openJourney = useCallback(
    (journey: Journey) => {
      setSearchParams({
        origin: journey.origin,
        destination: journey.destination,
        departAt: journey.departAt,
        preference: {
          optimizeFor: preferences.optimizeFor,
          priorities: preferences.priorities,
          rainMode: preferences.rainMode,
          budgetRupees: preferences.budgetRupees,
          accessibility: preferences.accessibility,
        },
      })
      setResults([journey])
      setSelectedJourneyId(journey.id)
    },
    [preferences],
  )

  const startLiveJourney = useCallback(() => {
    if (!selectedJourney) return
    setLiveState({ journey: selectedJourney, currentSegmentIndex: 0, status: 'in-progress' })
  }, [selectedJourney])

  const advanceLiveJourney = useCallback(() => {
    if (!liveState || liveState.status === 'completed') return
    const nextIndex = liveState.currentSegmentIndex + 1
    if (nextIndex >= liveState.journey.segments.length) {
      setLiveState({ ...liveState, status: 'completed', activeAlert: undefined, notice: undefined })
      if (preferences.privacy.storeHistory) void record(liveState.journey, 'completed')
      return
    }
    setLiveState({ ...liveState, currentSegmentIndex: nextIndex, status: 'in-progress', activeAlert: undefined })
  }, [liveState, preferences.privacy.storeHistory, record])

  const triggerDemoAlert = useCallback(() => {
    setLiveState((prev) => (prev ? { ...prev, status: 'alert', activeAlert: DEMO_ALERT, notice: undefined } : prev))
  }, [])

  const missStop = useCallback((message: string) => {
    setLiveState((prev) =>
      prev
        ? { ...prev, status: 'alert', notice: undefined, activeAlert: { id: 'alert-missed-stop', severity: 'minor', message, isDemo: true } }
        : prev,
    )
  }, [])

  const findAlternative = useCallback(() => {
    if (!liveState) return
    const alternative = results.find((j) => j.id !== liveState.journey.id)
    if (!alternative) {
      setLiveState({ ...liveState, status: 'in-progress', activeAlert: undefined, notice: 'No other route is available in the demo data.' })
      return
    }
    setSelectedJourneyId(alternative.id)
    setLiveState({
      journey: alternative,
      currentSegmentIndex: 0,
      status: 'in-progress',
      notice: `Switched to the ${alternative.tag.replace('-', ' ')} route (demo reroute).`,
    })
  }, [liveState, results])

  const resetLiveJourney = useCallback(() => setLiveState(null), [])

  const value: JourneyContextValue = {
    searchParams,
    results,
    loading,
    selectedJourney,
    liveState,
    search,
    selectJourney,
    openJourney,
    startLiveJourney,
    advanceLiveJourney,
    triggerDemoAlert,
    findAlternative,
    missStop,
    resetLiveJourney,
  }

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
}
