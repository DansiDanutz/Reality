import {
  type ResourceKind,
  type ResourceNode,
  createResourceNode,
  ensureResourceCoverage,
} from './resources'

interface OverpassElement {
  type: string
  id?: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface ServicePoi {
  id: string
  kind: 'restaurant' | 'bank' | 'health' | 'school' | 'insurance' | 'grocery' | 'workers-hall'
  label: string
  lat: number
  lng: number
  source: 'osm' | 'fallback'
}

export interface MapDiscovery {
  resourceNodes: ResourceNode[]
  servicePois: ServicePoi[]
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const ENDPOINT_TIMEOUT_MS = 6_000
// The proxy retries three mirrors server-side at 8s each — give it headroom.
const PROXY_TIMEOUT_MS = 20_000
const DISCOVERY_RADIUS_M = 2_500

const discoveryCache = new Map<string, Promise<MapDiscovery>>()

export async function fetchMapDiscovery(lat: number, lng: number): Promise<MapDiscovery> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = discoveryCache.get(key)
  if (cached) return cached
  const promise = fetchMapDiscoveryUncached(lat, lng)
  discoveryCache.set(key, promise)
  try {
    return await promise
  } catch (error) {
    discoveryCache.delete(key)
    throw error
  }
}

export function preloadMapDiscovery(lat: number, lng: number) {
  void fetchMapDiscovery(lat, lng).catch(() => {
    // The app keeps fallback nodes; preload failure should stay silent.
  })
}

export function clearMapDiscoveryCacheForTest() {
  if (!import.meta.env.DEV) return
  discoveryCache.clear()
}

async function fetchMapDiscoveryUncached(lat: number, lng: number): Promise<MapDiscovery> {
  // The same-origin proxy goes first: the public Overpass mirrors don't send
  // CORS headers, so direct browser calls fail from the deployed origin and
  // players silently lose real OSM discovery. The proxy also CDN-caches
  // results per rounded coordinate. Direct mirrors remain as a fallback for
  // dev servers without API functions.
  try {
    const res = await fetch(`/api/overpass?lat=${lat}&lng=${lng}`, {
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; elements?: OverpassElement[] }
      if (data.ok) return parseMapDiscovery(data.elements ?? [], lat, lng)
    }
  } catch {
    // Proxy unavailable (e.g. plain `vite dev`) — fall through to mirrors.
  }
  const query = buildDiscoveryQuery(lat, lng)
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(ENDPOINT_TIMEOUT_MS),
      })
      if (!res.ok) continue
      const data = (await res.json()) as { elements?: OverpassElement[] }
      return parseMapDiscovery(data.elements ?? [], lat, lng)
    } catch {
      // Timeout, network, or CORS failure — try the next mirror.
    }
  }
  return parseMapDiscovery([], lat, lng)
}

export function buildDiscoveryQuery(lat: number, lng: number): string {
  const around = `(around:${DISCOVERY_RADIUS_M},${lat},${lng})`
  return `[out:json][timeout:25];(` +
    `way["natural"="wood"]${around};relation["natural"="wood"]${around};` +
    `way["landuse"="forest"]${around};relation["landuse"="forest"]${around};node["natural"="tree"]${around};` +
    `way["landuse"="quarry"]${around};node["natural"~"bare_rock|stone"]${around};` +
    `way["landuse"="industrial"]${around};node["industrial"]${around};node["man_made"="works"]${around};` +
    `node["shop"~"hardware|doityourself"]${around};way["shop"~"hardware|doityourself"]${around};` +
    `node["amenity"~"restaurant|cafe|fast_food|bank|atm|hospital|clinic|pharmacy|school|college|university"]${around};` +
    `way["amenity"~"restaurant|cafe|fast_food|bank|atm|hospital|clinic|pharmacy|school|college|university"]${around};` +
    `node["office"="employment_agency"]${around};way["office"="employment_agency"]${around};` +
    `node["amenity"~"community_centre|townhall"]${around};way["amenity"~"community_centre|townhall"]${around};` +
    `node["building"="commercial"]${around};way["building"="commercial"]${around};` +
    `node["office"="insurance"]${around};way["office"="insurance"]${around};` +
    `node["shop"~"supermarket|convenience|grocery"]${around};way["shop"~"supermarket|convenience|grocery"]${around};` +
    `);out center;`
}

export function parseMapDiscovery(elements: OverpassElement[], anchorLat: number, anchorLng: number): MapDiscovery {
  const nodes: ResourceNode[] = []
  const services: ServicePoi[] = []
  const seenResources = new Set<string>()
  const seenServices = new Set<string>()

  for (const element of elements) {
    const point = pointOf(element)
    if (!point) continue
    const tags = element.tags ?? {}
    const resource = resourceKindFromTags(tags)
    if (resource) {
      const key = `${resource}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`
      if (!seenResources.has(key)) {
        seenResources.add(key)
        nodes.push(createResourceNode(resource, point.lat, point.lng, labelFromTags(tags, resource), 'osm'))
      }
    }
    const service = serviceKindFromTags(tags)
    if (service) {
      const key = `${service}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`
      if (!seenServices.has(key)) {
        seenServices.add(key)
        services.push({
          id: `osm-${service}-${point.lat.toFixed(4)}-${point.lng.toFixed(4)}`,
          kind: service,
          label: labelFromTags(tags, service),
          lat: point.lat,
          lng: point.lng,
          source: 'osm',
        })
      }
    }
  }

  return {
    resourceNodes: ensureResourceCoverage(nodes, anchorLat, anchorLng),
    servicePois: services,
  }
}

function pointOf(element: OverpassElement): { lat: number; lng: number } | null {
  if (element.lat !== undefined && element.lon !== undefined) return { lat: element.lat, lng: element.lon }
  if (element.center) return { lat: element.center.lat, lng: element.center.lon }
  return null
}

function resourceKindFromTags(tags: Record<string, string>): ResourceKind | null {
  if (tags.natural === 'wood' || tags.landuse === 'forest' || tags.natural === 'tree' || tags.leisure === 'park') return 'wood'
  if (tags.landuse === 'quarry' || tags.natural === 'bare_rock' || tags.natural === 'stone') return 'stone'
  if (tags.landuse === 'industrial' || tags.man_made === 'works' || tags.industrial) return 'metal'
  if (tags.shop === 'hardware' || tags.shop === 'doityourself') return 'glass'
  return null
}

function serviceKindFromTags(tags: Record<string, string>): ServicePoi['kind'] | null {
  if (['restaurant', 'cafe', 'fast_food'].includes(tags.amenity ?? '')) return 'restaurant'
  if (['bank', 'atm'].includes(tags.amenity ?? '')) return 'bank'
  if (['hospital', 'clinic', 'pharmacy'].includes(tags.amenity ?? '')) return 'health'
  if (['school', 'college', 'university'].includes(tags.amenity ?? '')) return 'school'
  if (tags.office === 'insurance') return 'insurance'
  if (['supermarket', 'convenience', 'grocery'].includes(tags.shop ?? '')) return 'grocery'
  if (
    tags.office === 'employment_agency' ||
    tags.amenity === 'community_centre' ||
    tags.amenity === 'townhall' ||
    tags.building === 'commercial'
  ) return 'workers-hall'
  return null
}

function labelFromTags(tags: Record<string, string>, fallback: string): string {
  if (tags.name) return tags.name
  if (fallback === 'workers-hall') return 'Workers Hall'
  const label = fallback.replace(/-/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
