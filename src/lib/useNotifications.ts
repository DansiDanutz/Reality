import { useEffect, useRef, useState } from 'react'
import { track } from './analytics'
import { zoneFor } from '../game/clock'
import { challengesForDay, challengeProgress } from '../game/dailyChallenges'
import { decideNotifications, markNotified, NOTIFICATION_REASONS, type NotificationLog, type NotificationSnapshot } from '../game/notifications'
import { useGame } from '../store/gameStore'

/**
 * Web Notifications — the game reaches OUT to the player.
 *
 * This hook is the React side of the notifications engine (src/game/
 * notifications.ts). On each tick it builds a snapshot, asks the pure
 * engine what to notify, and fires via the browser Notification API.
 *
 * Permission model: we never prompt on load (that's the pattern that made
 * web notifications hated). Instead the player enables notifications from
 * a Settings/Profile affordance, which calls requestPermission(). The
 * NOTIFICATION_REASONS list explains what they'll get before they opt in.
 *
 * Tab visibility: notifications only fire when the tab is HIDDEN — if the
 * player is already looking at the game, the in-app toast is enough and a
 * system notification would be redundant/noisy.
 */

/** Has the player granted notification permission? */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null
}

/**
 * Ask the player for permission. Call this ONLY from an explicit user
 * gesture (a button click) — never automatically.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      // Analytics: fire-and-forget — measures what % of players enable the
      // retention-critical notification system.
      try { track('notifications_enabled') } catch { /* ignore */ }
    }
    return result
  } catch {
    return null
  }
}

/**
 * The main hook. Call once from a top-level component (App). It subscribes
 * to ticks via lastSeenAt and fires notifications when the tab is hidden.
 */
export function useNotifications(): void {
  // Persist the notification log in a ref — resets on page reload, which is
  // fine (the player reloading is themselves re-engaging; re-firing a
  // streak-at-risk after reload is correct behavior, not spam).
  const logRef = useRef<NotificationLog>({})
  // Subscribe to lastSeenAt so this hook re-runs the decision each tick.
  const lastSeenAt = useGame((s) => s.lastSeenAt)
  // Re-read permission each render — it can change from another tab.
  const [permission] = useState<NotificationPermission | null>(notificationPermission)

  useEffect(() => {
    // Bail early if unsupported, not granted, or tab is visible (the toast
    // covers the visible case; a system notification would be redundant).
    if (!notificationsSupported() || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return

    const s = useGame.getState()
    if (!s.citizen) return

    // Build the snapshot from the live store.
    const home = s.assets.find((a) => a.kind === 'home')
    const anchorLat = home ? home.lat : s.citizen.spawnLat
    const anchorLng = home ? home.lng : s.citizen.spawnLng
    const todayDay = dayIndexOf(lastSeenAt, anchorLat, anchorLng)

    const snap: NotificationSnapshot = {
      now: lastSeenAt,
      todayDay,
      streakLastClaimDay: s.streakLastClaimDay,
      streakLength: s.streakLength,
      activity: s.activity,
      needs: s.needs,
      money: s.money,
      dailyDone: s.dailyCounters.day === todayDay
        // Count complete + claimed (matches what the panel shows). Imported
        // lazily to avoid a static cycle when this hook is first loaded.
        ? countDailyDone(s, todayDay)
        : 0,
      dailyTotal: 3,
      dailyBonusClaimed: s.dailyBonusClaimed,
    }

    const decisions = decideNotifications(snap, logRef.current)
    // Filter by the player's per-type opt-ins. A player who finds needs-
    // critical notifications naggy can turn them off without losing the
    // streak-at-risk alert (the most retention-critical one).
    const prefs = s.notificationPrefs
    const allowed = decisions.filter((d) => prefs[d.tag] !== false)
    for (const d of allowed) {
      try {
        new Notification(d.title, {
          body: d.body,
          tag: d.tag, // browser collapses duplicate tags
          icon: '/icon-192.png',
        })
        logRef.current = markNotified(logRef.current, d.id, lastSeenAt)
      } catch {
        // Notification construction can throw in some browsers (e.g. service
        // worker required). Fail silently — the in-app toast still works.
      }
    }
  }, [lastSeenAt, permission])
}

/**
 * Local day-index helper, mirroring the store's private dayIndexOf. Reuses
 * clock.ts's zoneFor so the notification's notion of "today" matches the
 * TopBar clock and the streak engine exactly.
 */
function dayIndexOf(now: number, lat?: number, lng?: number): number {
  const zone = lat !== undefined && lng !== undefined ? zoneFor(lat, lng) : Intl.DateTimeFormat().resolvedOptions().timeZone
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))
  return Math.floor(Date.parse(ymd + 'T00:00:00Z') / 86_400_000)
}

/**
 * Count how many of today's challenges are done (claimed OR complete). Mirrors
 * the AchievementsPanel logic. Kept here (not exported from dailyChallenges)
 * because it needs the live store's dailyCounters, which the engine module
 * can't import without a cycle.
 */
function countDailyDone(s: { citizen: { citizenId?: string } | null; dailyCounters: { mealsToday: number; shiftsToday: number; earnedToday: number; sleptToday: number; boughtToday: number }; dailyClaimed: string[] }, todayDay: number): number {
  if (!s.citizen) return 0
  const challenges = challengesForDay(s.citizen.citizenId ?? 'anon', todayDay)
  const snap = {
    mealsToday: s.dailyCounters.mealsToday,
    shiftsToday: s.dailyCounters.shiftsToday,
    earnedToday: s.dailyCounters.earnedToday,
    sleptToday: s.dailyCounters.sleptToday,
    boughtToday: s.dailyCounters.boughtToday,
  }
  return challenges.filter((c) => s.dailyClaimed.includes(c.id) || challengeProgress(c, snap).complete).length
}

export { NOTIFICATION_REASONS }
