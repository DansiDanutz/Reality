import { list } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Self-contained (api/ cannot import from src/): keep in sync with src/lib/analytics.ts
const FUNNEL_EVENTS = [
  'welcome_seen',
  'spawn_detected',
  'citizen_created',
  'avatar_created',
  'first_zoom_to_street',
  'walk_mode_entered',
  'first_purchase',
  'first_shift_started',
  'first_home_placed',
  'first_business_placed',
  'first_collect',
  'd7_return',
  'tutorial_complete',
  'first_achievement',
  'first_lucky',
  'streak_7',
  'daily_complete',
  'first_upgrade',
  'business_maxed',
  'week_milestone',
  'notifications_enabled',
  'telegram_linked',
]

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
  try {
    const counts = await Promise.all(FUNNEL_EVENTS.map((e) => countPrefix(`funnel/${e}/`)))
    const funnel = FUNNEL_EVENTS.map((event, i) => ({ event, uniques: counts[i] }))
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ ok: true, funnel })
  } catch {
    res.status(500).json({ ok: false })
  }
}
