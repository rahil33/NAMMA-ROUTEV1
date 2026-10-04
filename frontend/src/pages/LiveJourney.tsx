import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { BellRing, CheckCircle2, ChevronsRight, MapPinOff, Mic, Radio, Volume2, VolumeX, X } from 'lucide-react'
import { LiveProgress } from '@/components/live/LiveProgress'
import { ServiceAlertBanner } from '@/components/live/ServiceAlertBanner'
import { MapView } from '@/components/map/MapView'
import { Button } from '@/components/common/Button'
import { DataSourceBadge } from '@/components/common/Badge'
import { GuardianLiveCard } from '@/components/guardian/GuardianLiveCard'
import { RoadReportButtons } from '@/components/guardian/RoadReportButtons'
import { guardianSession } from '@/services/guardianSession'
import { useJourney } from '@/context/journey'
import { usePreferences } from '@/context/preferences'
import { useT } from '@/i18n/useT'
import { narrationText } from '@/utils/narration'
import { listen, speak, startWakeListening, voiceInputSupported, WAKE_WORD } from '@/services/voiceService'
import { haptic, vibrationSupported } from '@/services/hapticService'
import { parseNavCommand } from '@/utils/voiceCommand'
import { pointAlong } from '@/utils/routePath'
import { TurnList } from '@/components/journey/TurnList'
import { pathKey, useRoadPaths } from '@/services/roadRouteService'
import { ArrivalGuardian, ConnectionStatus, WhatHappensNext } from '@/components/live/LiveCards'

const STEP_MS = 8000 // demo pace: one segment per 8 seconds
const TICK_MS = 400
const TICKS_PER_STEP = STEP_MS / TICK_MS

