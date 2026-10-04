export type HapticKind = 'step' | 'alert' | 'arrive'

const PATTERNS: Record<HapticKind, number[]> = {
  step: [120],
  alert: [400, 150, 400, 150, 400],
  arrive: [200, 100, 200, 100, 500],
}
const TONE_HZ: Record<HapticKind, number> = { step: 520, alert: 880, arrive: 660 }

let audio: AudioContext | null = null

export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

function tone(kind: HapticKind): void {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = TONE_HZ[kind]
    gain.gain.value = 0.08
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (kind === 'step' ? 0.08 : 0.3))
  } catch {
    // Audio can be blocked until the user interacts with the page.
  }
}

/** Vibrates (where supported) and plays a short tone. */
export function haptic(kind: HapticKind): void {
  if (vibrationSupported()) navigator.vibrate(PATTERNS[kind])
  tone(kind)
}
