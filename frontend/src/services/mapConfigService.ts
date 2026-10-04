import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleKind } from '@/types'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

export function hasMapProvider(): boolean {
  return Boolean(MAPTILER_KEY)
}

// Keyless fallback so the map still renders when VITE_MAPTILER_KEY is not
// configured. Replaced entirely by MapTiler styles once the key is set.
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function fallbackStyle(style: MapStyleKind): StyleSpecification {
  const osm = { type: 'raster' as const, tiles: [OSM_TILES], tileSize: 256, attribution: '© OpenStreetMap contributors' }
  const imagery = { type: 'raster' as const, tiles: [IMAGERY_TILES], tileSize: 256, attribution: 'Imagery © Esri' }
  if (style === 'standard') {
    return { version: 8, sources: { osm }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] }
  }
  if (style === 'satellite') {
    return { version: 8, sources: { imagery }, layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }] }
  }
  return {
    version: 8,
    sources: { imagery, osm },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery' },
      { id: 'osm-overlay', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.4 } },
    ],
  }
}

export function styleFor(style: MapStyleKind): string | StyleSpecification {
  if (!MAPTILER_KEY) return fallbackStyle(style)
  const id = style === 'standard' ? 'streets-v2' : style
  return `https://api.maptiler.com/maps/${id}/style.json?key=${MAPTILER_KEY}`
}
