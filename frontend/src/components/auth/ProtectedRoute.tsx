import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CloudOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth'
import { Button } from '@/components/common/Button'

/** Gate for account-only screens. Signed-out visitors are sent to /login and returned afterwards. */
export function ProtectedRoute() {
  const { status, refresh } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center gap-2 p-8 text-sm font-semibold text-[var(--color-ink-700)]" role="status">
        <Loader2 size={18} className="animate-spin" aria-hidden /> Checking your sign-in…
      </div>
    )
  }
  if (status === 'unavailable') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <CloudOff size={32} aria-hidden className="text-[var(--color-ink-700)]" />
        <h1 className="text-xl font-extrabold">Sign-in service unavailable</h1>
        <p className="text-sm text-[var(--color-ink-700)]">We can’t reach the account service right now. You can still plan journeys from Home.</p>
        <Button onClick={() => void refresh()}>Try again</Button>
      </div>
    )
  }
  if (status === 'anon') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}
