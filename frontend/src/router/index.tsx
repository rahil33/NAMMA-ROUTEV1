import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePlanner } from '@/pages/HomePlanner'
import { SavedPlaces } from '@/pages/SavedPlaces'
import { Settings } from '@/pages/Settings'
import { Insights } from '@/pages/Insights'
import { Tickets } from '@/pages/Tickets'
import { Login } from '@/pages/Login'
import { Guardian } from '@/pages/Guardian'
import { Track } from '@/pages/Track'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

const RouteResults = lazy(() => import('@/pages/RouteResults').then((m) => ({ default: m.RouteResults })))
const JourneyDetails = lazy(() => import('@/pages/JourneyDetails').then((m) => ({ default: m.JourneyDetails })))
const LiveJourney = lazy(() => import('@/pages/LiveJourney').then((m) => ({ default: m.LiveJourney })))

function withSuspense(node: React.ReactNode) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--color-ink-700)]" role="status">Loading map…</p>}>{node}</Suspense>
  )
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePlanner />} />
          <Route path="results" element={withSuspense(<RouteResults />)} />
          <Route path="details" element={withSuspense(<JourneyDetails />)} />
          <Route path="live" element={withSuspense(<LiveJourney />)} />
          <Route path="login" element={<Login />} />
          <Route path="track/:token" element={<Track />} />
          {/* Account-only screens. Planning, results and live navigation stay open without an account. */}
          <Route element={<ProtectedRoute />}>
            <Route path="saved" element={<SavedPlaces />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="guardian" element={<Guardian />} />
          </Route>
          <Route path="insights" element={<Insights />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<HomePlanner />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
