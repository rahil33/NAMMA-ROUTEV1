import { createContext, useContext } from 'react'
import type { GuardianConfig } from '@/services/guardianConfigStore'

export interface GuardianContextValue {
  config: GuardianConfig
  /** Whether the server can send SMS to the guardian automatically. null = unknown (signed out / offline). */
  smsConfigured: boolean | null
  syncError: string | null
  save: (patch: Partial<GuardianConfig>) => Promise<void>
}

export const GuardianContext = createContext<GuardianContextValue | null>(null)

export function useGuardian(): GuardianContextValue {
  const ctx = useContext(GuardianContext)
  if (!ctx) throw new Error('useGuardian must be used within GuardianProvider')
  return ctx
}
