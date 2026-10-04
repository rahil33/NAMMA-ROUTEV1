import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquareWarning, Phone, ShieldAlert, Siren, X } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/context/auth'
import { useGuardian } from '@/context/guardian'
import { guardianSession, useGuardianSession } from '@/services/guardianSession'

const COUNTDOWN_S = 5
export const SOS_EVENT = 'namma:sos'

function currentPosition(timeoutMs = 8000): Promise<{ lat: number; lng: number } | null> {
  const last = guardianSession.getState().lastPos
  if (!('geolocation' in navigator)) return Promise.resolve(last)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(last), // permission denied or no fix: fall back to the last known position, if any
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}

type Result = { delivered: boolean; reason: 'sent' | 'no_sms' | 'offline' | 'signed_out' | 'no_guardian'; pos: { lat: number; lng: number } | null }

function SosSheet({ onClose }: { onClose: () => void }) {
  const { config } = useGuardian()
  const { user, status } = useAuth()
  const [left, setLeft] = useState(COUNTDOWN_S)
  const [phase, setPhase] = useState<'countdown' | 'sending' | 'done'>('countdown')
  const [result, setResult] = useState<Result | null>(null)
  const sentRef = useRef(false)

  const send = useCallback(async () => {
    if (sentRef.current) return
    sentRef.current = true
    setPhase('sending')
    if ('vibrate' in navigator) navigator.vibrate([400, 150, 400])
    const pos = await currentPosition()
    let reason: Result['reason'] = 'signed_out'
    let delivered = false
    if (status === 'authed') {
      try {
        const r = await api<{ delivery: { sent: boolean; reason?: string }; guardianConfigured: boolean }>('/api/guardian/sos', {
          body: { lat: pos?.lat, lng: pos?.lng, token: guardianSession.getState().token ?? undefined },
          timeoutMs: 10_000,
        })
        delivered = r.delivery.sent
        reason = delivered ? 'sent' : !r.guardianConfigured ? 'no_guardian' : 'no_sms'
      } catch {
        reason = 'offline'
      }
    }
    setResult({ delivered, reason, pos })
    setPhase('done')
  }, [status])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (left <= 0) return void send()
    const id = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [left, phase, send])

  const who = user?.name ?? 'me'
  const where = result?.pos ? `https://maps.google.com/?q=${result.pos.lat},${result.pos.lng}` : null
  const smsBody = `SOS from ${who}: I need help.${where ? ` My location: ${where}` : ''}`
  const smsHref = config.phone ? `sms:${config.phone}?&body=${encodeURIComponent(smsBody)}` : null
  const big = 'flex min-h-16 w-full items-center justify-center gap-3 rounded-3xl px-5 text-xl font-extrabold'

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="sos-title" className="fixed inset-0 z-[60] flex flex-col gap-4 overflow-y-auto bg-[#B3261E] p-5 text-white" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
      <div className="flex items-center gap-3">
        <Siren size={40} aria-hidden />
        <h1 id="sos-title" className="text-3xl font-extrabold">
          {phase === 'countdown' ? `Sending SOS in ${left}` : phase === 'sending' ? 'Sending SOS…' : result?.delivered ? 'Your guardian was alerted' : 'Alert not sent automatically'}
        </h1>
      </div>

      {phase === 'countdown' && (
        <>
          <p className="text-lg font-semibold">Your guardian{config.name ? `, ${config.name},` : ''} will get your location. Tap Cancel if this was a mistake.</p>
          <button autoFocus onClick={onClose} className={`${big} bg-white text-[#B3261E]`}><X size={28} aria-hidden /> Cancel</button>
          <button onClick={() => void send()} className={`${big} border-4 border-white bg-transparent`}>Send now</button>
        </>
      )}
      {phase === 'sending' && <p role="status" className="text-lg font-semibold">Getting your location and alerting your guardian…</p>}

      {phase === 'done' && result && (
        <>
          <p role="status" className="text-lg font-semibold">
            {result.reason === 'sent' && 'They received a message with your location. Stay where you are if it is safe.'}
            {result.reason === 'no_sms' && 'This app could not send an SMS from the server. Use the buttons below so your guardian hears from you right now.'}
            {result.reason === 'no_guardian' && 'No guardian is saved on your account. Call 112 or someone you trust.'}
            {result.reason === 'offline' && 'No internet connection. Use the buttons below, they work without the app’s servers.'}
            {result.reason === 'signed_out' && 'You are not signed in, so the app could not alert anyone for you. Use the buttons below.'}
            {!result.pos && ' We could not get your location. Turn on location permission so help can find you.'}
          </p>
          {!result.delivered && smsHref && <a href={smsHref} className={`${big} bg-white text-[#B3261E]`}><MessageSquareWarning size={28} aria-hidden /> Text {config.name || 'guardian'} my location</a>}
        </>
      )}

      {/* Calling works without the app's servers, so these are offered in every phase. */}
      <div className="mt-auto flex flex-col gap-3">
        <a href="tel:112" className={`${big} bg-white text-[#B3261E]`}><Phone size={28} aria-hidden /> Call emergency 112</a>
        {config.phone && <a href={`tel:${config.phone}`} className={`${big} border-4 border-white`}><Phone size={28} aria-hidden /> Call {config.name || 'guardian'}</a>}
        {phase === 'done' && <button onClick={onClose} className={`${big} bg-black/25`}>Close</button>}
      </div>
    </div>
  )
}

/** Check-in prompt for the optional inactivity alert. */
function CheckIn() {
  const { checkInDeadline } = useGuardianSession()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!checkInDeadline) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [checkInDeadline])
  if (!checkInDeadline) return null
  const secs = Math.max(0, Math.ceil((checkInDeadline - now) / 1000))
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="checkin-title" className="fixed inset-0 z-[55] flex flex-col justify-center gap-4 bg-[#0B3D91] p-6 text-white">
      <h1 id="checkin-title" className="text-4xl font-extrabold">Are you OK?</h1>
      <p className="text-xl font-semibold">You haven’t moved for a while. Your guardian will be told in {secs} seconds unless you answer.</p>
      <button autoFocus onClick={() => guardianSession.confirmOk()} className="min-h-20 rounded-3xl bg-white text-2xl font-extrabold text-[#0B3D91]">I’m OK</button>
      <button onClick={() => { guardianSession.confirmOk(); window.dispatchEvent(new Event(SOS_EVENT)) }} className="min-h-16 rounded-3xl border-4 border-white text-xl font-extrabold">I need help</button>
    </div>
  )
}

/** Always-visible SOS button (Guardian Mode only) plus the SOS and check-in overlays. */
export function SosLayer() {
  const { config } = useGuardian()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener(SOS_EVENT, h)
    return () => window.removeEventListener(SOS_EVENT, h)
  }, [])
  if (!config.enabled) return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="SOS: alert my guardian"
        className="fixed right-4 bottom-28 z-40 flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-[#B3261E] text-white shadow-[0_12px_30px_-6px_rgba(179,38,30,0.8)] ring-4 ring-white sm:bottom-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ShieldAlert size={26} aria-hidden />
        <span className="text-lg font-extrabold leading-none">SOS</span>
      </button>
      {open && <SosSheet onClose={() => setOpen(false)} />}
      <CheckIn />
    </>
  )
}
