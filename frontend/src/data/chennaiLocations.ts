import type { Location } from '@/types'

// Approximate real-world coordinates for well-known Chennai hubs.
export const CHENNAI_LOCATIONS: Location[] = [
  { id: 'loc-tambaram', name: 'Tambaram', area: 'Suburban Rail Junction', lat: 12.9249, lng: 80.1000, aliases: ['தாம்பரம்', 'tambaram railway station'] },
  { id: 'loc-chennai-central', name: 'Chennai Central', area: 'Park Town', lat: 13.0827, lng: 80.2755, aliases: ['central', 'mgr central', 'சென்ட்ரல்', 'சென்னை சென்ட்ரல்'] },
  { id: 'loc-guindy', name: 'Guindy', area: 'Guindy', lat: 13.0067, lng: 80.2206, aliases: ['கிண்டி'] },
  { id: 'loc-t-nagar', name: 'T. Nagar', area: 'Thyagaraya Nagar', lat: 13.0418, lng: 80.2341, aliases: ['t nagar', 'tnagar', 'thyagaraya nagar', 'தி நகர்', 'தியாகராய நகர்'] },
  { id: 'loc-velachery', name: 'Velachery', area: 'Velachery', lat: 12.9791, lng: 80.2183, aliases: ['வேளச்சேரி'] },
  { id: 'loc-anna-nagar', name: 'Anna Nagar', area: 'Anna Nagar West', lat: 13.0850, lng: 80.2101, aliases: ['annanagar', 'அண்ணா நகர்'] },
  { id: 'loc-adyar', name: 'Adyar', area: 'Adyar', lat: 13.0012, lng: 80.2565, aliases: ['அடையாறு'] },
  { id: 'loc-sholinganallur', name: 'Sholinganallur', area: 'OMR IT Corridor', lat: 12.9010, lng: 80.2279, aliases: ['shollinganallur', 'solinganallur', 'சோழிங்கநல்லூர்'] },
  { id: 'loc-thiruvanmiyur', name: 'Thiruvanmiyur', area: 'ECR', lat: 12.9830, lng: 80.2593, aliases: ['tiruvanmiyur', 'திருவான்மியூர்'] },
  { id: 'loc-airport', name: 'Chennai Airport', area: 'Meenambakkam', lat: 12.9941, lng: 80.1709, aliases: ['airport', 'maa airport', 'meenambakkam airport', 'விமான நிலையம்', 'ஏர்போர்ட்'] },
  { id: 'loc-cmbt', name: 'CMBT', area: 'Koyambedu', lat: 13.0694, lng: 80.1948, aliases: ['koyambedu', 'koyembedu', 'bus terminus', 'கோயம்பேடு'] },
  { id: 'loc-egmore', name: 'Egmore', area: 'Egmore', lat: 13.0732, lng: 80.2609, aliases: ['எழும்பூர்'] },
  // Airport corridor (GST Road / Metro Blue Line)
  { id: 'loc-pallavaram', name: 'Pallavaram', area: 'GST Road', lat: 12.9675, lng: 80.1491, aliases: ['பல்லாவரம்'] },
  { id: 'loc-chromepet', name: 'Chromepet', area: 'GST Road', lat: 12.9516, lng: 80.1462, aliases: ['குரோம்பேட்டை'] },
  { id: 'loc-tirusulam', name: 'Tirusulam', area: 'Airport Rail Station', lat: 12.9846, lng: 80.1637, aliases: ['thirusulam', 'trisulam', 'திரிசூலம்'] },
  { id: 'loc-airport-metro', name: 'Airport Metro', area: 'Meenambakkam', lat: 12.9877, lng: 80.1636, aliases: ['meenambakkam metro', 'airport metro station'] },
  { id: 'loc-alandur', name: 'Alandur', area: 'Metro Interchange', lat: 13.0035, lng: 80.2015, aliases: ['ஆலந்தூர்'] },
  { id: 'loc-st-thomas-mount', name: 'St. Thomas Mount', area: 'Metro / Rail', lat: 12.9950, lng: 80.1986, aliases: ['st thomas mount', 'thomas mount', 'parangimalai', 'பரங்கிமலை'] },
  // South and GST Road
  { id: 'loc-vandalur', name: 'Vandalur', area: 'Zoo / GST Road', lat: 12.8925, lng: 80.0810, aliases: ['வண்டலூர்'] },
  { id: 'loc-perungalathur', name: 'Perungalathur', area: 'GST Road', lat: 12.9066, lng: 80.0999, aliases: ['பெருங்களத்தூர்'] },
  { id: 'loc-kilambakkam', name: 'Kilambakkam (KCBT)', area: 'Outer Bus Terminus', lat: 12.8437, lng: 80.0680, aliases: ['kcbt', 'kilambakkam', 'klambakkam', 'கிளாம்பாக்கம்'] },
  { id: 'loc-chengalpattu', name: 'Chengalpattu', area: 'Rail Junction', lat: 12.6819, lng: 79.9888, aliases: ['chengalpet', 'செங்கல்பட்டு'] },
  // OMR
  { id: 'loc-perungudi', name: 'Perungudi', area: 'OMR', lat: 12.9654, lng: 80.2461, aliases: ['பெருங்குடி'] },
  { id: 'loc-thoraipakkam', name: 'Thoraipakkam', area: 'OMR', lat: 12.9400, lng: 80.2350, aliases: ['துரைப்பாக்கம்'] },
  { id: 'loc-siruseri', name: 'Siruseri', area: 'SIPCOT IT Park', lat: 12.8270, lng: 80.2190, aliases: ['சிறுசேரி'] },
  // Central and north
  { id: 'loc-porur', name: 'Porur', area: 'Mount-Poonamallee Rd', lat: 13.0382, lng: 80.1565, aliases: ['போரூர்'] },
  { id: 'loc-vadapalani', name: 'Vadapalani', area: 'Vadapalani', lat: 13.0500, lng: 80.2121, aliases: ['வடபழனி'] },
  { id: 'loc-saidapet', name: 'Saidapet', area: 'Saidapet', lat: 13.0213, lng: 80.2231, aliases: ['சைதாப்பேட்டை'] },
  { id: 'loc-mylapore', name: 'Mylapore', area: 'Mylapore', lat: 13.0339, lng: 80.2687, aliases: ['மயிலாப்பூர்'] },
  { id: 'loc-nungambakkam', name: 'Nungambakkam', area: 'Nungambakkam', lat: 13.0569, lng: 80.2425, aliases: ['நுங்கம்பாக்கம்'] },
  { id: 'loc-perambur', name: 'Perambur', area: 'North Chennai', lat: 13.1180, lng: 80.2330, aliases: ['பெரம்பூர்'] },
  { id: 'loc-marina', name: 'Marina Beach', area: 'Triplicane', lat: 13.0500, lng: 80.2824, aliases: ['marina', 'மெரினா'] },
]

