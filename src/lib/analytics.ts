/**
 * Funnel analytics — privacy-clean by construction (plan 01, "the funnel").
 * One anonymous id per browser, one claim-once blob per (event, id) on the
 * server: the funnel counts UNIQUE people per milestone, nothing else.
 * No third parties, no PII, honors Do Not Track, and each event leaves this
 * browser at most once. Analytics must never break the game: everything is
 * fire-and-forget behind try/catch.
 */

export const FUNNEL_EVENTS = [
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
  // Retention engine events — measure the new systems so we can tune them.
  'first_achievement',       // first achievement claimed
  'first_lucky',             // first lucky moment witnessed
  'streak_7',                // reached a 7-day streak
  'daily_complete',          // completed all 3 daily challenges
  'first_upgrade',           // first business upgrade purchased
  'business_maxed',          // reached L10 on a business
  'week_milestone',          // crossed a weekly milestone (1/2/4/8/...)
  'notifications_enabled',   // granted notification permission
  'telegram_linked',         // Telegram Mini App identity verified and linked
] as const

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number]

const SENT_KEY = 'reality-funnel-sent'
const AID_KEY = 'reality-aid'

export function track(event: FunnelEvent): void {
  try {
    if (typeof window === 'undefined') return
    if (navigator.doNotTrack === '1') return
    const sent: string[] = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]')
    if (sent.includes(event)) return
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent, event]))
    let aid = localStorage.getItem(AID_KEY)
    if (!aid) {
      aid = crypto.randomUUID()
      localStorage.setItem(AID_KEY, aid)
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, aid }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // never let telemetry hurt gameplay
  }
}
