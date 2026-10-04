import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Bookmark, MapPinned, Navigation, Settings as SettingsIcon, ShieldCheck } from 'lucide-react'
import { useT } from '@/i18n/useT'
import type { MessageKey } from '@/i18n/messages'
import { useGuardian } from '@/context/guardian'
import { SosLayer } from '@/components/guardian/SosLayer'

const NAV_ITEMS: { to: string; label: MessageKey; icon: typeof Navigation; end: boolean }[] = [
  { to: '/', label: 'navHome', icon: Navigation, end: true },
  { to: '/saved', label: 'navJourneys', icon: Bookmark, end: false },
  { to: '/insights', label: 'navInsights', icon: Activity, end: false },
  { to: '/settings', label: 'navProfile', icon: SettingsIcon, end: false },
]

// Guardian Mode keeps navigation to the few things that matter: plan, journeys, guardian, profile.
const GUARDIAN_NAV: typeof NAV_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  { to: '/guardian', label: 'navGuardian', icon: ShieldCheck, end: false },
  NAV_ITEMS[3],
]

// Map-first screens use the whole viewport on phones; they carry their own back controls.
const IMMERSIVE = ['/results', '/details', '/live']

export function AppShell() {
  const t = useT()
  const { pathname } = useLocation()
  const immersive = IMMERSIVE.includes(pathname)
  const { config } = useGuardian()
  const items = config.enabled ? GUARDIAN_NAV : NAV_ITEMS

  return (
    <div className="flex h-dvh w-full flex-col sm:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop: slim floating rail */}
      <aside className="glass-surface m-3 hidden w-[84px] shrink-0 flex-col items-center gap-2 rounded-[32px] py-5 sm:flex">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-ink-950)] text-[var(--color-primary)]" title="NammaRoute">
          <MapPinned size={22} aria-hidden />
        </span>
        <nav className="flex flex-1 flex-col gap-1.5" aria-label="Main">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex w-[68px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'bg-[var(--color-primary)]/25 text-[var(--color-ink-950)]' : 'text-[var(--color-ink-700)] hover:bg-black/5'
                }`
              }
            >
              <Icon size={20} aria-hidden />
              {t(label)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main id="main-content" className={`min-h-0 flex-1 overflow-y-auto ${immersive ? '' : 'pb-28 sm:pb-0'}`}>
        <Outlet />
      </main>

      <SosLayer />

      {/* Mobile: floating bottom navigation */}
      {!immersive && (
        <nav
          aria-label="Main"
          className="glass-surface fixed inset-x-4 z-30 flex justify-around rounded-full p-1.5 sm:hidden"
          style={{ bottom: 'max(env(safe-area-inset-bottom), 14px)' }}
        >
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-w-[68px] flex-col items-center gap-0.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors ${
                  isActive ? 'bg-[var(--color-ink-950)] text-white' : 'text-[var(--color-ink-700)]'
                }`
              }
            >
              <Icon size={19} aria-hidden />
              {t(label)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
