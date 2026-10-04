// Types for public/voice.js (loaded as a plain <script>, which defines window.createVoice).
export interface VoiceOptions {
  lang?: string
  wakeWord?: string
  rate?: number
  onResult?: (text: string, confidence?: number) => void
  onInterim?: (text: string) => void
  onState?: (state: 'idle' | 'listening' | 'waiting' | 'armed' | 'speaking') => void
  onError?: (message: string, code?: string) => void
  onWake?: () => void
}
export interface VoiceInstance {
  supported: { listen: boolean; speak: boolean }
  state: string
  start(): boolean
  stop(): void
  toggle(): void
  speak(text: string, opts?: { lang?: string; rate?: number; pitch?: number }): Promise<boolean>
  stopSpeech(): void
  setLang(lang: string): void
  bindButton(button: HTMLElement): void
}
declare global {
  interface Window {
    createVoice?: (opts?: VoiceOptions) => VoiceInstance
  }
}