export function LiveJourney() {
  const navigate = useNavigate()
  const { liveState, advanceLiveJourney, triggerDemoAlert, findAlternative, missStop, resetLiveJourney } = useJourney()
  const { preferences } = usePreferences()
  const t = useT()

  const [voiceNav, setVoiceNav] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [progress, setProgress] = useState({ index: 0, n: 0 })
  const roadPaths = useRoadPaths(liveState ? [liveState.journey] : [])

  const status = liveState?.status
  const index = liveState?.currentSegmentIndex ?? 0
  const tick = progress.index === index ? progress.n : 0
  const spoken = liveState
    ? liveState.status === 'alert' && liveState.activeAlert
      ? liveState.activeAlert.message
      : liveState.status === 'completed'
        ? t('narArrived', { place: liveState.journey.destination.name })
        : narrationText(liveState.journey, liveState.currentSegmentIndex, t)
    : null

  // Spoken guidance: narration setting or the demo voice navigation.
  useEffect(() => {
    if (spoken && (preferences.narration || voiceNav)) speak(spoken, preferences.language)
  }, [spoken, preferences.narration, preferences.language, voiceNav])

  // Vibration and tone on step changes, alerts and arrival.
  useEffect(() => {
    if (!status || !preferences.haptics) return
    haptic(status === 'alert' ? 'alert' : status === 'completed' ? 'arrive' : 'step')
  }, [status, index, preferences.haptics])

  // Demo pace: animate the position dot along the segment, then move to the next one.
  useEffect(() => {
    if (!voiceNav || status !== 'in-progress') return
    const timer = setInterval(
      () => setProgress((p) => ({ index, n: p.index === index ? Math.min(p.n + 1, TICKS_PER_STEP) : 1 })),
      TICK_MS,
    )
    return () => clearInterval(timer)
  }, [voiceNav, status, index])
  useEffect(() => {
    if (tick >= TICKS_PER_STEP && voiceNav && status === 'in-progress') advanceLiveJourney()
  }, [tick, voiceNav, status, advanceLiveJourney])

  function applyCommand(text: string) {
    setHeard(t('voiceHeard', { text }))
    const command = parseNavCommand(text)
    if (command === 'next') advanceLiveJourney()
    else if (command === 'repeat' && spoken) speak(spoken, preferences.language)
    else if (command === 'stop') setVoiceNav(false)
    else if (command === 'reroute') findAlternative()
    else if (command === 'missed' && liveState) missStop(t('missedMessage', { place: liveState.journey.segments[index]?.to ?? '' }))
    else setHeard(t('voiceNoMatch'))
  }

  async function sayCommand() {
    try {
      applyCommand(await listen(preferences.language))
    } catch {
      setHeard(t('voiceNoMatch'))
    }
  }

  // Hands-free: after "Hey Namma", the spoken command runs the same handler as the button.
  const commandRef = useRef(applyCommand)
  useEffect(() => {
    commandRef.current = applyCommand
  })
  useEffect(() => {
    if (!handsFree) return
    return startWakeListening(
      preferences.language,
      (text) => commandRef.current(text),
      (message) => {
        setHeard(message)
        setHandsFree(false)
      },
    )
  }, [handsFree, preferences.language])

  if (!liveState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-[var(--color-ink-700)]">No journey in progress. Pick a route and press Start journey.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Plan a journey</Button>
      </div>
    )
  }

  const current = liveState.journey.segments[liveState.currentSegmentIndex]
  const completed = liveState.status === 'completed'
  const youAre: [number, number] | null = completed
    ? [liveState.journey.destination.lng, liveState.journey.destination.lat]
    : (pointAlong(roadPaths[pathKey(liveState.journey.id, current.id)]?.coords ?? current.polyline, tick / TICKS_PER_STEP)?.point ?? null)

  function finish() {
    void guardianSession.end()
    setVoiceNav(false)
    resetLiveJourney()
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative order-1 min-h-[35vh] flex-1 lg:order-2 lg:min-h-0">
        <MapView
          journeys={[liveState.journey]}
          selectedJourneyId={liveState.journey.id}
          highlightSegmentId={completed ? null : current.id}
          mapStyle={preferences.mapStyle}
          youAre={youAre}
          follow={voiceNav}
          showTurns
          className="h-full w-full"
        />
      </div>

      <div className="order-2 flex w-full flex-col gap-4 overflow-y-auto p-4 lg:order-1 lg:w-[420px] lg:shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-extrabold tracking-tight">
            {liveState.journey.origin.name} → {liveState.journey.destination.name}
          </h1>
          <DataSourceBadge journey={liveState.journey} />
        </div>
        <p className="text-xs text-[var(--color-ink-700)]">Simulated journey: progress and alerts are demo only.</p>

        <GuardianLiveCard journey={liveState.journey} completed={completed} />
        {!completed && <WhatHappensNext state={liveState} />}
        <ArrivalGuardian state={liveState} />
        {!completed && <ConnectionStatus state={liveState} onSaferAlternative={findAlternative} />}

        {liveState.status === 'alert' && liveState.activeAlert && (
          <ServiceAlertBanner alert={liveState.activeAlert} onFindAlternative={findAlternative} />
        )}
        {liveState.notice && (
          <p role="status" className="rounded-[10px] bg-[var(--color-ok-600)]/10 px-3 py-2 text-sm text-[var(--color-ok-600)]">
            {liveState.notice}
          </p>
        )}

        {!completed && (
          <section className="soft-card flex flex-col gap-2 rounded-[var(--radius-card)] p-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={voiceNav ? 'secondary' : 'primary'} onClick={() => setVoiceNav((on) => !on)}>
                {voiceNav ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
                {voiceNav ? t('voiceNavStop') : t('voiceNavStart')}
              </Button>
              {voiceInputSupported() && (
                <Button variant="secondary" onClick={sayCommand}>
                  <Mic size={16} aria-hidden />
                  {t('navCommand')}
                </Button>
              )}
              {voiceInputSupported() && (
                <Button variant={handsFree ? 'primary' : 'secondary'} aria-pressed={handsFree} onClick={() => setHandsFree((on) => !on)}>
                  <Radio size={16} aria-hidden />
                  {handsFree ? `Listening for "${WAKE_WORD}"` : 'Hands-free'}
                </Button>
              )}
            </div>
            <p className="text-xs text-[var(--color-ink-700)]">{t('voiceNavHelp')}</p>
            {heard && (
              <p role="status" className="text-xs font-medium text-[var(--color-ink-800)]">
                {heard}
              </p>
            )}
            {preferences.haptics && !vibrationSupported() && (
              <p className="text-xs text-[var(--color-ink-700)]">{t('vibrateUnsupported')}</p>
            )}
          </section>
        )}

        {!completed && (roadPaths[pathKey(liveState.journey.id, current.id)]?.steps.length ?? 0) > 1 && (
          <TurnList path={roadPaths[pathKey(liveState.journey.id, current.id)]} title={`${current.from} → ${current.to}`} />
        )}

        <LiveProgress state={liveState} />

        {!completed && <RoadReportButtons />}

        {completed ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ok-600)]">
              <CheckCircle2 size={16} aria-hidden />
              You have arrived at {liveState.journey.destination.name}.
            </p>
            <Button onClick={finish}>Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button onClick={advanceLiveJourney}>
              <ChevronsRight size={16} aria-hidden />
              {t('nextSegment')}
            </Button>
            {preferences.notifications.serviceAlerts && (
              <Button variant="secondary" onClick={triggerDemoAlert} disabled={liveState.status === 'alert'}>
                <BellRing size={16} aria-hidden />
                Simulate service alert
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => missStop(t('missedMessage', { place: current.to }))}
              disabled={liveState.status === 'alert'}
            >
              <MapPinOff size={16} aria-hidden />
              {t('missedStop')}
            </Button>
            <Button variant="ghost" onClick={finish}>
              <X size={16} aria-hidden />
              {t('endJourney')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
