import type { VercelRequest, VercelResponse } from './_vercel.js'

/**
 * Where is this player, really? Vercel attaches the visitor's IP geolocation
 * to every request — city-level, no external service. Rule #1: your life
 * starts in your own town.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const h = req.headers
  const lat = Number(h['x-vercel-ip-latitude'])
  const lng = Number(h['x-vercel-ip-longitude'])
  const city = decodeCity(h['x-vercel-ip-city'])
  const country = h['x-vercel-ip-country'] ? String(h['x-vercel-ip-country']) : undefined

  // Per-visitor data — must never be cached by the CDN
  res.setHeader('Cache-Control', 'private, no-store')

  if (!isLatitude(lat) || !isLongitude(lng)) {
    res.status(200).json({ ok: false })
    return
  }
  res.status(200).json({ ok: true, city, country, lat, lng })
}

function decodeCity(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  try {
    return decodeURIComponent(String(value))
  } catch {
    return undefined
  }
}

function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}
