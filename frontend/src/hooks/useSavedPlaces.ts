import { useCallback, useEffect, useState } from 'react'
import type { SavedPlace, PlaceKind } from '@/types'
import { savedPlacesService } from '@/services/savedPlacesService'

export function useSavedPlaces() {
  const [places, setPlaces] = useState<SavedPlace[]>([])

  useEffect(() => {
    let active = true
    void savedPlacesService.list().then((list) => {
      if (active) setPlaces(list)
    })
    return () => {
      active = false
    }
  }, [])

  const savePlace = useCallback(async (kind: PlaceKind, label: string, locationId: string) => {
    await savedPlacesService.upsert(kind, label, locationId)
    setPlaces(await savedPlacesService.list())
  }, [])

  const removePlace = useCallback(async (id: string) => {
    await savedPlacesService.remove(id)
    setPlaces(await savedPlacesService.list())
  }, [])

  return { places, savePlace, removePlace }
}
