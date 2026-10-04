import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/services/api'
import type { RideResponseDto } from '@/utils/rideRanking'

export interface Point {
  name: string
  lat: number
  lng: number
}

export type RideState =
  | { status: 'loading' }
  | { status: 'ready'; data: RideResponseDto }
  | { status: 'error'; message: string; unreachable: boolean }

export function fetchRideOptions(from: Point, to: Point, signal?: AbortSignal): Promise<RideResponseDto> {
  const q = new URLSearchParams({ plat: String(from.lat), plng: String(from.lng), dlat: String(to.lat), dlng: String(to.lng) })
  return api<RideResponseDto>(`/api/rides/options?${q}`, { signal })
}

export function useRideOptions(from: Point, to: Point): { state: RideState; retry: () => void } {
  const [state, setState] = useState<RideState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const key = `${from.lat},${from.lng},${to.lat},${to.lng}`

  useEffect(() => {
    const ctl = new AbortController()
    setState({ status: 'loading' })
    fetchRideOptions(from, to, ctl.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return
        setState({ status: 'error', message: e instanceof ApiError ? e.message : 'Could not load ride options.', unreachable: e instanceof ApiError && e.unreachable })
      })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures from/to by value
  }, [key, attempt])

  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}
