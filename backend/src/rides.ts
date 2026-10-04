import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from './config.ts'

// Last-mile ride comparison. Only real data is shown:
//  - Fares/ETAs come exclusively from official provider APIs we hold credentials for (Uber, via UBER_SERVER_TOKEN).
//  - Providers without an API integration are returned as `deeplink` options with no price or ETA.
//  - Distance and drive time come from the road network (OSRM) and are labelled as such.

export type RideSource = 'api' | 'deeplink'
export interface RideOption {
  id: string
  provider: 'uber' | 'ola' | 'rapido' | 'namma-yatri'
  providerName: string
  product: string
  vehicle: 'cab' | 'auto' | 'bike'
  source: RideSource
  fare?: { low: number; high: number; currency: string }
  etaMin?: number
  tripMin?: number
  deepLink: string
  note: string
  error?: string
}
export interface RideResponse {
  route: { distanceKm: number; durationMin: number; source: 'osrm' } | null
  options: RideOption[]
  apiProviders: string[]
  generatedAt: string
}
interface Pt { lat: number; lng: number }

const cache = new Map<string, { at: number; value: RideResponse }>()
const TTL_MS = 45_000

async function roadRoute(a: Pt, b: Pt): Promise<RideResponse['route']> {
  try {
    const res = await fetch(`${config.osrmUrl}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = (await res.json()) as { routes?: { distance: number; duration: number }[] }
    const r = data.routes?.[0]
    return r ? { distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.max(1, Math.round(r.duration / 60)), source: 'osrm' } : null
  } catch {
    return null
  }
}

const vehicleOf = (name: string): RideOption['vehicle'] => (/auto/i.test(name) ? 'auto' : /moto|bike/i.test(name) ? 'bike' : 'cab')

async function uberOptions(a: Pt, b: Pt): Promise<RideOption[]> {
  const link = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${a.lat}&pickup[longitude]=${a.lng}&dropoff[latitude]=${b.lat}&dropoff[longitude]=${b.lng}`
  if (!config.uberServerToken) {
    return [{ id: 'uber-link', provider: 'uber', providerName: 'Uber', product: 'Uber', vehicle: 'cab', source: 'deeplink', deepLink: link, note: 'Fare and pickup time are shown in the Uber app.' }]
  }
  const headers = { Authorization: `Token ${config.uberServerToken}`, 'Accept-Language': 'en_US' }
  try {
    const [priceRes, timeRes] = await Promise.all([
      fetch(`https://api.uber.com/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lng}&end_latitude=${b.lat}&end_longitude=${b.lng}`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.uber.com/v1.2/estimates/time?start_latitude=${a.lat}&start_longitude=${a.lng}`, { headers, signal: AbortSignal.timeout(8000) }),
    ])
    if (!priceRes.ok) throw new Error(`uber ${priceRes.status}`)
    const prices = ((await priceRes.json()) as { prices?: { product_id: string; display_name: string; low_estimate: number | null; high_estimate: number | null; currency_code: string | null; duration: number | null }[] }).prices ?? []
    const times = timeRes.ok ? (((await timeRes.json()) as { times?: { product_id: string; estimate: number }[] }).times ?? []) : []
    const etaById = new Map(times.map((t) => [t.product_id, Math.max(1, Math.round(t.estimate / 60))]))
    const out: RideOption[] = prices
      .filter((p) => p.low_estimate !== null && p.high_estimate !== null)
      .map((p) => ({
        id: `uber-${p.product_id}`, provider: 'uber', providerName: 'Uber', product: p.display_name, vehicle: vehicleOf(p.display_name), source: 'api',
        fare: { low: p.low_estimate as number, high: p.high_estimate as number, currency: p.currency_code ?? 'INR' },
        etaMin: etaById.get(p.product_id), tripMin: p.duration ? Math.round(p.duration / 60) : undefined,
        deepLink: `${link}&product_id=${encodeURIComponent(p.product_id)}`,
        note: 'Estimate from the Uber API. The final fare is confirmed in the Uber app.',
      }))
    if (out.length) return out
    throw new Error('no products')
  } catch {
    return [{ id: 'uber-link', provider: 'uber', providerName: 'Uber', product: 'Uber', vehicle: 'cab', source: 'deeplink', deepLink: link, error: 'unavailable', note: 'Uber prices are unavailable right now. Open the Uber app to see fares.' }]
  }
}

function linkOnlyOptions(a: Pt, b: Pt): RideOption[] {
  const ola = `https://olawebcdn.com/assets/ola-universal-link.html?lat=${a.lat}&lng=${a.lng}&drop_lat=${b.lat}&drop_lng=${b.lng}&utm_source=namma-route`
  return [
    { id: 'ola-link', provider: 'ola', providerName: 'Ola', product: 'Ola', vehicle: 'cab', source: 'deeplink', deepLink: ola, note: 'No price API is available to us. Fare and ETA are shown in the Ola app.' },
    { id: 'rapido-link', provider: 'rapido', providerName: 'Rapido', product: 'Rapido', vehicle: 'bike', source: 'deeplink', deepLink: 'https://www.rapido.bike/', note: 'External app. Rapido has no public price API, so enter your trip in the Rapido app.' },
    { id: 'nammayatri-link', provider: 'namma-yatri', providerName: 'Namma Yatri', product: 'Namma Yatri', vehicle: 'auto', source: 'deeplink', deepLink: 'https://nammayatri.in/', note: 'External app for autos. Enter your trip in the Namma Yatri app.' },
  ]
}

const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
const validPt = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

export function ridesRouter(): Router {
  const r = Router()
  r.use(rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many requests. Please try again in a minute.' } }))
  r.get('/options', async (req, res) => {
    const a = { lat: num(req.query.plat), lng: num(req.query.plng) }
    const b = { lat: num(req.query.dlat), lng: num(req.query.dlng) }
    if (!validPt(a.lat, a.lng) || !validPt(b.lat, b.lng)) return void res.status(400).json({ error: 'invalid_coordinates', message: 'Pickup and drop coordinates are required.' })
    const key = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join(',')
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return void res.json(hit.value)
    const [route, uber] = await Promise.all([roadRoute(a, b), uberOptions(a, b)])
    const options = [...uber, ...linkOnlyOptions(a, b)].map((o) => ({ ...o, tripMin: o.tripMin ?? (o.source === 'api' ? route?.durationMin : undefined) }))
    const value: RideResponse = { route, options, apiProviders: config.uberServerToken ? ['uber'] : [], generatedAt: new Date().toISOString() }
    cache.set(key, { at: Date.now(), value })
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
    res.json(value)
  })
  return r
}
