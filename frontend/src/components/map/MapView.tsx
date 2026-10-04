import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { MODE_COLOR, formatDistance, formatDuration } from '@/utils/formatting'
import type { GeoJSONSource, LayerSpecification, MapLayerMouseEvent } from 'maplibre-gl'
import type { Journey, MapStyleKind, TransportMode } from '@/types'
import { hasMapProvider, styleFor } from '@/services/mapConfigService'
import { POI_CATEGORIES, type Poi } from '@/services/poiService'
import { pointAlong } from '@/utils/routePath'
import { pathKey, useRoadPaths } from '@/services/roadRouteService'

interface GeoJsonFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'LineString'; coordinates: [number, number][] } | { type: 'Point'; coordinates: [number, number] }
}

interface MapViewProps {
  journeys: Journey[]
  selectedJourneyId: string | null
  highlightSegmentId?: string | null
  mapStyle: MapStyleKind
  fitToken?: number // bump to force a re-fit
  className?: string
  onSelectJourney?: (journeyId: string) => void
  pois?: Poi[]
  /** Live position marker (pulsing blue dot). */
  youAre?: [number, number] | null
  /** Keep the camera on the live position, zoomed in like turn-by-turn navigation. */
  follow?: boolean
  /** Draw a marker at every turn of the selected journey's walking and road legs. */
  showTurns?: boolean
}

// Bundle the worker (with its shared chunk) so it resolves under any base path.
setWorkerUrl(workerUrl)

const ROUTE_SOURCE = 'nammaroute-routes'
const STOPS_SOURCE = 'nammaroute-stops'
const MODE_EMOJI: Record<TransportMode, string> = { walk: '🚶', bus: '🚌', metro: '🚇', 'suburban-rail': '🚆', auto: '🛺' }
const DEST_PIN =
  '<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24 14 38 14 38s14-14 14-24.1C28 6.2 21.7 0 14 0z" fill="#101827"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>'

function primaryMode(journey: Journey): TransportMode {
  const totals = new Map<TransportMode, number>()
  for (const s of journey.segments) if (s.mode !== 'walk') totals.set(s.mode, (totals.get(s.mode) ?? 0) + s.durationMin)
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'walk'
}

const totalMeters = (journey: Journey) => journey.segments.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0)

function makeElement(className: string, html?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  if (html) el.innerHTML = html // static, trusted markup only
  return el
}

