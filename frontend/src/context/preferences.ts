import { createContext, useContext } from 'react'
import type { AccessibilityPreferences, Language, MapStyleKind, OptimizeFor, UserPreferences } from '@/types'

export interface PreferencesContextValue {
  preferences: UserPreferences
  setOptimizeFor: (value: OptimizeFor) => void
  setRainMode: (value: boolean) => void
  setAccessibility: (patch: Partial<AccessibilityPreferences>) => void
  setPriorities: (value: OptimizeFor[]) => void
  setHaptics: (value: boolean) => void
  setLanguage: (value: Language) => void
  setBudget: (value: number | undefined) => void
  setNarration: (value: boolean) => void
  setSeniorMode: (value: boolean) => void
  setMapStyle: (value: MapStyleKind) => void
  setNotifications: (patch: Partial<UserPreferences['notifications']>) => void
  setPrivacy: (patch: Partial<UserPreferences['privacy']>) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
