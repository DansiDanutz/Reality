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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!isLatitude(lat) || !isLongitude(lng)) {
    res.status(400).json({ ok: false, error: 'lat and lng query params are required' })
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
      const data = (await upstream.json()) as { elements?: unknown[] }
      // Map data around a coordinate barely changes day to day — cache hard
      // at the CDN, serve stale while refreshing.
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
      res.status(200).json({ ok: true, elements: data.elements ?? [] })
      return
    } catch (error) {
      console.error(`overpass mirror ${endpoint} failed:`, error instanceof Error ? error.message : error)
    }
  }

  // All mirrors failed: tell the client cleanly; it keeps its fallback nodes.
  res.setHeader('Cache-Control', 'public, s-maxage=120')
  res.status(502).json({ ok: false, error: 'All Overpass mirrors failed' })
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
