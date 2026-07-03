import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Where is this player, really? Vercel attaches the visitor's IP geolocation
 * to every request — city-level, no external service. Rule #1: your life
 * starts in your own town.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const h = req.headers
  const lat = Number(h['x-vercel-ip-latitude'])
  const lng = Number(h['x-vercel-ip-longitude'])
  const city = h['x-vercel-ip-city'] ? decodeURIComponent(String(h['x-vercel-ip-city'])) : undefined
  const country = h['x-vercel-ip-country'] ? String(h['x-vercel-ip-country']) : undefined

  // Per-visitor data — must never be cached by the CDN
  res.setHeader('Cache-Control', 'private, no-store')

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(200).json({ ok: false })
    return
  }
  res.status(200).json({ ok: true, city, country, lat, lng })
}
