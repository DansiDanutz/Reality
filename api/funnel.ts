import { list } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from './_vercel.js'
import { FUNNEL_EVENTS } from './funnelEvents.js'

async function countPrefix(prefix: string): Promise<number> {
  let count = 0
  let cursor: string | undefined
  for (let page = 0; page < 5; page++) {
    const batch = await list({ prefix, cursor, limit: 1000 })
    count += batch.blobs.length
    if (!batch.hasMore || !batch.cursor) break
    cursor = batch.cursor
  }
  return count
}

/**
 * The funnel, readable: unique people per milestone, in journey order.
 * Aggregate counts only — open development means the numbers are public.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  if (Object.keys(req.query ?? {}).length > 0) {
    res.status(400).json({ ok: false, error: 'Query parameters are not allowed.' })
    return
  }
  try {
    const counts = await Promise.all(FUNNEL_EVENTS.map((e) => countPrefix(`funnel/${e}/`)))
    const funnel = FUNNEL_EVENTS.map((event, i) => ({ event, uniques: counts[i] }))
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ ok: true, funnel })
  } catch {
    res.status(500).json({ ok: false })
  }
}
