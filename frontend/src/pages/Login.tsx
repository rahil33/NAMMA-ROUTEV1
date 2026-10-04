import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Mail, Smartphone } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/context/auth'
import { apiUrl, ApiError } from '@/services/api'

type Tab = 'phone' | 'email'

const ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not set up on this server.',
  google_cancelled: 'Google sign-in was cancelled. Please try again.',
  google_failed: 'Google sign-in did not complete. Please try again.',
}

const inputCls = 'w-full rounded-2xl border border-black/15 bg-white px-4 py-3.5 text-base outline-none focus:border-[var(--color-line-teal-600)] focus:ring-2 focus:ring-[var(--color-primary)]/40'

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export function Login() {
  const { status, capabilities, login, signup, requestOtp, verifyOtp, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') && /^\/[\w/\-?=&.]*$/.test(params.get('next')!) ? params.get('next')! : '/'

  const [tab, setTab] = useState<Tab>('phone')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(ERRORS[params.get('error') ?? ''] ?? null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  if (status === 'authed') return <Navigate to={next} replace />

  const otpOn = capabilities?.otp !== 'off'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      await requestOtp(phone)
      setCodeSent(true)
      setCooldown(30)
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tab === 'phone') {
      if (!codeSent) return void sendCode()
      return void run(async () => {
        await verifyOtp(phone, code, name || undefined)
        navigate(next, { replace: true })
      })
    }
    void run(async () => {
      if (mode === 'signup') await signup(name, email, password)
      else await login(email, password)
      navigate(next, { replace: true })
    })
  }

  if (status === 'loading') {
    return <p className="flex h-full items-center justify-center gap-2 p-8 text-sm font-semibold" role="status"><Loader2 className="animate-spin" size={18} aria-hidden /> Loading…</p>
  }

  if (status === 'unavailable') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <h1 className="text-2xl font-extrabold">Sign-in is unavailable</h1>
        <p className="text-sm text-[var(--color-ink-700)]">We can’t reach the account service. Journey planning still works without an account.</p>
        <Button onClick={() => void refresh()}>Try again</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>Back to planner</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-10 pt-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Sign in to NammaRoute</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-700)]">Save places, keep tickets, and let someone follow your journey.</p>
      </header>

      {capabilities?.google ? (
        <a
          href={apiUrl(`/api/auth/google/start?next=${encodeURIComponent(next)}`)}
          className="flex min-h-14 items-center justify-center gap-3 rounded-full border border-black/15 bg-white text-base font-bold shadow-sm"
        >
          <GoogleLogo /> Continue with Google
        </a>
      ) : (
        <button disabled className="flex min-h-14 items-center justify-center gap-3 rounded-full border border-black/10 bg-white/60 text-base font-bold opacity-60" title="Google sign-in is not configured on this server">
          <GoogleLogo /> Google sign-in not set up
        </button>
      )}

      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1">
        {([['phone', 'Mobile OTP', Smartphone], ['email', 'Email', Mail]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => { setTab(id); setError(null) }}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-full text-sm font-bold ${tab === id ? 'bg-[var(--color-ink-950)] text-white' : 'text-[var(--color-ink-800)]'}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="soft-card flex flex-col gap-3 rounded-[var(--radius-sheet)] p-5">
        {tab === 'phone' ? (
          otpOn ? (
            <>
              <label className="text-sm font-semibold">
                Mobile number
                <input className={`${inputCls} mt-1`} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={codeSent} required />
              </label>
              {codeSent && (
                <>
                  <label className="text-sm font-semibold">
                    6-digit code
                    <input className={`${inputCls} mt-1 text-center text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
                  </label>
                  <label className="text-sm font-semibold">
                    Your name <span className="font-normal text-[var(--color-ink-700)]">(first time only)</span>
                    <input className={`${inputCls} mt-1`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" className="font-bold text-[var(--color-line-teal-600)] underline" onClick={() => { setCodeSent(false); setCode('') }}>Change number</button>
                    <button type="button" disabled={cooldown > 0 || busy} className="font-bold text-[var(--color-line-teal-600)] underline disabled:no-underline disabled:opacity-50" onClick={() => void sendCode()}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </>
              )}
              <Button type="submit" size="lg" disabled={busy || (codeSent ? code.length < 4 : phone.trim().length < 10)}>
                {busy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null}
                {codeSent ? 'Verify and continue' : 'Send code'}
              </Button>
              {capabilities?.otp === 'dev' && <p className="text-xs text-[var(--color-ink-700)]">Developer mode: the code is printed in the server console, not sent by SMS.</p>}
            </>
          ) : (
            <p className="rounded-2xl bg-black/5 p-4 text-sm">Phone sign-in isn’t available on this server yet. Please use Google or email.</p>
          )
        ) : (
          <>
            {mode === 'signup' && (
              <label className="text-sm font-semibold">
                Your name
                <input className={`${inputCls} mt-1`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            )}
            <label className="text-sm font-semibold">
              Email
              <input className={`${inputCls} mt-1`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="text-sm font-semibold">
              Password {mode === 'signup' && <span className="font-normal text-[var(--color-ink-700)]">(8+ characters)</span>}
              <input className={`${inputCls} mt-1`} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
            <button type="button" className="min-h-11 text-sm font-bold text-[var(--color-line-teal-600)] underline" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null) }}>
              {mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
            </button>
          </>
        )}
        {error && <p role="alert" className="rounded-2xl bg-[var(--color-warn-600)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-warn-600)]">{error}</p>}
      </form>

      <Button variant="ghost" onClick={() => navigate('/')}>Continue without an account</Button>
    </div>
  )
}
