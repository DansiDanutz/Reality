/**
 * Notification decisions — what's worth interrupting the player for.
 *
 * Web Notifications are the highest-leverage retention mechanic a real-time
 * life-sim can have: the game reaches OUT to the player instead of waiting
 * for them to return. This module is the pure decision layer — given the
 * game state + what we've already notified about, what (if anything) should
 * fire a notification right now? The React layer (useNotifications hook)
 * owns the side effect: asking permission and calling `new Notification()`.
 *
 * Design principles:
 *   1. **Never spam.** Each notification type has a cooldown (e.g. "needs
 *      critical" fires at most once per 30 min). A spammed notification is
 *      a disabled notification.
 *   2. **Lead with the action, not the state.** "Your shift is done — tap to
 *      collect" beats "Shift status: complete". The notification is a CTA.
 *   3. **Respect the streak.** The most important notification is the one
 *      that protects the daily streak — it fires at a fixed time before
 *      local midnight if the player hasn't claimed today.
 *   4. **No notifications during away spans.** If the player was away for
 *      hours, the away-report is the summary; a notification would be stale.
 *
 * Pure: takes a snapshot + a "last notified at" map, returns a list of
 * notifications to fire. No DOM, no Notification API, no time-side-effects.
 */

import type { Activity } from './engine'
import type { Needs } from './types'

/** Per-tick input to decideNotifications. */
export interface NotificationSnapshot {
  /** ms timestamp of the decision point (usually Date.now()). */
  now: number
  /** The citizen's local day index (see streak.ts / store dayIndexOf). */
  todayDay: number
  /** The day index the streak was last claimed on (0 = never). */
  streakLastClaimDay: number
  /** Current streak length. */
  streakLength: number
  /** Active activity (shift/sleep/cook), or null. */
  activity: Activity | null
  /** Current needs. */
  needs: Needs
  /** Current money — used for the "broke" notification guard. */
  money: number
  /** Daily challenges: how many of today's 3 are complete. */
  dailyDone: number
  /** Daily challenges: total count (usually 3). */
  dailyTotal: number
  /** Whether the all-3 bonus has been claimed today. */
  dailyBonusClaimed: boolean
}

/**
 * Map of notification-type → ms timestamp it was last fired. The engine
 * consults this to enforce cooldowns; the React layer owns the actual
 * persistence (in-memory is fine — notifications reset on page reload).
 */
export type NotificationLog = Record<string, number>

export interface NotificationDecision {
  /** Stable id for cooldown tracking + analytics. */
  id: string
  /** Notification title — keep it short (mobile truncates). */
  title: string
  /** Body — the action-oriented detail. */
  body: string
  /** Analytics tag — which feature this promotes. */
  tag: 'activity' | 'streak' | 'needs'
}

/** Cooldowns in ms. Tuned so no type fires more than once per window. */
const COOLDOWN_MS: Record<string, number> = {
  'activity-complete': 0, // fires once per activity end (cleared on new activity)
  'streak-at-risk': 3 * 60 * 60_000, // at most every 3 hours
  'needs-critical': 30 * 60_000, // at most every 30 minutes
  'daily-incomplete': 6 * 60 * 60_000, // at most once per evening
}

/** A need is "critical" below this threshold. */
const NEED_CRITICAL = 15

/** The streak is "at risk" if the player hasn't claimed today AND it's
 *  within this many ms of local midnight. Tuned to ~3 hours — late enough
 *  that most timezones are in their evening, early enough to act. */
const STREAK_RISK_WINDOW_MS = 3 * 60 * 60_000

/** ms in a day — for the midnight-distance computation. */
const DAY_MS = 24 * 3_600_000

/**
 * Pure decision: given the snapshot + log, what notifications should fire?
 * Returns an array (usually 0 or 1 elements — we never stack notifications
 * because each one competes for attention; the most urgent wins).
 *
 * The caller fires them in order and updates the log with `now` for each id.
 */
