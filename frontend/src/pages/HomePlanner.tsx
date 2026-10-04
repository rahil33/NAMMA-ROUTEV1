import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpDown, LocateFixed } from 'lucide-react'
import type { Location, SavedPlace } from '@/types'
import { LocationSearch } from '@/components/planner/LocationSearch'
import { TimeSelector, type TimeMode } from '@/components/planner/TimeSelector'
import { combineTodayWithTime, nowAsHHMM } from '@/utils/time'
import { OptimizeSelector } from '@/components/planner/OptimizeSelector'
import { RecentJourneys } from '@/components/planner/RecentJourneys'
import { SavedPlacesQuickList } from '@/components/planner/SavedPlacesQuickList'
import { Button } from '@/components/common/Button'
import { usePreferences } from '@/context/preferences'
import { useJourney } from '@/context/journey'
import { useJourneyHistory } from '@/hooks/useJourneyHistory'
import { useSavedPlaces } from '@/hooks/useSavedPlaces'
import { LeaveNowCard } from '@/components/planner/LeaveNowCard'
import { ArrivalTargetCard, saveArrivalTarget } from '@/components/planner/ArrivalTargetCard'
import { ARRIVAL_BUFFER_MIN } from '@/utils/commuterIntel'
import { CHENNAI_LOCATIONS } from '@/data/chennaiLocations'
import { VoiceButton } from '@/components/planner/VoiceButton'
import { HeroScene } from '@/components/planner/HeroScene'
import type { VoiceIntent } from '@/utils/voiceCommand'
import { useT } from '@/i18n/useT'

