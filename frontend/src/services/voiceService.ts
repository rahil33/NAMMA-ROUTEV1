import type { Language } from '@/types'
import type { VoiceInstance, VoiceOptions } from '@/types/voice'

// Speech-to-text and text-to-speech run through public/voice.js (window.createVoice).
const LOCALE: Record<Language, string> = { en: 'en-IN', ta: 'ta-IN', te: 'te-IN' }
export const WAKE_WORD = 'hey namma'

function makeVoice(opts: VoiceOptions): VoiceInstance | null {
  return typeof window !== 'undefined' && window.createVoice ? window.createVoice(opts) : null
}

export function voiceInputSupported(): boolean {
  return makeVoice({})?.supported.listen ?? false
}

/** Resolves with one spoken phrase. Live text goes to onInterim; abort the signal to cancel. */
export function listen(language: Language, opts: { onInterim?: (text: string) => void; signal?: AbortSignal } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false
    const settle = (fn: () => void) => {
      if (done) return
      done = true
      fn()
    }
    const voice = makeVoice({
      lang: LOCALE[language],
      onInterim: opts.onInterim,
      onResult: (text) => settle(() => resolve(text)),
      onError: (message) => settle(() => reject(new Error(message))),
      // Recognition ended without a result (silence).
      onState: (state) => state === 'idle' && settle(() => reject(new Error('no-speech'))),
    })
    if (!voice || !voice.start()) return settle(() => reject(new Error('unsupported')))
    opts.signal?.addEventListener('abort', () => {
      voice.stop()
      settle(() => reject(new DOMException('cancelled', 'AbortError')))
    })
  })
}

/** Hands-free: keeps listening and calls onCommand for whatever follows "Hey Namma". Returns a stop function. */
export function startWakeListening(language: Language, onCommand: (text: string) => void, onError: (message: string) => void): () => void {
  const voice = makeVoice({ lang: LOCALE[language], wakeWord: WAKE_WORD, onResult: onCommand, onError: (m) => onError(m) })
  if (!voice) {
    onError('Voice input is not supported in this browser.')
    return () => {}
  }
  voice.start()
  return () => voice.stop()
}

let speaker: VoiceInstance | null = null

export function speak(text: string, language: Language): void {
  speaker ??= makeVoice({})
  if (!speaker || !speaker.supported.speak) return
  void speaker.speak(text, { lang: LOCALE[language] })
}
