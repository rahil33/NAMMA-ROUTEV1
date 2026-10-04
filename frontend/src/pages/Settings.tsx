import { Link } from 'react-router-dom'
import { Database, LogIn, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/context/auth'
import { useGuardian } from '@/context/guardian'
import type { AccessibilityPreferences, Language, MapStyleKind, OptimizeFor } from '@/types'
import { Segmented, Toggle } from '@/components/common/Controls'
import { Button } from '@/components/common/Button'
import { DemoDataBadge } from '@/components/common/Badge'
import { usePreferences } from '@/context/preferences'
import { useJourneyHistory } from '@/hooks/useJourneyHistory'
import { useT } from '@/i18n/useT'
import { hasMapProvider } from '@/services/mapConfigService'

const OPTIMIZE_OPTIONS: { value: OptimizeFor; label: string }[] = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'least-walking', label: 'Least walking' },
  { value: 'fewest-transfers', label: 'Fewest transfers' },
  { value: 'accessible', label: 'Accessible' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'balanced', label: 'Balanced' },
]

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'te', label: 'తెలుగు' },
]

const MAP_OPTIONS: { value: MapStyleKind; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
]

const ACCESSIBILITY_TOGGLES: { key: keyof AccessibilityPreferences; label: string; description: string }[] = [
  { key: 'wheelchair', label: 'Wheelchair', description: 'Only show routes without confirmed barriers when available.' },
  { key: 'limitedWalking', label: 'Limited walking', description: 'Weights walking distance more heavily.' },
  { key: 'avoidStairs', label: 'Avoid stairs', description: 'Prefers routes with elevators or no steps.' },
  { key: 'avoidSteepSlopes', label: 'Avoid steep slopes', description: 'Slope data is not available in demo data, so this favours step-free routes.' },
  { key: 'minimizeWalking', label: 'Minimum walking', description: 'Ranks the shortest walking distance higher.' },
  { key: 'minimizeTransfers', label: 'Minimum transfers', description: 'Ranks fewer changes higher.' },
]