export function MapView({
  journeys,
  selectedJourneyId,
  highlightSegmentId,
  mapStyle,
  fitToken,
  className = '',
  onSelectJourney,
  pois = [],
  youAre = null,
  follow = false,
  showTurns = false,
}: MapViewProps) {
  const roadPaths = useRoadPaths(journeys)
  const turnMarkers = useRef<Marker[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [loaded, setLoaded] = useState(false)
  const usingFallback = !hasMapProvider()
  const selectRef = useRef(onSelectJourney)
  const domMarkers = useRef<Marker[]>([])
  const poiMarkers = useRef<Marker[]>([])
  const youMarker = useRef<Marker | null>(null)

  useEffect(() => {
    selectRef.current = onSelectJourney
  }, [onSelectJourney])

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleFor(mapStyle),
      center: [80.2206, 13.02],
      zoom: 10.4,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    map.on('load', () => setLoaded(true))
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle style switching without tearing down the whole map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    setLoaded(false)
    map.setStyle(styleFor(mapStyle))
    map.once('styledata', () => setLoaded(true))
  }, [mapStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render routes and stops whenever data or selection changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const selected = journeys.find((j) => j.id === selectedJourneyId)
    const routeFeatures: GeoJsonFeature[] = journeys.map((journey) => ({
      type: 'Feature',
      properties: { journeyId: journey.id, selected: journey.id === selectedJourneyId },
      geometry: { type: 'LineString', coordinates: journey.segments.flatMap((s) => roadPaths[pathKey(journey.id, s.id)]?.coords ?? s.polyline) },
    }))
    const segmentFeatures: GeoJsonFeature[] = (selected?.segments ?? []).map((seg) => ({
      type: 'Feature',
      properties: { segmentId: seg.id, mode: seg.mode, highlighted: seg.id === highlightSegmentId, color: MODE_COLOR[seg.mode] },
      geometry: { type: 'LineString', coordinates: roadPaths[pathKey(selected?.id ?? '', seg.id)]?.coords ?? seg.polyline },
    }))
    const stopFeatures: GeoJsonFeature[] = (selected?.segments ?? [])
      .filter((s) => s.mode !== 'walk')
      .map((s) => ({
        type: 'Feature',
        properties: { label: s.lineName ?? s.mode, isTransfer: Boolean(s.isTransfer) },
        geometry: { type: 'Point', coordinates: s.polyline[0] },
      }))

    upsertGeoJsonSource(map, ROUTE_SOURCE, routeFeatures)
    upsertGeoJsonSource(map, `${ROUTE_SOURCE}-segments`, segmentFeatures)
    upsertGeoJsonSource(map, STOPS_SOURCE, stopFeatures)

    const round = { 'line-cap': 'round', 'line-join': 'round' } as const
    // Alternatives: light-blue lines with a white casing, clickable like Google Maps.
    ensureLayer(map, `${ROUTE_SOURCE}-alt-casing`, {
      id: `${ROUTE_SOURCE}-alt-casing`,
      type: 'line',
      source: ROUTE_SOURCE,
      filter: ['!=', ['get', 'selected'], true],
      paint: { 'line-color': '#ffffff', 'line-width': 9 },
      layout: round,
    })
    ensureLayer(map, `${ROUTE_SOURCE}-alt-line`, {
      id: `${ROUTE_SOURCE}-alt-line`,
      type: 'line',
      source: ROUTE_SOURCE,
      filter: ['!=', ['get', 'selected'], true],
      paint: { 'line-color': '#9AA9B6', 'line-width': 5 },
      layout: round,
    })
    const seg = `${ROUTE_SOURCE}-segments`
    // Active segment glows turquoise underneath everything else.
    ensureLayer(map, `${seg}-glow`, {
      id: `${seg}-glow`, type: 'line', source: seg, filter: ['==', ['get', 'highlighted'], true],
      paint: { 'line-color': '#20D6C7', 'line-width': 18, 'line-opacity': 0.4, 'line-blur': 6 }, layout: round,
    })
    ensureLayer(map, `${seg}-casing`, {
      id: `${seg}-casing`, type: 'line', source: seg, filter: ['!=', ['get', 'mode'], 'walk'],
      paint: { 'line-color': '#ffffff', 'line-width': ['case', ['get', 'highlighted'], 11, 9] }, layout: round,
    })
    ensureLayer(map, `${seg}-line`, {
      id: `${seg}-line`, type: 'line', source: seg, filter: ['!=', ['get', 'mode'], 'walk'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'highlighted'], 7, 5],
        'line-opacity': ['case', ['get', 'highlighted'], 1, 0.92],
      },
      layout: round,
    })
    // Walking is drawn as a dotted trail so it reads differently from vehicles.
    ensureLayer(map, `${seg}-walk`, {
      id: `${seg}-walk`, type: 'line', source: seg, filter: ['==', ['get', 'mode'], 'walk'],
      paint: { 'line-color': '#101827', 'line-width': ['case', ['get', 'highlighted'], 6, 4.5], 'line-dasharray': [0.1, 2] },
      layout: round,
    })
    ensureLayer(map, `${STOPS_SOURCE}-circle`, {
      id: `${STOPS_SOURCE}-circle`,
      type: 'circle',
      source: STOPS_SOURCE,
      paint: {
        'circle-radius': ['case', ['get', 'isTransfer'], 7, 5.5],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#101827',
        'circle-stroke-width': 2,
      },
    })

  }, [journeys, selectedJourneyId, highlightSegmentId, loaded, roadPaths])

  // Click an alternative line to select it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const layer = `${ROUTE_SOURCE}-alt-line`
    const onClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.journeyId
      if (typeof id === 'string') selectRef.current?.(id)
    }
    const pointer = () => (map.getCanvas().style.cursor = 'pointer')
    const reset = () => (map.getCanvas().style.cursor = '')
    if (!map.getLayer(layer)) return
    map.on('click', layer, onClick)
    map.on('mouseenter', layer, pointer)
    map.on('mouseleave', layer, reset)
    return () => {
      map.off('click', layer, onClick)
      map.off('mouseenter', layer, pointer)
      map.off('mouseleave', layer, reset)
    }
  }, [loaded, journeys, selectedJourneyId])

  // Duration/distance bubbles on each route, plus origin and destination pins.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    domMarkers.current.forEach((m) => m.remove())
    domMarkers.current = []
    const selected = journeys.find((j) => j.id === selectedJourneyId)

    journeys.forEach((journey, i) => {
      const spot = pointAlong(
        journey.segments.flatMap((s) => roadPaths[pathKey(journey.id, s.id)]?.coords ?? s.polyline),
        0.5 + ((i % 3) - 1) * 0.12,
      )
      if (!spot) return
      const isSelected = journey.id === selectedJourneyId
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `route-bubble${isSelected ? ' selected' : ''}`
      el.textContent = `${MODE_EMOJI[primaryMode(journey)]} ${formatDuration(journey.durationMin)} · ${formatDistance(totalMeters(journey))}`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        selectRef.current?.(journey.id)
      })
      domMarkers.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat(spot.point).addTo(map))
    })

    if (selected) {
      domMarkers.current.push(
        new Marker({ element: makeElement('pin-origin'), anchor: 'center' }).setLngLat([selected.origin.lng, selected.origin.lat]).addTo(map),
        new Marker({ element: makeElement('pin-dest', DEST_PIN), anchor: 'bottom' })
          .setLngLat([selected.destination.lng, selected.destination.lat])
          .addTo(map),
      )
    }
  }, [journeys, selectedJourneyId, loaded, roadPaths])

  // Turn-by-turn markers: one arrow per turn, rotated to the turn direction.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    turnMarkers.current.forEach((m) => m.remove())
    turnMarkers.current = []
    const selected = journeys.find((j) => j.id === selectedJourneyId)
    if (!showTurns || !selected) return
    for (const seg of selected.segments) {
      const path = roadPaths[pathKey(selected.id, seg.id)]
      if (!path) continue
      for (const step of path.steps.filter((s) => s.isTurn)) {
        const el = makeElement(
          'turn-marker',
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${step.rotation}deg)"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
        )
        const label = `${step.text} · ${formatDistance(step.distance)}`
        turnMarkers.current.push(new Marker({ element: el }).setLngLat(step.location).setPopup(new Popup({ offset: 14 }).setText(label)).addTo(map))
      }
    }
  }, [journeys, selectedJourneyId, loaded, roadPaths, showTurns])

  // "Search along the route" places.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    poiMarkers.current.forEach((m) => m.remove())
    poiMarkers.current = pois.map((poi) => {
      const emoji = POI_CATEGORIES.find((c) => c.id === poi.category)?.emoji ?? '📍'
      const el = makeElement('poi-marker')
      el.textContent = emoji
      const label = poi.offRouteMeters > 0 ? `${poi.name} · ${poi.offRouteMeters} m` : poi.name
      return new Marker({ element: el }).setLngLat([poi.lng, poi.lat]).setPopup(new Popup({ offset: 16 }).setText(label)).addTo(map)
    })
  }, [pois, loaded])

  // Live position dot.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    if (!youAre) {
      youMarker.current?.remove()
      youMarker.current = null
      return
    }
    if (youMarker.current) youMarker.current.setLngLat(youAre)
    else youMarker.current = new Marker({ element: makeElement('you-dot') }).setLngLat(youAre).addTo(map)
    if (follow) map.easeTo({ center: youAre, zoom: Math.max(map.getZoom(), 14.5), duration: 400 })
  }, [youAre, follow, loaded])

  // Fit to the selected journey's bounds.
  useEffect(() => {
    const map = mapRef.current
    const selected = journeys.find((j) => j.id === selectedJourneyId)
    if (!map || !loaded || !selected) return
    const coords = selected.segments.flatMap((s) => roadPaths[pathKey(selected.id, s.id)]?.coords ?? s.polyline)
    if (coords.length === 0) return
    const bounds = coords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
    )
    map.fitBounds(bounds, { padding: 72, duration: 600, maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJourneyId, loaded, fitToken])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" role="img" aria-label="Journey route map" />
      {usingFallback && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[#101827]/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          Using free OSM map style — add VITE_MAPTILER_KEY for full styles
        </div>
      )}
    </div>
  )
}

function upsertGeoJsonSource(map: MapLibreMap, id: string, features: GeoJsonFeature[]) {
  const data: { type: 'FeatureCollection'; features: GeoJsonFeature[] } = { type: 'FeatureCollection', features }
  const existing = map.getSource(id) as GeoJSONSource | undefined
  if (existing) existing.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

function ensureLayer(map: MapLibreMap, id: string, spec: LayerSpecification) {
  if (!map.getLayer(id)) map.addLayer(spec)
}
