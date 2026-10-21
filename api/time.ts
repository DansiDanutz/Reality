import type { VercelRequest, VercelResponse } from './_vercel.js'

/**
 * The trusted clock. The client measures its offset from this (round-trip
 * midpoint) so the simulation runs on server time, not on a device clock
 * anyone can set forward. No auth and no storage: it reveals nothing but
 * the time, and must never be cached.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  res.status(200).json({ ok: true, now: Date.now() })
}