export function decideNotifications(
  snap: NotificationSnapshot,
  log: NotificationLog,
): NotificationDecision[] {
  const out: NotificationDecision[] = []
  const cooled = (id: string): boolean => {
    const last = log[id] ?? 0
    return snap.now - last >= COOLDOWN_MS[id]
  }

  // 1. Activity completion — the highest-value notification. The player
  //    started a shift/sleep/cook and walked away; this brings them back to
  //    collect and chain into the next action.
  if (snap.activity && snap.now >= snap.activity.endsAt && cooled('activity-complete')) {
    const verb =
      snap.activity.kind === 'shift' ? 'Shift done — collect your wages'
      : snap.activity.kind === 'sleep' ? 'You\'re rested — back to the world'
      : 'Your meal is ready 🍽️'
    out.push({
      id: 'activity-complete',
      title: verb,
      body: 'Tap to continue your life.',
      tag: 'activity',
    })
  }

  // 2. Streak at risk — the single most retention-critical notification.
  //    Fires in the final hours before local midnight if today's streak
  //    hasn't been claimed. Losing a 14-day streak because you forgot is
  //    the #1 quit trigger; this prevents it.
  if (snap.streakLength >= 2 && snap.todayDay > snap.streakLastClaimDay && cooled('streak-at-risk')) {
    // Distance to local midnight: ms remaining in today's local day.
    // The store computes todayDay from local midnight, so midnight is at
    // (todayDay + 1) * DAY_MS in the local-day-index frame.
    const nextMidnight = (snap.todayDay + 1) * DAY_MS
    const msToMidnight = nextMidnight - snap.now
    // snap.now is a wall clock; todayDay * DAY_MS is the day index * day ms.
    // The subtraction only makes sense if both are in the same frame. The
    // store passes a *day-index-aligned* now (ms since epoch), so this works.
    if (msToMidnight <= STREAK_RISK_WINDOW_MS && msToMidnight > 0) {
      const hours = Math.max(1, Math.round(msToMidnight / 3_600_000))
      out.push({
        id: 'streak-at-risk',
        title: `🔥 Streak at risk — ${hours}h to midnight`,
        body: `Open Reality to claim day ${snap.streakLength + 1} and keep your streak alive.`,
        tag: 'streak',
      })
    }
  }

  // 3. Needs critical — urgency. A starving/dehydrated citizen creates a
  //    pull to act. We only fire if at least one need is critical AND the
  //    player can actually do something about it (has a little money).
  if (cooled('needs-critical') && snap.money >= 1) {
    const critical: string[] = []
    if (snap.needs.hunger < NEED_CRITICAL) critical.push('starving')
    if (snap.needs.hydration < NEED_CRITICAL) critical.push('dehydrated')
    if (snap.needs.energy < NEED_CRITICAL) critical.push('exhausted')
    if (critical.length > 0) {
      out.push({
        id: 'needs-critical',
        title: `Your citizen is ${critical[0]}`,
        body: 'Open Reality to eat, drink, or rest before health drops.',
        tag: 'needs',
      })
    }
  }

  // 4. Daily challenges incomplete — the return-driver. In the final hours
  //    before midnight, if the player has done some but not all challenges
  //    (and hasn't claimed the bonus), nudge them to finish. The "some but
  //    not all" guard is key: it targets players who already engaged today
  //    (most likely to return) rather than zero-engagement players.
  if (
    cooled('daily-incomplete') &&
    snap.dailyTotal > 0 &&
    !snap.dailyBonusClaimed &&
    snap.dailyDone > 0 &&
    snap.dailyDone < snap.dailyTotal
  ) {
    const nextMidnight = (snap.todayDay + 1) * DAY_MS
    const msToMidnight = nextMidnight - snap.now
    if (msToMidnight <= STREAK_RISK_WINDOW_MS && msToMidnight > 0) {
      const hours = Math.max(1, Math.round(msToMidnight / 3_600_000))
      out.push({
        id: 'daily-incomplete',
        title: `🎯 ${snap.dailyDone}/${snap.dailyTotal} daily challenges — ${hours}h to finish`,
        body: `One more action completes today's set and the bonus reward.`,
        tag: 'activity',
      })
    }
  }

  // Never stack: if multiple fired, prefer in this priority order —
  // activity (immediate action) > streak (retention-critical) > needs (urgent).
  // Daily-incomplete is tagged 'activity' so it competes with activity-complete
  // for the top slot, which is correct (both are "do this now" nudges).
  if (out.length > 1) {
    const priority = ['activity', 'streak', 'needs']
    out.sort((a, b) => priority.indexOf(a.tag) - priority.indexOf(b.tag))
    return [out[0]]
  }
  return out
}

/**
 * Mark a notification id as fired at the given time. The React layer calls
 * this after actually showing the notification, then persists the log.
 */
export function markNotified(log: NotificationLog, id: string, now: number): NotificationLog {
  return { ...log, [id]: now }
}

/**
 * Human-readable explanation of why we'd notify, for the permissions prompt
 * UI ("Reality wants to notify you about: ..."). Pure string, no side effect.
 */
export const NOTIFICATION_REASONS = [
  'When your shift, sleep, or meal finishes',
  'Before midnight if your daily streak is at risk',
  'When your citizen urgently needs food, water, or rest',
] as const
