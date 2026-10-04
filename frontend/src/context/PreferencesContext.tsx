import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UserPreferences } from '@/types'
import { preferencesService } from '@/services/preferencesService'
import { PreferencesContext, type PreferencesContextValue } from './preferences'

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => preferencesService.load())

  useEffect(() => {
    preferencesService.save(preferences)
  }, [preferences])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('high-contrast', preferences.accessibility.highContrast)
    root.classList.toggle('large-text', preferences.accessibility.largeText)
  }, [preferences.accessibility.highContrast, preferences.accessibility.largeText])

  const prefersReducedMotionQuery = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null),
    [],
  )
  const systemReducedMotion = prefersReducedMotionQuery?.matches ?? false

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences: {
        ...preferences,
        accessibility: {
          ...preferences.accessibility,
          reducedMotion: preferences.accessibility.reducedMotion || systemReducedMotion,
        },
      },
      setOptimizeFor: (optimizeFor) => setPreferences((p) => ({ ...p, optimizeFor, priorities: [optimizeFor] })),
      setPriorities: (priorities) =>
        setPreferences((p) =>
          priorities.length ? { ...p, priorities, optimizeFor: priorities[0] } : p,
        ),
      setHaptics: (haptics) => setPreferences((p) => ({ ...p, haptics })),
      setRainMode: (rainMode) => setPreferences((p) => ({ ...p, rainMode })),
      setAccessibility: (patch) =>
        setPreferences((p) => ({ ...p, accessibility: { ...p.accessibility, ...patch } })),
      setLanguage: (language) => setPreferences((p) => ({ ...p, language })),
      setBudget: (budgetRupees) => setPreferences((p) => ({ ...p, budgetRupees })),
      setNarration: (narration) => setPreferences((p) => ({ ...p, narration })),
      setSeniorMode: (on) =>
        setPreferences((p) => ({
          ...p,
          narration: on,
          accessibility: {
            ...p.accessibility,
            largeText: on,
            highContrast: on,
            minimizeWalking: on,
            minimizeTransfers: on,
            avoidStairs: on,
          },
        })),
      setMapStyle: (mapStyle) => setPreferences((p) => ({ ...p, mapStyle })),
      setNotifications: (patch) =>
        setPreferences((p) => ({ ...p, notifications: { ...p.notifications, ...patch } })),
      setPrivacy: (patch) => setPreferences((p) => ({ ...p, privacy: { ...p.privacy, ...patch } })),
    }),
    [preferences, systemReducedMotion],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
