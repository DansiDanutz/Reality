import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Self-contained (api/ cannot import from src/): keep in sync with src/lib/analytics.ts
export const ACCEPTED_FUNNEL_EVENTS = [
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
] as const

const FUNNEL_EVENTS = new Set<string>(ACCEPTED_FUNNEL_EVENTS)

/**
 * Funnel milestone tracking. One blob per (event, anonymous id), claim-once:
 * the store physically cannot count the same person twice, and stores nothing
 * about them but the milestone and the day it was reached.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { event, aid } = (req.body ?? {}) as { event?: string; aid?: string }
  if (!event || !FUNNEL_EVENTS.has(event) || !/^[0-9a-f-]{36}$/i.test(String(aid ?? ''))) {
    res.status(400).json({ ok: false, error: 'Bad event.' })
    return
  }

  try {
    // Bot brake: a real person crosses at most a dozen milestones, ever
    const ip = String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').split(',')[0].trim()
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
    const day = new Date().toISOString().slice(0, 10)
    const recent = await list({ prefix: `trackip/${ipHash}__${day}`, limit: 41 })
    if (recent.blobs.length >= 40) {
      res.status(429).json({ ok: false })
      return
    }
    await put(`trackip/${ipHash}__${day}__${Date.now()}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })

    const aidHash = createHash('sha256').update(String(aid)).digest('hex').slice(0, 24)
    try {
      await put(`funnel/${event}/${aidHash}.json`, JSON.stringify({ day }), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
      })
    } catch {
      // already counted — exactly the guarantee we want
    }
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false })
  }
}
