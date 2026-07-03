/** OpenStreetMap neighborhood data for Street Mode — real buildings, real roads */

export interface OsmWay {
  type: string
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
}

export interface Neighborhood {
  buildings: OsmWay[]
  roads: OsmWay[]
}

export const STREET_RADIUS_M = 320

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export async function fetchNeighborhood(lat: number, lng: number): Promise<Neighborhood> {
  const query = `[out:json][timeout:25];(way["building"](around:${STREET_RADIUS_M},${lat},${lng});way["highway"](around:${STREET_RADIUS_M},${lat},${lng}););out geom;`
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) continue
      const data = (await res.json()) as { elements?: OsmWay[] }
      const ways = data.elements ?? []
      return {
        buildings: ways.filter((w) => w.tags?.building && (w.geometry?.length ?? 0) >= 3),
        roads: ways.filter((w) => w.tags?.highway && (w.geometry?.length ?? 0) >= 2),
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Overpass unavailable')
}

/** Building height in meters from OSM tags; sensible urban default otherwise */
export function buildingHeight(tags: Record<string, string> | undefined, seed: number): number {
  const explicit = parseFloat(tags?.height ?? tags?.['building:height'] ?? '')
  if (Number.isFinite(explicit) && explicit > 2) return Math.min(explicit, 160)
  const levels = parseFloat(tags?.['building:levels'] ?? '')
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3.2, 160)
  const kind = tags?.building
  if (kind === 'house' || kind === 'detached' || kind === 'garage' || kind === 'shed') return 5 + (seed % 3)
  return 8 + (seed % 10)
}

/** Equirectangular projection to local meters around a center (x east, z south) */
export function toLocalMeters(lat: number, lon: number, centerLat: number, centerLng: number): { x: number; z: number } {
  const x = (lon - centerLng) * 111_320 * Math.cos((centerLat * Math.PI) / 180)
  const z = -(lat - centerLat) * 111_320
  return { x, z }
}
