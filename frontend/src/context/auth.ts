import { createContext, useContext } from 'react'

export interface AuthUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  provider: 'google' | 'phone' | 'password'
}
export interface AuthCapabilities {
  google: boolean
  otp: 'twilio' | 'dev' | 'off'
  password: boolean
}
export type AuthStatus = 'loading' | 'authed' | 'anon' | 'unavailable'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  capabilities: AuthCapabilities | null
  refresh: () => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  requestOtp: (phone: string) => Promise<void>
  verifyOtp: (phone: string, code: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