// Lowercase, strip dots/hyphens/punctuation, collapse spaces. Keeps Tamil letters.
function norm(s: string): string {
  return s.toLowerCase().replace(/[.\-_,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function compact(s: string): string {
  return norm(s).replace(/ /g, '')
}

// Lower is better; -1 means no match.
function rank(l: Location, q: string, qc: string): number {
  const names = [l.name, ...(l.aliases ?? [])]
  let best = -1
  const bump = (r: number) => { if (best === -1 || r < best) best = r }
  for (const n of names) {
    const nn = norm(n), nc = compact(n)
    if (nn === q || nc === qc) bump(0)
    else if (nn.startsWith(q) || nc.startsWith(qc)) bump(1)
    else if (nn.split(' ').some((w) => w.startsWith(q))) bump(2)
    else if (nn.includes(q) || nc.includes(qc)) bump(3)
  }
  if (norm(l.area).includes(q)) bump(4)
  return best
}

export function searchLocations(query: string): Location[] {
  const q = norm(query)
  if (!q) return CHENNAI_LOCATIONS
  const qc = q.replace(/ /g, '')
  return CHENNAI_LOCATIONS
    .map((l) => ({ l, r: rank(l, q, qc) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.l.name.localeCompare(b.l.name))
    .map((x) => x.l)
}
