import type { Location, OptimizeFor } from '@/types'
import { searchLocations } from '@/data/chennaiLocations'

export interface VoiceIntent {
  origin?: Location
  destination?: Location
  priorities?: OptimizeFor[]
  rainMode?: boolean
  budgetRupees?: number
  /** Arrival target as 24-hour "HH:MM", from phrases like "arrive by 9 30 am". */
  arriveBy?: string
}

const OPTIMIZE_PATTERNS: [RegExp, OptimizeFor][] = [
  [/fastest|quickest|வேகமாக/i, 'fastest'],
  [/cheapest|cheap|lowest fare|மலிவு/i, 'cheapest'],
  [/least walking|less walking|குறைவாக நட/i, 'least-walking'],
  [/fewest transfers|fewer transfers|no transfers|மாற்றம் குறை/i, 'fewest-transfers'],
  [/accessible|wheelchair|step[- ]free|சக்கர நாற்காலி/i, 'accessible'],
  [/comfortable|smoothest|smooth road|least bumpy/i, 'comfortable'],
  [/balanced/i, 'balanced'],
]

const TRAILING = String.raw`(?:\s+(?:with|under|below|within|by|using|and|budget|cheapest|fastest)\b.*)?$`
const FROM_TO = new RegExp(String.raw`from\s+(.+?)\s+to\s+(.+?)` + TRAILING, 'i')
const TO_ONLY = new RegExp(String.raw`\bto\s+(.+?)` + TRAILING, 'i')
const BUDGET = /(?:under|below|within|budget(?: of)?)\s*(?:rs\.?|₹|rupees)?\s*(\d{1,4})/i

const ARRIVE_BY = /\b(?:arrive|reach|get there|be there|be at \w+)\s+(?:by|before)\s+(\d{1,2})(?:[:\s](\d{2}))?\s*(a\.?\s?m|p\.?\s?m)?\b/i

/** Parses a spoken arrival time into 24-hour "HH:MM". Without am/pm, 1-6 is read as evening, 7-12 as written. */
export function parseArriveBy(text: string): { hhmm: string; matched: string } | null {
  const m = ARRIVE_BY.exec(text)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  if (hour > 24 || minute > 59) return null
  const meridiem = m[3]?.toLowerCase().replace(/[.\s]/g, '')
  if (meridiem === 'pm' && hour < 12) hour += 12
  else if (meridiem === 'am' && hour === 12) hour = 0
  else if (!meridiem && hour >= 1 && hour <= 6) hour += 12
  if (hour === 24) hour = 0
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return { hhmm, matched: m[0] }
}

function resolve(name: string): Location | undefined {
  return searchLocations(name)[0]
}

/** Rule-based parsing of a spoken request; deterministic and offline. */
export function parseVoiceCommand(text: string): VoiceIntent {
  const intent: VoiceIntent = {}
  text = text.replace(/[,.;]/g, ' ').replace(/\s+/g, ' ').trim()
  const arrive = parseArriveBy(text)
  if (arrive) {
    intent.arriveBy = arrive.hhmm
    text = text.replace(arrive.matched, ' ').replace(/\s+/g, ' ').trim() // keep it out of the place names
  }
  const priorities = OPTIMIZE_PATTERNS.filter(([re]) => re.test(text)).map(([, value]) => value)
  if (priorities.length > 0) intent.priorities = priorities

  if (/no rain|rain mode off|மழை.*வேண்டாம்/i.test(text)) intent.rainMode = false
  else if (/rain|மழை/i.test(text)) intent.rainMode = true

  const budget = BUDGET.exec(text)
  if (budget) intent.budgetRupees = Number(budget[1])

  const both = FROM_TO.exec(text)
  if (both) {
    intent.origin = resolve(both[1])
    intent.destination = resolve(both[2])
  } else {
    const only = TO_ONLY.exec(text)
    if (only) intent.destination = resolve(only[1])
  }
  return intent
}

export function hasIntent(intent: VoiceIntent): boolean {
  return Object.values(intent).some((v) => v !== undefined)
}

export type NavCommand = 'next' | 'repeat' | 'stop' | 'missed' | 'reroute'

const NAV_PATTERNS: [RegExp, NavCommand][] = [
  [/missed|miss my|தவறவிட்/i, 'missed'],
  [/re-?route|alternative|another route|மாற்று/i, 'reroute'],
  [/repeat|again|say that|மீண்டும்/i, 'repeat'],
  [/next|skip|continue|அடுத்த/i, 'next'],
  [/stop|end|cancel|நிறுத்து|முடி/i, 'stop'],
]

/** Maps a spoken phrase to a live-navigation command, or null when nothing matches. */
export function parseNavCommand(text: string): NavCommand | null {
  return NAV_PATTERNS.find(([re]) => re.test(text))?.[1] ?? null
}
