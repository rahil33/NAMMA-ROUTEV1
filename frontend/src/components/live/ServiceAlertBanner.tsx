import { AlertTriangle } from 'lucide-react'
import type { ServiceAlert } from '@/types'
import { Button } from '@/components/common/Button'

export function ServiceAlertBanner({ alert, onFindAlternative }: { alert: ServiceAlert; onFindAlternative: () => void }) {
  return (
    <div role="alert" className="rounded-[var(--radius-card)] border border-[var(--color-warn-600)]/30 bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle size={17} className="text-[var(--color-warn-600)]" aria-hidden />
        <span className="text-sm font-semibold text-[var(--color-warn-600)]">Simulated service alert (demo)</span>
      </div>
      <p className="mb-3 text-sm text-[var(--color-ink-900)]">{alert.message}</p>
      <Button size="sm" variant="secondary" onClick={onFindAlternative}>
        Find alternative
      </Button>
    </div>
  )
}