export function HomePlanner() {
  const navigate = useNavigate()
  const { preferences, setPriorities, setRainMode, setBudget } = usePreferences()
  const t = useT()
  const { search, loading } = useJourney()
  const { records, remove } = useJourneyHistory()
  const { places } = useSavedPlaces()

  const [origin, setOrigin] = useState<Location | null>(null)
  const [destination, setDestination] = useState<Location | null>(null)
  const [timeMode, setTimeMode] = useState<TimeMode>('depart')
  const [time, setTime] = useState(nowAsHHMM())

  const canPlan = Boolean(origin && destination && origin.id !== destination.id)

  async function planBetween(from: Location, to: Location, overrides: Partial<VoiceIntent> = {}) {
    // A spoken "arrive by" wins over the on-screen time, since state set in the same tick isn't applied yet.
    const target = overrides.arriveBy ?? (timeMode === 'arrive' ? time : undefined)
    await search({
      origin: from,
      destination: to,
      departAt: combineTodayWithTime(target ?? time).toISOString(),
      arriveBy: target
        ? new Date(combineTodayWithTime(target).getTime() - ARRIVAL_BUFFER_MIN * 60000).toISOString()
        : undefined,
      preference: {
        optimizeFor: overrides.priorities?.[0] ?? preferences.optimizeFor,
        priorities: overrides.priorities ?? preferences.priorities,
        rainMode: overrides.rainMode ?? preferences.rainMode,
        budgetRupees: overrides.budgetRupees ?? preferences.budgetRupees,
        accessibility: preferences.accessibility,
      },
    })
    navigate('/results')
  }

  async function handlePlan() {
    if (origin && destination) await planBetween(origin, destination)
  }

  function handleVoice(intent: VoiceIntent) {
    if (intent.priorities) setPriorities(intent.priorities)
    if (intent.rainMode !== undefined) setRainMode(intent.rainMode)
    if (intent.budgetRupees !== undefined) setBudget(intent.budgetRupees)
    if (intent.arriveBy) {
      setTimeMode('arrive')
      setTime(intent.arriveBy)
      saveArrivalTarget(intent.arriveBy)
    }
    const from = intent.origin ?? origin
    const to = intent.destination ?? destination
    if (intent.origin) setOrigin(intent.origin)
    if (intent.destination) setDestination(intent.destination)
    // A complete spoken route is planned straight away; otherwise the fields are just filled in.
    if (intent.origin && intent.destination && from && to) void planBetween(from, to, intent)
  }

  function useCurrentLocation() {
    // Demo-only: no real geolocation call is made — this sets a realistic
    // stand-in so the flow stays honest about using demo data.
    setOrigin(CHENNAI_LOCATIONS.find((l) => l.id === 'loc-velachery') ?? null)
  }

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  function selectPlace(place: SavedPlace) {
    if (!origin) setOrigin(place.location)
    else setDestination(place.location)
  }

  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? 'greetMorning' : hour < 17 ? 'greetAfternoon' : 'greetEvening')
  const budgetPresets = [20, 30, 50]

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-8 sm:px-4 sm:pt-3">
      <section className="relative rounded-b-[36px] bg-[var(--color-ink-950)] px-5 pb-6 pt-8 text-white sm:rounded-[36px]">
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
          <HeroScene className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/70 via-[#0B1220]/55 to-[#0B1220]/90" />
        </div>
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="hero-text text-base font-bold text-white">{greeting}</p>
              <h1 className="mt-1 hero-text max-w-[20ch] text-balance text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">{t('heroQuestion')}</h1>
            </div>
          </div>

          <div className="relative mt-6 flex flex-col gap-2.5">
            <LocationSearch label={t('from')} placeholder={t('fromPlaceholder')} value={origin} onChange={setOrigin} />
            <button
              type="button"
              onClick={swap}
              aria-label="Swap origin and destination"
              className="absolute right-4 top-[66px] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-ink-950)] text-white shadow-lg ring-2 ring-white/80"
            >
              <ArrowUpDown size={15} aria-hidden />
            </button>
            <LocationSearch label={t('to')} placeholder={t('toPlaceholder')} value={destination} onChange={setDestination} />
          </div>
          <button onClick={useCurrentLocation} className="hero-text mt-3 flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)]">
            <LocateFixed size={15} aria-hidden />
            {t('useCurrent')}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-5 px-4 sm:px-0">
        <VoiceButton onIntent={handleVoice} />

        <LeaveNowCard records={records} />
        <ArrivalTargetCard records={records} />
        <Link to="/tickets" className="soft-card flex items-center justify-between rounded-[var(--radius-sheet)] p-4 text-sm font-bold">
          {t('myTickets')}
          <span className="text-[var(--color-line-teal-600)]">{t('ticketsOpen')}</span>
        </Link>

        <section className="soft-card rounded-[var(--radius-sheet)] p-5" aria-labelledby="matters-heading">
          <h2 id="matters-heading" className="mb-3 text-lg font-extrabold tracking-tight">{t('quickPicks')}</h2>
          <OptimizeSelector
            priorities={preferences.priorities}
            onChange={setPriorities}
            rainMode={preferences.rainMode}
            onRainModeChange={setRainMode}
          />
        </section>

        <section className="soft-card rounded-[var(--radius-sheet)] p-5" aria-labelledby="budget-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="budget-heading" className="text-sm font-semibold text-[var(--color-ink-700)]">{t('yourBudget')}</h2>
              <p className="mt-1 text-5xl font-extrabold tracking-tight">{preferences.budgetRupees !== undefined ? `₹${preferences.budgetRupees}` : '—'}</p>
            </div>
            <label className="text-xs font-semibold text-[var(--color-ink-700)]">
              {t('budget')}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={preferences.budgetRupees ?? ''}
                onChange={(e) => setBudget(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                className="mt-1 block w-28 rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('yourBudget')}>
            {budgetPresets.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={preferences.budgetRupees === n}
                onClick={() => setBudget(preferences.budgetRupees === n ? undefined : n)}
                className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
                  preferences.budgetRupees === n ? 'bg-[var(--color-ink-950)] text-white' : 'bg-white/80 text-[var(--color-ink-800)]'
                }`}
              >
                ₹{n}
              </button>
            ))}
          </div>
        </section>

        <section className="soft-card rounded-[var(--radius-sheet)] p-5">
          <TimeSelector mode={timeMode} onModeChange={setTimeMode} time={time} onTimeChange={setTime} />
          {timeMode === 'arrive' && (
            <p className="mt-2 text-xs text-[var(--color-ink-700)]">
              Plans to arrive {ARRIVAL_BUFFER_MIN} min before {time} as a buffer. Based on demo data.
            </p>
          )}
        </section>

        <Button className="w-full" size="lg" disabled={!canPlan || loading} onClick={handlePlan}>
          {loading ? t('finding') : t('plan')}
        </Button>

        <SavedPlacesQuickList places={places} onSelect={(place) => selectPlace(place)} />

        <RecentJourneys
          records={records}
          onRemove={remove}
          onSelect={(record) => {
            setOrigin(record.journey.origin)
            setDestination(record.journey.destination)
          }}
        />
      </div>
    </div>
  )
}
