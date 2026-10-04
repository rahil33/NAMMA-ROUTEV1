import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '@/services/api'
import { AuthContext, type AuthCapabilities, type AuthContextValue, type AuthStatus, type AuthUser } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [me, caps] = await Promise.all([
        api<{ user: AuthUser | null }>('/api/auth/me', { timeoutMs: 6000 }),
        api<AuthCapabilities>('/api/auth/config', { timeoutMs: 6000 }),
      ])
      setCapabilities(caps)
      setUser(me.user)
      setStatus(me.user ? 'authed' : 'anon')
    } catch (e) {
      // The planner keeps working without the API; only account features show an "unavailable" state.
      setUser(null)
      setStatus(e instanceof ApiError && !e.unreachable ? 'anon' : 'unavailable')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const adopt = useCallback((u: AuthUser) => {
    setUser(u)
    setStatus('authed')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      capabilities,
      refresh,
      signup: async (name, email, password) => adopt((await api<{ user: AuthUser }>('/api/auth/signup', { body: { name, email, password } })).user),
      login: async (email, password) => adopt((await api<{ user: AuthUser }>('/api/auth/login', { body: { email, password } })).user),
      requestOtp: async (phone) => {
        await api('/api/auth/otp/request', { body: { phone } })
      },
      verifyOtp: async (phone, code, name) => adopt((await api<{ user: AuthUser }>('/api/auth/otp/verify', { body: { phone, code, name } })).user),
      logout: async () => {
        try {
          await api('/api/auth/logout', { method: 'POST', body: {} })
        } finally {
          setUser(null)
          setStatus('anon')
        }
      },
    }),
    [status, user, capabilities, refresh, adopt],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
