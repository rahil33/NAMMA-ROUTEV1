import { useCallback, useEffect, useState } from 'react'
import type { Journey, SavedJourneyRecord } from '@/types'
import { historyService } from '@/services/historyService'

export function useJourneyHistory() {
  const [records, setRecords] = useState<SavedJourneyRecord[]>([])

  useEffect(() => {
    let active = true
    void historyService.list().then((list) => {
      if (active) setRecords(list)
    })
    return () => {
      active = false
    }
  }, [])

  const record = useCallback(async (journey: Journey, status: SavedJourneyRecord['status'] = 'searched') => {
    await historyService.record(journey, status)
    setRecords(await historyService.list())
  }, [])

  const remove = useCallback(async (id: string) => {
    await historyService.remove(id)
    setRecords(await historyService.list())
  }, [])

  const clear = useCallback(async () => {
    await historyService.clear()
    setRecords([])
  }, [])

  return { records, record, remove, clear }
}
