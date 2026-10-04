import { useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { listen, voiceInputSupported } from '@/services/voiceService'
import { hasIntent, parseVoiceCommand, type VoiceIntent } from '@/utils/voiceCommand'
import { usePreferences } from '@/context/preferences'
import { useT } from '@/i18n/useT'

/** Prominent voice control: large mic, pulsing ring, live transcript while speaking, real cancel. */
export function VoiceButton({ onIntent }: { onIntent: (intent: VoiceIntent) => void }) {
  const { preferences } = usePreferences()
  const t = useT()
  const [status, setStatus] = useState<string | null>(null)
  const [live, setLive] = useState('')
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)

  if (!voiceInputSupported()) return <p className="text-xs text-[var(--color-ink-700)]">{t('voiceUnsupported')}</p>

  async function start() {
    const ctl = new AbortController()
    abort.current = ctl
    setBusy(true)
    setLive('')
    setStatus(t('voiceListening'))
    try {
      const text = await listen(preferences.language, { onInterim: setLive, signal: ctl.signal })
      const intent = parseVoiceCommand(text)
      if (hasIntent(intent)) {
        setStatus(t('voiceHeard', { text }))
        onIntent(intent)
      } else setStatus(t('voiceNoMatch'))
    } catch (e) {
      setStatus(e instanceof DOMException ? null : e instanceof Error && e.message.length > 20 ? e.message : t('voiceNoMatch'))
    } finally {
      setBusy(false)
      setLive('')
    }
  }

  return (
    <div className={`flex items-center gap-4 rounded-[28px] p-3 transition-colors ${busy ? 'bg-[var(--color-ink-950)] text-white' : 'bg-white/60'}`}>
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        {busy && <span className="mic-ring absolute inset-0 rounded-full bg-[var(--color-primary)]" aria-hidden />}
        <button
          type="button"
          onClick={start}
          disabled={busy}
          aria-label={t('voice')}
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-ink-950)] shadow-[0_12px_28px_-8px_rgba(32,214,199,0.8)] transition active:scale-95"
        >
          <Mic size={26} aria-hidden />
        </button>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{busy ? t('voiceListening') : t('voice')}</p>
        <p role="status" className={`mt-0.5 text-sm ${busy ? 'text-white/90' : 'text-[var(--color-ink-700)]'}`}>
          {busy ? live || 'Take me to Guindy under ₹30' : (status ?? 'Take me to Guindy under ₹30')}
        </p>
      </div>
      {busy && (
        <button type="button" onClick={() => abort.current?.abort()} aria-label="Cancel voice input" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <X size={18} aria-hidden />
        </button>
      )}
    </div>
  )
}
