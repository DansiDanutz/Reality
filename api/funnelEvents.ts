// API-side copy of src/lib/analytics.ts FUNNEL_EVENTS.
// Keep API handlers self-contained while tests enforce client/API sync.
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
  'd1_return',
  'd7_return',
  'tutorial_complete',
  'life_ladder_stage_progress',
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

export type ApiFunnelEvent = (typeof FUNNEL_EVENTS)[number]
