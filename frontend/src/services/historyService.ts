import type { Journey, SavedJourneyRecord } from '@/types'

const STORAGE_KEY = 'nammaroute.journeyHistory.v1'
const MAX_ENTRIES = 20

export interface HistoryService {
  list(): Promise<SavedJourneyRecord[]>
  record(journey: Journey, status: SavedJourneyRecord['status']): Promise<SavedJourneyRecord>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

function readAll(): SavedJourneyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedJourneyRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(records: SavedJourneyRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_ENTRIES)))
  } catch {
    // Non-blocking: history is a convenience, not a source of truth.
  }
}

class LocalHistoryService implements HistoryService {
  async list(): Promise<SavedJourneyRecord[]> {
    return readAll()
  }

  async record(journey: Journey, status: SavedJourneyRecord['status']): Promise<SavedJourneyRecord> {
    const records = readAll()
    const record: SavedJourneyRecord = {
      id: `hist-${crypto.randomUUID()}`,
      journey,
      searchedAt: new Date().toISOString(),
      status,
    }
    writeAll([record, ...records])
    return record
  }

  async remove(id: string): Promise<void> {
    writeAll(readAll().filter((r) => r.id !== id))
  }

  async clear(): Promise<void> {
    writeAll([])
  }
}

export const historyService: HistoryService = new LocalHistoryService()
