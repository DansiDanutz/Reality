import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Same-origin proxy for OpenStreetMap Overpass discovery queries. The
 * public Overpass mirrors don't send CORS headers, so the browser cannot
 * query them directly from the production origin — every player was falling
 * straight to the synthetic fallback nodes. The proxy accepts ONLY a
 * lat/lng pair (never raw Overpass QL — this must not become an open
 * relay) and builds the exact discovery query the client used to send.
 *
 * Keep the query in sync with src/game/mapDiscovery.ts buildDiscoveryQuery
 * — api/ stays self-contained (no src/ imports), and overpass.test.ts
 * enforces the sync.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

// The full discovery query takes ~30s on overpass-api.de (measured) — the
// QL itself carries [timeout:25]. Give the primary mirror room to finish and
// keep the fallbacks short so the total stays inside the 60s function cap.
const ENDPOINT_TIMEOUTS_MS = [35_000, 10_000, 10_000]
const DISCOVERY_RADIUS_M = 2_500
const IP_WINDOW_MS = 60_000
const REQUESTS_PER_IP_WINDOW = 12
const ipWindows = new Map<string, { startedAt: number; count: number }>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!hasOnlyCoordinateParams(req.query)) {
    res.status(400).json({ ok: false, error: 'lat and lng query params are required' })
    return
  }

  const lat = parseCoordinate(req.query.lat)
  const lng = parseCoordinate(req.query.lng)
  if (lat === null || lng === null || !isLatitude(lat) || !isLongitude(lng)) {
    res.status(400).json({ ok: false, error: 'lat and lng query params are required' })
    return
  }

  const ip = String(req.headers?.['x-forwarded-for'] ?? req.headers?.['x-real-ip'] ?? 'unknown').split(',')[0].trim() || 'unknown'
  if (!admitIp(ip)) {
    res.setHeader('Retry-After', '60')
    res.status(429).json({ ok: false, error: 'Map discovery is temporarily rate-limited. Try again shortly.', code: 'overpass_rate_limited' })
    return
  }

  // Round to ~110m so nearby players share one CDN cache entry and the
  // upstream mirrors see a fraction of the traffic.
  const roundedLat = Number(lat.toFixed(3))
  const roundedLng = Number(lng.toFixed(3))
  const query = buildDiscoveryQuery(roundedLat, roundedLng)

  for (const [index, endpoint] of OVERPASS_ENDPOINTS.entries()) {
    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // overpass-api.de returns 406 for requests without an identifying
          // User-Agent (OSM usage policy) — identify the game and a contact.
          'User-Agent': 'Reality-Game/1.0 (https://reality-gamma.vercel.app; github.com/DansiDanutz/Reality)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(ENDPOINT_TIMEOUTS_MS[index] ?? 10_000),
      })
      if (!upstream.ok) {
        console.error(`overpass mirror ${endpoint} responded ${upstream.status}`)
        continue
      }
      const data = (await upstream.json()) as { elements?: unknown[]; remark?: string }
      const elements = data.elements ?? []
      // A remark with no elements means the mirror hit its internal timeout
      // and returned a truncated result — that's a failure, not real data.
      if (elements.length === 0 && data.remark) {
        console.error(`overpass mirror ${endpoint} truncated: ${data.remark.slice(0, 120)}`)
        continue
      }
      // Map data around a coordinate barely changes day to day — cache hard.
      // Empty results are legitimate in remote areas but are also what a
      // flaky mirror returns, so they only get a short cache and re-resolve.
      res.setHeader(
        'Cache-Control',
        elements.length > 0
          ? 'public, s-maxage=86400, stale-while-revalidate=604800'
          : 'public, s-maxage=300',
      )
      res.status(200).json({ ok: true, elements })
      return
    } catch (error) {
      console.error(`overpass mirror ${endpoint} failed:`, error instanceof Error ? error.message : error)
    }
  }

  // All mirrors failed: tell the client cleanly; it keeps its fallback nodes.
  res.setHeader('Cache-Control', 'public, s-maxage=120')
  res.status(502).json({ ok: false, error: 'All Overpass mirrors failed' })
}

/** Best-effort warm-instance brake; edge/global limiting remains deployment work. */
function admitIp(ip: string, now = Date.now()): boolean {
  const previous = ipWindows.get(ip)
  if (!previous || now - previous.startedAt >= IP_WINDOW_MS) {
    ipWindows.set(ip, { startedAt: now, count: 1 })
    return true
  }
  if (previous.count >= REQUESTS_PER_IP_WINDOW) return false
  previous.count += 1
  return true
}

function hasOnlyCoordinateParams(query: VercelRequest['query']): boolean {
  const keys = Object.keys(query)
  return keys.length === 2 && keys.includes('lat') && keys.includes('lng')
}

function parseCoordinate(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Mirror of src/game/mapDiscovery.ts buildDiscoveryQuery — tests keep them identical. */
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

function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}
