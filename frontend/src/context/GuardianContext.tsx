import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '@/services/api'
import { useAuth } from '@/context/auth'
import { usePreferences } from '@/context/preferences'
import { DEFAULT_GUARDIAN, loadGuardianConfig, saveGuardianConfig, type GuardianConfig } from '@/services/guardianConfigStore'
import { GuardianContext, type GuardianContextValue } from './guardian'

export function GuardianProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const { setSeniorMode } = usePreferences()
  const [config, setConfig] = useState<GuardianConfig>(loadGuardianConfig)
  const [smsConfigured, setSmsConfigured] = useState<boolean | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const configRef = useRef(config)
  useEffect(() => {
    document.documentElement.classList.toggle('guardian-ui', config.enabled)
  }, [config.enabled])
  useEffect(() => {
    configRef.current = config
  })

  const push = useCallback(async (c: GuardianConfig) => {
    try {
      const r = await api<{ smsConfigured: boolean }>('/api/guardian', { method: 'PUT', body: c })
      setSmsConfigured(r.smsConfigured)
      setSyncError(null)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Could not sync.')
    }
  }, [])

  // On sign-in: keep a locally configured guardian (and upload it), otherwise adopt the account's saved one.
  useEffect(() => {
    if (status !== 'authed') return
    let alive = true
    void api<{ guardian: GuardianConfig; smsConfigured: boolean }>('/api/guardian')
      .then((r) => {
        if (!alive) return
        setSmsConfigured(r.smsConfigured)
        const local = configRef.current
        if (local.phone) void push(local)
        else if (r.guardian.phone) {
          setConfig(r.guardian)
          saveGuardianConfig(r.guardian)
        }
      })
      .catch(() => alive && setSmsConfigured(null))
    return () => {
      alive = false
    }
  }, [status, push])

  const save = useCallback(
    async (patch: Partial<GuardianConfig>) => {
      const next = { ...DEFAULT_GUARDIAN, ...configRef.current, ...patch }
      const turningOn = next.enabled && !configRef.current.enabled
      setConfig(next)
      saveGuardianConfig(next)
      if (turningOn) setSeniorMode(true) // large text, high contrast, fewer steps (existing Senior mode preset)
      if (status === 'authed') await push(next)
    },
    [status, push, setSeniorMode],
  )

  const value = useMemo<GuardianContextValue>(() => ({ config, smsConfigured, syncError, save }), [config, smsConfigured, syncError, save])
  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>
}