const APPEARANCE_TOGGLES: { key: keyof AccessibilityPreferences; label: string; description: string }[] = [
  { key: 'largeText', label: 'Large text', description: 'Increases text size across the app.' },
  { key: 'highContrast', label: 'High contrast', description: 'Uses stronger borders and black-on-white colours.' },
  { key: 'reducedMotion', label: 'Reduced motion', description: 'Minimises animations. Your device setting is also respected.' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="soft-card rounded-[var(--radius-sheet)] p-5" aria-label={title}>
      <h2 className="mb-3 text-lg font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export function Settings() {
  const {
    preferences, setOptimizeFor, setRainMode, setAccessibility, setMapStyle, setNotifications, setPrivacy,
    setLanguage, setNarration, setSeniorMode, setHaptics,
  } = usePreferences()
  const t = useT()
  const a = preferences.accessibility
  const seniorOn = a.largeText && a.highContrast && a.minimizeWalking && a.minimizeTransfers && a.avoidStairs && preferences.narration
  const { records, clear } = useJourneyHistory()
  const { status, user, logout } = useAuth()
  const { config: guardian } = useGuardian()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>

      <Section title="Account">
        {status === 'authed' && user ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={18} aria-hidden /> {user.name} <span className="font-normal text-[var(--color-ink-700)]">{user.email ?? user.phone}</span></p>
            <Button variant="secondary" onClick={() => void logout()}><LogOut size={16} aria-hidden /> Log out</Button>
          </div>
        ) : status === 'unavailable' ? (
          <p className="text-sm text-[var(--color-ink-700)]">The account service is unavailable right now. Planning still works.</p>
        ) : (
          <Link to="/login" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-bold"><LogIn size={16} aria-hidden /> Sign in or create account</Link>
        )}
        <Link to="/guardian" className="mt-3 flex min-h-12 items-center justify-between rounded-2xl bg-white/70 px-4 text-sm font-bold">
          <span className="flex items-center gap-2"><ShieldCheck size={18} aria-hidden /> Guardian Mode</span>
          <span className="text-[var(--color-line-teal-600)]">{guardian.enabled ? 'On' : 'Set up'}</span>
        </Link>
      </Section>

      <Section title={t('language')}>
        <Segmented label={t('language')} options={LANGUAGE_OPTIONS} value={preferences.language} onChange={setLanguage} />
        <div className="mt-2 flex flex-col gap-2">
          <Toggle checked={seniorOn} onChange={setSeniorMode} label={t('seniorMode')} description={t('seniorModeDesc')} />
          <Toggle checked={preferences.narration} onChange={setNarration} label={t('narration')} description={t('narrationDesc')} />
          <Toggle checked={preferences.haptics} onChange={setHaptics} label={t('haptics')} description={t('hapticsDesc')} />
        </div>
      </Section>

      <Section title="Travel preferences">
        <p className="mb-2 text-xs text-[var(--color-ink-700)]">Default way to rank routes.</p>
        <Segmented label="Default optimization" options={OPTIMIZE_OPTIONS} value={preferences.optimizeFor} onChange={setOptimizeFor} />
        <div className="mt-2">
          <Toggle
            checked={preferences.rainMode}
            onChange={setRainMode}
            label="Rain Mode"
            description="Prefers less outdoor walking and fewer transfers. Uses demo data, not live weather."
          />
        </div>
      </Section>

      <Section title="Accessibility">
        <div className="divide-y divide-black/5">
          {ACCESSIBILITY_TOGGLES.map((t) => (
            <Toggle
              key={t.key}
              checked={preferences.accessibility[t.key]}
              onChange={(v) => setAccessibility({ [t.key]: v })}
              label={t.label}
              description={t.description}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-700)]">
          Segments without verified accessibility data are labelled as unverified. Demo data never claims verified access.
        </p>
      </Section>

      <Section title="Appearance">
        <div className="divide-y divide-black/5">
          {APPEARANCE_TOGGLES.map((t) => (
            <Toggle
              key={t.key}
              checked={preferences.accessibility[t.key]}
              onChange={(v) => setAccessibility({ [t.key]: v })}
              label={t.label}
              description={t.description}
            />
          ))}
        </div>
      </Section>

      <Section title="Map style">
        <Segmented label="Default map style" options={MAP_OPTIONS} value={preferences.mapStyle} onChange={setMapStyle} />
      </Section>

      <Section title="Notifications">
        <Toggle
          checked={preferences.notifications.serviceAlerts}
          onChange={(v) => setNotifications({ serviceAlerts: v })}
          label="Simulated service alerts"
          description="Shows the demo alert control during a live journey."
        />
      </Section>

      <Section title="Privacy">
        <Toggle
          checked={preferences.privacy.storeHistory}
          onChange={(v) => setPrivacy({ storeHistory: v })}
          label="Save journey history"
          description="Stored only in this browser."
        />
        <Button variant="secondary" size="sm" className="mt-2" disabled={records.length === 0} onClick={clear}>
          <Trash2 size={14} aria-hidden />
          Clear history ({records.length})
        </Button>
      </Section>

      <Section title="Data sources">
        <div className="flex flex-col gap-2 text-sm text-[var(--color-ink-800)]">
          <DemoDataBadge className="self-start" />
          <p className="flex items-start gap-2">
            <Database size={15} className="mt-0.5 shrink-0" aria-hidden />
            Routes, fares, times, accessibility details and alerts are generated demo data. Nothing here is live service information.
          </p>
          <p>
            Map tiles: {hasMapProvider() ? 'MapTiler (VITE_MAPTILER_KEY configured).' : 'free OpenStreetMap and Esri imagery fallback (no VITE_MAPTILER_KEY set).'}
          </p>
        </div>
      </Section>
    </div>
  )
}
