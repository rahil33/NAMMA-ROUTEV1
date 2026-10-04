import type { UserPreferences } from '@/types'

const STORAGE_KEY = 'nammaroute.preferences.v1'

export const DEFAULT_PREFERENCES: UserPreferences = {
  optimizeFor: 'fastest',
  priorities: ['fastest'],
  haptics: true,
  language: 'en',
  narration: false,
  rainMode: false,
  accessibility: {
    wheelchair: false,
    limitedWalking: false,
    avoidStairs: false,
    avoidSteepSlopes: false,
    minimizeWalking: false,
    minimizeTransfers: false,
    largeText: false,
    highContrast: false,
    reducedMotion: false,
  },
  mapStyle: 'standard',
  notifications: {
    serviceAlerts: true,
  },
  privacy: {
    storeHistory: true,
  },
}

export interface PreferencesService {
  load(): UserPreferences
  save(prefs: UserPreferences): void
}

class LocalPreferencesService implements PreferencesService {
  load(): UserPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_PREFERENCES
      const parsed = JSON.parse(raw) as Partial<UserPreferences>
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        priorities: parsed.priorities?.length ? parsed.priorities : [parsed.optimizeFor ?? 'fastest'],
        accessibility: { ...DEFAULT_PREFERENCES.accessibility, ...parsed.accessibility },
        notifications: { ...DEFAULT_PREFERENCES.notifications, ...parsed.notifications },
        privacy: { ...DEFAULT_PREFERENCES.privacy, ...parsed.privacy },
      }
    } catch {
      return DEFAULT_PREFERENCES
    }
  }

  save(prefs: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Non-blocking.
    }
  }
}

export const preferencesService: PreferencesService = new LocalPreferencesService()
