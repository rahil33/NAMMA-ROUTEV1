import { useState } from 'react'
import { CheckCircle2, Phone, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { useGuardian } from '@/context/guardian'
import { SOS_EVENT } from '@/components/guardian/SosLayer'

const inputCls = 'mt-1 w-full rounded-2xl border-2 border-black/30 bg-white px-4 py-4 text-xl outline-none focus:border-[var(--color-line-teal-600)]'
const selectCls = `${inputCls} appearance-auto`

export function Guardian() {
  const { config, save, smsConfigured, syncError } = useGuardian()
  const [name, setName] = useState(config.name)
  const [phone, setPhone] = useState(config.phone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validPhone = /^(\+?\d[\d\s-]{8,14})$/.test(phone.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validPhone) return setError('Enter your guardian’s mobile number, for example 98765 43210.')
    setSaving(true)
    setError(null)
    // The server normalises the number (+91 added for 10-digit Indian numbers); keep what the user typed on the device.
    await save({ name: name.trim(), phone: /^\d{10}$/.test(phone.replace(/\D/g, '')) && !phone.trim().startsWith('+') ? `+91${phone.replace(/\D/g, '')}` : phone.replace(/[\s-]/g, '') })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 p-5 pb-12 text-lg">
      <header>
        <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight"><ShieldCheck size={36} aria-hidden /> Guardian Mode</h1>
        <p className="mt-2 font-semibold text-[var(--color-ink-800)]">Someone you trust can follow your journey and get an alert if you need help.</p>
      </header>

      <section className="soft-card flex items-center justify-between gap-4 rounded-[var(--radius-sheet)] p-5">
        <div>
          <p className="text-2xl font-extrabold">{config.enabled ? 'Guardian Mode is ON' : 'Guardian Mode is OFF'}</p>
          <p className="text-base text-[var(--color-ink-700)]">{config.enabled ? 'The red SOS button is on every screen.' : 'Turn on to show the SOS button and large, simple screens.'}</p>
        </div>
        <button
          role="switch"
          aria-checked={config.enabled}
          aria-label="Guardian Mode"
          disabled={!config.phone && !config.enabled}
          onClick={() => void save({ enabled: !config.enabled })}
          className={`relative h-14 w-24 shrink-0 rounded-full transition-colors disabled:opacity-40 ${config.enabled ? 'bg-[var(--color-ok-600)]' : 'bg-black/30'}`}
        >
          <span className={`absolute top-1 h-12 w-12 rounded-full bg-white shadow transition-all ${config.enabled ? 'left-11' : 'left-1'}`} />
        </button>
      </section>
      {!config.phone && <p className="-mt-2 text-base font-semibold">Save your guardian’s number first, then turn Guardian Mode on.</p>}

      <form onSubmit={submit} className="soft-card flex flex-col gap-4 rounded-[var(--radius-sheet)] p-5">
        <h2 className="text-2xl font-extrabold">Your guardian</h2>
        <label className="font-bold">Name
          <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} autoComplete="off" placeholder="For example, Priya" />
        </label>
        <label className="font-bold">Mobile number
          <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false) }} autoComplete="off" placeholder="98765 43210" required />
        </label>
        <Button type="submit" size="lg" className="min-h-16 text-xl" disabled={saving}>{saving ? 'Saving…' : 'Save guardian'}</Button>
        {saved && <p role="status" className="flex items-center gap-2 font-bold text-[var(--color-ok-600)]"><CheckCircle2 aria-hidden /> Saved.</p>}
        {error && <p role="alert" className="font-bold text-[var(--color-warn-600)]">{error}</p>}
        {syncError && <p role="status" className="text-base font-semibold text-[var(--color-warn-600)]">Saved on this phone, but not yet on your account: {syncError}</p>}
      </form>

      <section className="soft-card flex flex-col gap-4 rounded-[var(--radius-sheet)] p-5">
        <h2 className="text-2xl font-extrabold">Alerts</h2>
        <label className="font-bold">Tell my guardian if I go off the planned route by more than
          <select className={selectCls} value={config.deviationMeters} onChange={(e) => void save({ deviationMeters: Number(e.target.value) })}>
            {[200, 300, 500, 1000].map((m) => <option key={m} value={m}>{m >= 1000 ? `${m / 1000} km` : `${m} metres`}</option>)}
          </select>
        </label>
        <label className="font-bold">If I stop moving, ask “Are you OK?” after
          <select className={selectCls} value={config.inactivityMinutes ?? 0} onChange={(e) => void save({ inactivityMinutes: Number(e.target.value) || null })}>
            <option value={0}>Never</option>
            {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <label className="flex items-center gap-4 font-bold">
          <input type="checkbox" className="h-8 w-8" checked={config.notifyStartEnd} onChange={(e) => void save({ notifyStartEnd: e.target.checked })} />
          Message my guardian when I start and finish a journey
        </label>
      </section>

      <section className="rounded-[var(--radius-sheet)] border-2 border-[var(--color-ink-950)] bg-white p-5 text-base font-semibold" aria-label="How alerts are sent">
        <h2 className="text-xl font-extrabold">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Live location is shared only while a journey is running, and only through the link your guardian receives.</li>
          <li>Keep this app open during the journey: browsers can pause location tracking when the screen is off.</li>
          <li>{smsConfigured === true ? 'Automatic text messages are on.' : smsConfigured === false ? 'Automatic text messages are not set up on this server. The SOS screen will open your own messaging app instead, so the alert is sent from your phone.' : 'Sign in to check whether automatic text messages are available.'}</li>
          <li>Route-deviation alerts need real routes. They are off for demo journeys.</li>
        </ul>
        {!config.phone ? null : (
          <Button variant="secondary" size="lg" className="mt-4 w-full min-h-14" onClick={() => window.dispatchEvent(new Event(SOS_EVENT))} disabled={!config.enabled}>
            <TriangleAlert size={20} aria-hidden /> Practise the SOS screen
          </Button>
        )}
        {config.phone && <a href={`tel:${config.phone}`} className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-black text-lg font-extrabold"><Phone size={20} aria-hidden /> Call {config.name || 'guardian'}</a>}
      </section>
    </div>
  )
}
