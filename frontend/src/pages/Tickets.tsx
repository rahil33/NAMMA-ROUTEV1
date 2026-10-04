import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket as TicketIcon, Trash2 } from 'lucide-react'
import { QrCode } from '@/components/tickets/QrCode'
import { Button } from '@/components/common/Button'
import { DemoDataBadge } from '@/components/common/Badge'
import { TICKETS_EVENT, isExpired, loadTickets, removeTicket, type Ticket } from '@/services/ticketService'
import { useT } from '@/i18n/useT'
import { formatClock, formatFare, MODE_LABEL } from '@/utils/formatting'

export function Tickets() {
  const navigate = useNavigate()
  const t = useT()
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets())
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setTickets(loadTickets())
    window.addEventListener(TICKETS_EVENT, refresh)
    return () => window.removeEventListener(TICKETS_EVENT, refresh)
  }, [])

  const active = tickets.filter((tk) => !isExpired(tk))
  const total = active.reduce((sum, tk) => sum + tk.fareRupees, 0)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <TicketIcon size={22} aria-hidden /> {t('ticketsTitle')}
        </h1>
        <DemoDataBadge />
      </div>
      <p className="text-sm text-[var(--color-ink-700)]">
        {t('ticketsDemoNote')}
      </p>

      {tickets.length === 0 && (
        <div className="soft-card rounded-[var(--radius-sheet)] p-5 text-center">
          <p className="text-sm">{t('ticketsEmpty')}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/')}>{t('planJourney')}</Button>
        </div>
      )}

      {active.length > 0 && <p className="text-sm font-semibold">{t('ticketsActive', { n: String(active.length), total: formatFare(total) })}</p>}

      <ul className="flex flex-col gap-3">
        {tickets.map((tk) => {
          const expired = isExpired(tk)
          const open = openId === tk.id
          return (
            <li key={tk.id} className={`soft-card rounded-[var(--radius-sheet)] p-4 ${expired ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{MODE_LABEL[tk.mode]}{tk.lineName ? ` · ${tk.lineName}` : ''}</p>
                  <p className="text-sm text-[var(--color-ink-700)]">{tk.from} → {tk.to}</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-700)]">
                    {expired ? t('expired') : t('validUntil', { time: formatClock(tk.validUntil) })} · {tk.id}
                  </p>
                </div>
                <p className="text-xl font-extrabold">{formatFare(tk.fareRupees)}</p>
              </div>
              {!expired && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <QrCode value={tk.payload} size={open ? 280 : 160} label={t('qrAlt', { from: tk.from, to: tk.to })} />
                  <button type="button" onClick={() => setOpenId(open ? null : tk.id)} className="text-sm font-semibold text-[var(--color-line-teal-600)]">
                    {open ? t('shrink') : t('enlarge')}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeTicket(tk.id)}
                className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-700)]"
                aria-label={t('deleteTicket', { from: tk.from, to: tk.to })}
              >
                <Trash2 size={13} aria-hidden /> {t('ticketsDelete')}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
