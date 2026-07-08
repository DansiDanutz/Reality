/** OpenStreetMap neighborhood data for Street Mode — real buildings, roads, parks, trees */

export interface OsmWay {
  type: string
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
  lat?: number
  lon?: number
}

export interface Neighborhood {
  buildings: OsmWay[]
  roads: OsmWay[]
  /** Park / grass / garden polygons — the green the city breathes with */
  greens: OsmWay[]
  /** Individually mapped trees (node natural=tree) */
  trees: { lat: number; lon: number }[]
}

export const STREET_RADIUS_M = 320

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/** Per-mirror fetch timeout — Street Mode should fail over quickly after Walk. */
const ENDPOINT_TIMEOUT_MS = 6_000

const GREEN_TAGS = /^(park|garden|grass|meadow|village_green|recreation_ground|playground|pitch)$/

/** Cached neighborhoods stay fresh for an hour — OSM data doesn't move faster. */
const NEIGHBORHOOD_TTL_MS = 60 * 60 * 1000

export async function fetchNeighborhood(lat: number, lng: number): Promise<Neighborhood> {
  const key = neighborhoodCacheKey(lat, lng)
  const cached = neighborhoodCache.get(key)
  if (cached && Date.now() - cached.at < NEIGHBORHOOD_TTL_MS) return cached.promise
  const promise = fetchNeighborhoodUncached(lat, lng)
  neighborhoodCache.set(key, { promise, at: Date.now() })
  try {
    return await promise
  } catch (error) {
    neighborhoodCache.delete(key)
    throw error
  }
}

export function preloadNeighborhood(lat: number, lng: number) {
  void fetchNeighborhood(lat, lng).catch(() => {
    // Street Mode keeps the real error path; preloading just warms the cache.
  })
}

const neighborhoodCache = new Map<string, { promise: Promise<Neighborhood>; at: number }>()

export function clearNeighborhoodCacheForTest() {
  if (!import.meta.env.DEV) return
  neighborhoodCache.clear()
}

function neighborhoodCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)},${STREET_RADIUS_M}`
}

async function fetchNeighborhoodUncached(lat: number, lng: number): Promise<Neighborhood> {
  const around = `(around:${STREET_RADIUS_M},${lat},${lng})`
  const query = `[out:json][timeout:25];(way["building"]${around};way["highway"]${around};way["leisure"~"park|garden|playground|pitch"]${around};way["landuse"~"grass|meadow|village_green|recreation_ground"]${around};node["natural"="tree"]${around};);out geom;`
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(ENDPOINT_TIMEOUT_MS),
      })
      if (!res.ok) {
        lastError = new Error(`Overpass ${endpoint} responded ${res.status}`)
        continue
      }
      const data = (await res.json()) as { elements?: OsmWay[] }
      const ways = data.elements ?? []
      return {
        buildings: ways.filter((w) => w.tags?.building && (w.geometry?.length ?? 0) >= 3),
        roads: ways.filter((w) => w.tags?.highway && (w.geometry?.length ?? 0) >= 2),
        greens: ways.filter(
          (w) =>
            (GREEN_TAGS.test(w.tags?.leisure ?? '') || GREEN_TAGS.test(w.tags?.landuse ?? '')) &&
            (w.geometry?.length ?? 0) >= 3,
        ),
        trees: ways
          .filter((w) => w.type === 'node' && w.tags?.natural === 'tree' && w.lat !== undefined && w.lon !== undefined)
          .map((w) => ({ lat: w.lat!, lon: w.lon! })),
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

/** How wide a road really is, by its OSM class (meters, both lanes) */
export function roadWidth(highway: string | undefined): number {
  switch (highway) {
    case 'motorway':
    case 'trunk':
      return 14
    case 'primary':
      return 11
    case 'secondary':
      return 9
    case 'tertiary':
      return 8
    case 'footway':
    case 'path':
    case 'steps':
    case 'cycleway':
    case 'pedestrian':
      return 2.5
    case 'service':
      return 4
    default:
      return 6.5
  }
}

/** Car roads get sidewalks and lane markings; paths don't */
export const isCarRoad = (highway: string | undefined): boolean =>
  !['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'track'].includes(highway ?? '')

/** Equirectangular projection to local meters around a center (x east, z south) */
export function toLocalMeters(lat: number, lon: number, centerLat: number, centerLng: number): { x: number; z: number } {
  const x = (lon - centerLng) * 111_320 * Math.cos((centerLat * Math.PI) / 180)
  const z = -(lat - centerLat) * 111_320
  return { x, z }
}
