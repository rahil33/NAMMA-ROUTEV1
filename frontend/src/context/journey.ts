import { createContext, useContext } from 'react'
import type { Journey, JourneySearchParams, LiveJourneyState } from '@/types'

export interface JourneyContextValue {
  searchParams: JourneySearchParams | null
  results: Journey[]
  loading: boolean
  selectedJourney: Journey | null
  liveState: LiveJourneyState | null
  search: (params: JourneySearchParams) => Promise<void>
  selectJourney: (journeyId: string) => void
  openJourney: (journey: Journey) => void
  startLiveJourney: () => void
  advanceLiveJourney: () => void
  triggerDemoAlert: () => void
  findAlternative: () => void
  missStop: (message: string) => void
  resetLiveJourney: () => void
}

export const JourneyContext = createContext<JourneyContextValue | null>(null)

export function useJourney(): JourneyContextValue {
  const ctx = useContext(JourneyContext)
  if (!ctx) throw new Error('useJourney must be used within JourneyProvider')
  return ctx
}
