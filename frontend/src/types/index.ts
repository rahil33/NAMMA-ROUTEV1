// ---------------------------------------------------------------------------
// NammaRoute domain models
// These types are the contract between the UI and the routing/places/history
// services. Swapping mockRoutingService for a real OpenTripPlanner-backed
// service (or localStorage for Supabase) should never require changing a
// type defined here.
// ---------------------------------------------------------------------------

export type TransportMode =
  | 'walk'
  | 'bus'
  | 'metro'
  | 'suburban-rail'
  | 'auto'

export interface Location {
  id: string
  name: string
  area: string
  lat: number
  lng: number
  /** Alternate spellings / Tamil names, used by search and voice commands. */
  aliases?: string[]
  /** Station/stop type when known. Otherwise it is inferred from the name (see utils/stations.ts). */
  kind?: 'metro' | 'rail' | 'bus' | 'place'
}

export type PlaceKind = 'home' | 'college' | 'work' | 'custom'

export interface SavedPlace {
  id: string
  kind: PlaceKind
  label: string
  location: Location
  createdAt: string
}

export type OptimizeFor =
  | 'fastest'
  | 'cheapest'
  | 'least-walking'
  | 'fewest-transfers'
  | 'accessible'
  | 'comfortable'
  | 'balanced'

export interface AccessibilityInfo {
  wheelchairAccessible: boolean | 'unknown'
  hasElevator: boolean | 'unknown'
  hasEscalator: boolean | 'unknown'
  hasSteps: boolean
  stepCount?: number
  slopeWarning?: boolean
  verified: boolean
  note?: string
}

export interface AccessibilityPreferences {
  wheelchair: boolean
  limitedWalking: boolean
  avoidStairs: boolean
  avoidSteepSlopes: boolean
  minimizeWalking: boolean
  minimizeTransfers: boolean
  largeText: boolean
  highContrast: boolean
  reducedMotion: boolean
}

export type Language = 'en' | 'ta' | 'te'

export interface RoutePreference {
  optimizeFor: OptimizeFor
  /** Combined priorities (blended ranking). Falls back to [optimizeFor] when absent. */
  priorities?: OptimizeFor[]
  /** Optional fare ceiling in rupees; cheaper routes are ranked first when set. */
  budgetRupees?: number
  rainMode: boolean
  accessibility: AccessibilityPreferences
}

export type IndoorOutdoor = 'outdoor' | 'indoor' | 'transit'

export interface JourneySegment {
  id: string
  mode: TransportMode
  from: string
  to: string
  durationMin: number
  distanceMeters?: number
  fareRupees?: number
  lineName?: string
  lineColor?: string
  platform?: string
  environment: IndoorOutdoor
  accessibility: AccessibilityInfo
  polyline: [number, number][] // [lng, lat] pairs for map rendering
  isTransfer?: boolean
  /** Modelled extra minutes from road congestion (demo estimate, not live). */
  trafficDelayMin?: number
  /** Modelled crowding 0-100 for transit legs (demo estimate, not live). */
  crowdPercent?: number
}

export interface ServiceAlert {
  id: string
  severity: 'info' | 'minor' | 'major'
  message: string
  affectedSegmentId?: string
  isDemo: true
}

export interface Journey {
  id: string
  origin: Location
  destination: Location
  departAt: string
  arriveAt: string
  durationMin: number
  fareRupees: number
  walkingMeters: number
  transfers: number
  modes: TransportMode[]
  segments: JourneySegment[]
  accessible: boolean
  tag: OptimizeFor | 'balanced'
  rainOptimized?: boolean
  /** Highest modelled crowding across transit legs, 0-100. */
  peakCrowdPercent?: number
  /** Total modelled minutes lost to road traffic. */
  trafficDelayMin?: number
  /** 'live' = from a configured planner (OpenTripPlanner). Absent/'demo' = generated demo data. */
  source?: 'live' | 'demo'
  /** false when the planner did not return a fare, so the UI shows "fare n/a" instead of ₹0. */
  fareKnown?: boolean
  /** Road-comfort assessment from OSM + community reports. Present only when it was requested. */
  comfort?: ComfortInfo
  /** Why demo data is showing although a live planner is configured (e.g. it was unreachable). */
  dataNotice?: string
}

export interface ComfortInfo {
  /** 0-100, higher is smoother. Meaningful only as far as `coverage` says the data reaches. */
  score: number
  /** 0-1: share of the road distance that had surface/smoothness data. Low means "limited data". */
  coverage: number
  limited: boolean
  speedBumps: number
  roughMeters: number
  communityReports: number
  /** Human-readable data sources that were actually queried. */
  sources: string[]
  notes: string[]
}

export interface SavedJourneyRecord {
  id: string
  journey: Journey
  searchedAt: string
  status: 'searched' | 'completed'
}

export type MapStyleKind = 'standard' | 'satellite' | 'hybrid'

export interface UserPreferences {
  optimizeFor: OptimizeFor
  priorities: OptimizeFor[]
  haptics: boolean
  language: Language
  budgetRupees?: number
  narration: boolean
  rainMode: boolean
  accessibility: AccessibilityPreferences
  mapStyle: MapStyleKind
  notifications: {
    serviceAlerts: boolean
  }
  privacy: {
    storeHistory: boolean
  }
}

export interface JourneySearchParams {
  origin: Location
  destination: Location
  departAt: string
  /** When set, journeys are shifted so they arrive at this ISO time. */
  arriveBy?: string
  preference: RoutePreference
}

// Live journey progress state, separate from the static Journey plan.
export interface LiveJourneyState {
  journey: Journey
  currentSegmentIndex: number
  status: 'not-started' | 'in-progress' | 'alert' | 'completed'
  activeAlert?: ServiceAlert
  notice?: string
}
