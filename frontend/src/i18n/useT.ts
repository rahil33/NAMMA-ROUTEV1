import { usePreferences } from '@/context/preferences'
import { MESSAGES, type MessageKey } from './messages'

export type Translate = (key: MessageKey, vars?: Record<string, string>) => string

export function translate(language: keyof typeof MESSAGES, key: MessageKey, vars?: Record<string, string>): string {
  const template = MESSAGES[language][key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '')
}

export function useT(): Translate {
  const { preferences } = usePreferences()
  return (key, vars) => translate(preferences.language, key, vars)
}
