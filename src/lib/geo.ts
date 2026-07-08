/** The player's real-world starting point, resolved from their IP */
export interface SpawnLocation {
  city?: string
  country?: string
  lat: number
  lng: number
}

/**
 * Detect where the player is. Production: Vercel's IP geolocation via
 * /api/geo. Local dev fallback: ipwho.is (free, https). Null when neither
 * can resolve — the game still works, just without a hometown.
 */
export async function detectLocation(): Promise<SpawnLocation | null> {
  try {
    const res = await fetch('/api/geo')
    const d = (await res.json()) as { ok: boolean; city?: string; country?: string; lat?: number; lng?: number }
    if (d.ok && isLatitude(d.lat) && isLongitude(d.lng)) {
      return { city: d.city, country: d.country, lat: d.lat!, lng: d.lng! }
    }
  } catch {
    /* dev server has no /api — fall through */
  }
  try {
    const res = await fetch('https://ipwho.is/')
    const d = (await res.json()) as { success: boolean; city?: string; country?: string; latitude?: number; longitude?: number }
    if (d.success && isLatitude(d.latitude) && isLongitude(d.longitude)) {
      return { city: d.city, country: d.country, lat: d.latitude!, lng: d.longitude! }
    }
  } catch {
    /* offline */
  }
  return null
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}
