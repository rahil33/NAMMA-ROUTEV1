import type {
  AccessibilityInfo,
  IndoorOutdoor,
  Journey,
  JourneySegment,
  Location,
  OptimizeFor,
  TransportMode,
} from '@/types'
import { curvedPolyline, haversineKm } from '@/utils/geo'
import { crowdLevel, hourOf, isWeekend, roadSlowdown } from '@/utils/trafficModel'

interface LegSpec {
  mode: TransportMode
  fraction: number // share of the total distance this leg covers
  lineName?: string
  lineColor?: string
  platform?: string
  environment: IndoorOutdoor
  accessibility: Partial<AccessibilityInfo>
}

interface ArchetypeSpec {
  tag: OptimizeFor | 'balanced'
  legs: LegSpec[]
  speedMultiplier: number // overall pace vs. baseline (congestion, dwell time)
  bend: number // km, how much the route bows away from the direct line
  maxWalkKm?: number // overrides the default walking-leg cap (demo authoring only)
}

const MODE_SPEED_KMH: Record<TransportMode, number> = {
  walk: 4.5,
  bus: 17,
  metro: 33,
  'suburban-rail': 28,
  auto: 21,
}

const MODE_FARE_PER_KM: Record<TransportMode, number> = {
  walk: 0,
  bus: 1.6,
  metro: 3.1,
  'suburban-rail': 0.9,
  auto: 17,
}

const MODE_BASE_FARE: Record<TransportMode, number> = {
  walk: 0,
  bus: 8,
  metro: 10,
  'suburban-rail': 5,
  auto: 30,
}

// Line flavour keyed by a stable pair id so the flagship demo scenarios read
// as authored rather than generic. Any pair not listed here still gets a
// perfectly usable generic line name from `defaultLineName`.
const LINE_FLAVOUR: Record<string, { metro?: string; rail?: string; bus?: string; busColor?: string }> = {
  'loc-tambaram|loc-chennai-central': {
    rail: 'Chennai Suburban — Tambaram Line',
    bus: '70A',
  },
  'loc-sholinganallur|loc-guindy': {
    bus: '570',
    metro: 'Chennai Metro Phase II (OMR Corridor)',
  },
  'loc-velachery|loc-t-nagar': {
    metro: 'Chennai Metro Green Line',
    bus: '5A',
  },
  'loc-airport|loc-chennai-central': {
    metro: 'Chennai Metro Blue Line',
    bus: 'M23',
  },
}

function flavourFor(origin: Location, destination: Location) {
  const key = `${origin.id}|${destination.id}`
  const reverseKey = `${destination.id}|${origin.id}`
  return LINE_FLAVOUR[key] ?? LINE_FLAVOUR[reverseKey] ?? {}
}

function defaultLineName(mode: TransportMode, seed: number): string {
  switch (mode) {
    case 'metro':
      return seed % 2 === 0 ? 'Chennai Metro Blue Line' : 'Chennai Metro Green Line'
    case 'suburban-rail':
      return 'Chennai Suburban Rail (MRTS)'
    case 'bus':
      return `MTC ${21 + (seed % 60)}${['G', 'A', 'B', ''][seed % 4]}`
    default:
      return ''
  }
}

function accessibilityFor(mode: TransportMode, partial: Partial<AccessibilityInfo>): AccessibilityInfo {
  const isRail = mode === 'metro' || mode === 'suburban-rail'
  return {
    wheelchairAccessible: 'unknown',
    hasElevator: 'unknown',
    hasEscalator: 'unknown',
    hasSteps: isRail && partial.wheelchairAccessible !== true,
    // Demo data is never independently verified.
    verified: false,
    ...partial,
  }
}

