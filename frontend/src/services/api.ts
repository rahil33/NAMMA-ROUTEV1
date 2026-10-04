// Thin fetch wrapper for the NammaRoute API (server/). Cookies carry the session, so there are no tokens in JS.
export class ApiError extends Error {
  status: number
  code: string
  /** true when the server could not be reached at all (offline, API not running). */
  unreachable: boolean
  constructor(status: number, code: string, message: string, unreachable = false) {
    super(message)
    this.status = status
    this.code = code
    this.unreachable = unreachable
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

export async function api<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 12000)
  init.signal?.addEventListener('abort', () => ctl.abort())
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      credentials: 'include',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctl.signal,
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // A non-JSON answer means we hit a static host or proxy error page, not our API.
      throw new ApiError(res.status, 'bad_response', 'The service is not available right now.', true)
    }
    if (!res.ok) {
      const body = (data ?? {}) as { error?: string; message?: string }
      // A 5xx with no JSON error body comes from a proxy (e.g. Vite when the API isn't running), not from our API.
      if (res.status >= 500 && !body.error) throw new ApiError(res.status, 'unreachable', 'The service is not running or not reachable.', true)
      throw new ApiError(res.status, body.error ?? 'error', body.message ?? 'Something went wrong. Please try again.')
    }
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, 'unreachable', 'Cannot reach the service. Check your connection and try again.', true)
  } finally {
    clearTimeout(timer)
  }
}

export const apiUrl = (path: string) => `${BASE}${path}`
