export interface GuardianConfig {
  enabled: boolean
  name: string
  phone: string
  deviationMeters: number
  inactivityMinutes: number | null
  notifyStartEnd: boolean
}

export const DEFAULT_GUARDIAN: GuardianConfig = { enabled: false, name: '', phone: '', deviationMeters: 300, inactivityMinutes: null, notifyStartEnd: true }
const KEY = 'namma.guardian.v1'

/** Stored on the device first, so SOS keeps working signed-out and offline. */
export function loadGuardianConfig(): GuardianConfig {
  try {
    return { ...DEFAULT_GUARDIAN, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GuardianConfig>) }
  } catch {
    return DEFAULT_GUARDIAN
  }
}
export function saveGuardianConfig(c: GuardianConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* storage unavailable (private mode); config lives for this session only */
  }
}