function buildArchetypes(distanceKm: number): ArchetypeSpec[] {
  const archetypes: ArchetypeSpec[] = []

  // FASTEST — lean on Metro/rail where it exists, minimal dwell.
  archetypes.push({
    tag: 'fastest',
    speedMultiplier: 1.12,
    bend: 1.4,
    legs: [
      { mode: 'walk', fraction: 0.06, environment: 'outdoor', accessibility: {} },
      {
        mode: distanceKm > 9 ? 'suburban-rail' : 'metro',
        fraction: 0.62,
        environment: 'transit',
        accessibility: { hasElevator: true, wheelchairAccessible: true },
      },
      {
        mode: 'metro',
        fraction: 0.24,
        environment: 'transit',
        accessibility: { hasElevator: true, wheelchairAccessible: true },
      },
      { mode: 'walk', fraction: 0.08, environment: 'outdoor', accessibility: {} },
    ],
  })

  // CHEAPEST — bus-heavy, longer but low fare.
  archetypes.push({
    tag: 'cheapest',
    speedMultiplier: 0.82,
    bend: -2.1,
    legs: [
      { mode: 'walk', fraction: 0.05, environment: 'outdoor', accessibility: {} },
      { mode: 'bus', fraction: 0.9, environment: 'outdoor', accessibility: { hasSteps: true, wheelchairAccessible: false } },
      { mode: 'walk', fraction: 0.05, environment: 'outdoor', accessibility: {} },
    ],
  })

  // LEAST WALKING — swap the last-mile walk for an auto.
  archetypes.push({
    tag: 'least-walking',
    speedMultiplier: 1.0,
    bend: 0.6,
    legs: [
      { mode: 'auto', fraction: 0.14, environment: 'outdoor', accessibility: { wheelchairAccessible: false } },
      {
        mode: distanceKm > 9 ? 'suburban-rail' : 'metro',
        fraction: 0.72,
        environment: 'transit',
        accessibility: { hasElevator: true },
      },
      { mode: 'auto', fraction: 0.14, environment: 'outdoor', accessibility: { wheelchairAccessible: false } },
    ],
  })

  // FEWEST TRANSFERS — single dominant mode, direct.
  archetypes.push({
    tag: 'fewest-transfers',
    speedMultiplier: 0.94,
    bend: -0.8,
    legs: [
      { mode: 'walk', fraction: 0.07, environment: 'outdoor', accessibility: {} },
      { mode: 'bus', fraction: 0.86, environment: 'outdoor', accessibility: { hasSteps: true } },
      { mode: 'walk', fraction: 0.07, environment: 'outdoor', accessibility: {} },
    ],
  })

  // ACCESSIBLE — verified step-free chain, elevator-equipped stations only.
  archetypes.push({
    tag: 'accessible',
    speedMultiplier: 0.78,
    bend: 2.2,
    maxWalkKm: 0.3,
    legs: [
      { mode: 'walk', fraction: 0.05, environment: 'outdoor', accessibility: {} },
      {
        mode: distanceKm > 9 ? 'suburban-rail' : 'metro',
        fraction: 0.9,
        environment: 'transit',
        accessibility: {
          wheelchairAccessible: true,
          hasElevator: true,
          hasEscalator: true,
          hasSteps: false,
          note: 'Step-free per demo data',
        },
      },
      { mode: 'walk', fraction: 0.05, environment: 'outdoor', accessibility: {} },
    ],
  })

  return archetypes
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

const AUTO_HAIL_WAIT_MIN = 6

const MAX_LEG_KM: Partial<Record<TransportMode, number>> = { walk: 0.65, auto: 2 }

const isAccessLeg = (mode: TransportMode) => mode === 'walk' || mode === 'auto'

function stopWord(mode: TransportMode): string {
  if (mode === 'metro') return 'Metro station'
  if (mode === 'suburban-rail') return 'railway station'
  if (mode === 'bus') return 'bus stop'
  return 'stop'
}

/** Names the point where leg `index - 1` ends and leg `index` begins. */
function boundaryName(legs: LegSpec[], index: number, origin: Location, destination: Location): string {
  const prev = legs[index - 1]
  const next = legs[index]
  if (isAccessLeg(prev.mode) && !isAccessLeg(next.mode)) return `${origin.name} ${stopWord(next.mode)}`
  if (!isAccessLeg(prev.mode) && isAccessLeg(next.mode)) return `${destination.name} ${stopWord(prev.mode)}`
  return 'Interchange'
}

function distributeLegDistances(archetype: ArchetypeSpec, distanceKm: number): number[] {
  let surplusKm = 0
  const km = archetype.legs.map((leg) => {
    const raw = distanceKm * leg.fraction
    const cap = leg.mode === 'walk' && archetype.maxWalkKm !== undefined ? archetype.maxWalkKm : MAX_LEG_KM[leg.mode]
    if (cap !== undefined && raw > cap) {
      surplusKm += raw - cap
      return cap
    }
    return raw
  })
  const mainIdx = archetype.legs.reduce(
    (best, leg, i) => (leg.fraction > archetype.legs[best].fraction ? i : best),
    0,
  )
  km[mainIdx] += surplusKm
  return km.map((k) => k / distanceKm)
}

function buildJourney(
  origin: Location,
  destination: Location,
  archetype: ArchetypeSpec,
  departAt: Date,
): Journey {
  const distanceKm = haversineKm(origin, destination)
  const fullPolyline = curvedPolyline(origin, destination, archetype.bend, 40)
  const flavour = flavourFor(origin, destination)

  // Walking and auto legs are capped in real distance so long trips don't
  // produce implausible multi-km walks; the surplus goes to the main transit leg.
  const legShares = distributeLegDistances(archetype, distanceKm)

  const segments: JourneySegment[] = []
  let cursorFrac = 0
  let totalFare = 0
  let totalWalkMeters = 0
  let elapsedMin = 0
  let totalTrafficDelay = 0
  let peakCrowd = 0
  const weekend = isWeekend(departAt)
  let transferCount = -1 // first transit leg doesn't count as a transfer

  archetype.legs.forEach((leg, i) => {
    const startFrac = cursorFrac
    const endFrac = Math.min(1, cursorFrac + legShares[i])
    cursorFrac = endFrac

    const startIdx = Math.round(startFrac * (fullPolyline.length - 1))
    const endIdx = Math.max(startIdx + 1, Math.round(endFrac * (fullPolyline.length - 1)))
    const legPolyline = fullPolyline.slice(startIdx, endIdx + 1)
    if (legPolyline.length < 2) legPolyline.push(fullPolyline[fullPolyline.length - 1])

    const legDistanceKm = distanceKm * legShares[i]
    const speed = MODE_SPEED_KMH[leg.mode] * (leg.mode === 'walk' ? 1 : archetype.speedMultiplier)
    const waitMin = leg.mode === 'auto' ? AUTO_HAIL_WAIT_MIN : 0
    const legHour = hourOf(new Date(departAt.getTime() + elapsedMin * 60000))
    const isRoad = leg.mode === 'bus' || leg.mode === 'auto'
    const freeFlowMin = Math.max(1, Math.round((legDistanceKm / speed) * 60) + waitMin)
    const durationMin = isRoad
      ? Math.max(1, Math.round((legDistanceKm / speed) * 60 * roadSlowdown(legHour, weekend)) + waitMin)
      : freeFlowMin
    const trafficDelayMin = isRoad ? Math.max(0, durationMin - freeFlowMin) : 0
    const crowdPercent = leg.mode === 'walk' || leg.mode === 'auto' ? undefined : crowdLevel(leg.mode, legHour, weekend)
    elapsedMin += durationMin
    totalTrafficDelay += trafficDelayMin
    if (crowdPercent !== undefined) peakCrowd = Math.max(peakCrowd, crowdPercent)

    const fare =
      leg.mode === 'walk'
        ? 0
        : Math.round(MODE_BASE_FARE[leg.mode] + legDistanceKm * MODE_FARE_PER_KM[leg.mode])
    totalFare += fare
    if (leg.mode === 'walk') totalWalkMeters += legDistanceKm * 1000
    if (leg.mode !== 'walk') transferCount += 1

    let lineName = leg.lineName
    if (!lineName) {
      if (leg.mode === 'metro') lineName = flavour.metro ?? defaultLineName('metro', i)
      else if (leg.mode === 'suburban-rail') lineName = flavour.rail ?? defaultLineName('suburban-rail', i)
      else if (leg.mode === 'bus') lineName = flavour.bus ?? defaultLineName('bus', i)
    }

    const fromLabel = i === 0 ? origin.name : boundaryName(archetype.legs, i, origin, destination)
    const toLabel = i === archetype.legs.length - 1 ? destination.name : boundaryName(archetype.legs, i + 1, origin, destination)

    segments.push({
      id: nextId('seg'),
      mode: leg.mode,
      from: fromLabel,
      to: toLabel,
      durationMin,
      distanceMeters: Math.round(legDistanceKm * 1000),
      fareRupees: fare,
      lineName,
      lineColor:
        leg.mode === 'metro' ? '#0f6f61' : leg.mode === 'suburban-rail' ? '#2f6fa8' : leg.mode === 'bus' ? '#c07a1e' : undefined,
      platform: leg.mode === 'metro' || leg.mode === 'suburban-rail' ? `Platform ${1 + (i % 4)}` : undefined,
      environment: leg.environment,
      accessibility: accessibilityFor(leg.mode, leg.accessibility),
      polyline: legPolyline,
      isTransfer: i > 0 && leg.mode !== 'walk' && archetype.legs[i - 1]?.mode !== 'walk',
      trafficDelayMin: isRoad ? trafficDelayMin : undefined,
      crowdPercent,
    })

  })

  const durationMin = segments.reduce((s, seg) => s + seg.durationMin, 0)
  const arriveAt = new Date(departAt.getTime() + durationMin * 60000)
  const modes = Array.from(new Set(segments.map((s) => s.mode)))
  // Only counts as accessible when every transit leg is explicitly step-free in the data.
  const accessible = segments.every((s) => s.mode === 'walk' || s.accessibility.wheelchairAccessible === true)

  return {
    id: nextId('journey'),
    origin,
    destination,
    departAt: departAt.toISOString(),
    arriveAt: arriveAt.toISOString(),
    durationMin,
    fareRupees: Math.max(5, totalFare),
    walkingMeters: Math.round(totalWalkMeters),
    transfers: Math.max(0, transferCount),
    modes,
    segments,
    accessible,
    tag: archetype.tag,
    peakCrowdPercent: peakCrowd > 0 ? peakCrowd : undefined,
    trafficDelayMin: totalTrafficDelay > 0 ? totalTrafficDelay : undefined,
  }
}

/**
 * Deterministically generates a spread of realistic route alternatives for
 * any origin/destination pair in the Chennai demo dataset. This function is
 * pure and depends only on its inputs, matching the seams that a real
 * OpenTripPlanner-backed implementation would need to fill.
 */
const TAG_CRITERIA: { tag: OptimizeFor; better: (a: Journey, b: Journey) => number; eligible?: (j: Journey) => boolean }[] = [
  { tag: 'fastest', better: (a, b) => a.durationMin - b.durationMin },
  { tag: 'accessible', better: (a, b) => a.durationMin - b.durationMin, eligible: (j) => j.accessible },
  { tag: 'cheapest', better: (a, b) => a.fareRupees - b.fareRupees },
  { tag: 'least-walking', better: (a, b) => a.walkingMeters - b.walkingMeters },
  { tag: 'fewest-transfers', better: (a, b) => a.transfers - b.transfers },
]

/** Labels each journey by what it is actually best at, so a "Fastest" card is genuinely the fastest. */
function assignTags(journeys: Journey[]): Journey[] {
  const tags = new Map<string, Journey['tag']>()
  for (const { tag, better, eligible } of TAG_CRITERIA) {
    const winner = journeys
      .filter((j) => !tags.has(j.id) && (eligible?.(j) ?? true))
      .sort(better)[0]
    if (winner) tags.set(winner.id, tag)
  }
  return journeys.map((j) => ({ ...j, tag: tags.get(j.id) ?? 'balanced' }))
}

export function generateDemoJourneys(origin: Location, destination: Location, departAt: Date): Journey[] {
  const distanceKm = haversineKm(origin, destination)
  const archetypes = buildArchetypes(distanceKm)
  return assignTags(archetypes.map((archetype) => buildJourney(origin, destination, archetype, departAt)))
}
