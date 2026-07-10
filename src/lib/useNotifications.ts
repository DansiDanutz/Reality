import { useEffect, useRef, useState } from 'react'
import { track } from './analytics'
import { zoneFor } from '../game/clock'
import { challengesForDay, challengeProgress, type ChallengeDef, type DailyChallengeSnapshot } from '../game/dailyChallenges'
import { decideNotifications, markNotified, NOTIFICATION_REASONS, type NotificationLog, type NotificationSnapshot } from '../game/notifications'
import { dailyChallengeContextOf, msToLocalMidnight, useGame } from '../store/gameStore'

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
    const dailyProgress = dailyChallengeNotificationProgressForState(s, todayDay)

    const snap: NotificationSnapshot = {
      now: lastSeenAt,
      todayDay,
      msToMidnight: msToLocalMidnight(lastSeenAt, anchorLat, anchorLng),
      streakLastClaimDay: s.streakLastClaimDay,
      streakLength: s.streakLength,
      activity: s.activity,
      // The completion transition: the tick nulls a finished activity before
      // this hook runs, so activity-complete is detected via this record.
      lastCompletedActivity: s.lastCompletedActivity,
      needs: s.needs,
      money: s.money,
      dailyDone: dailyProgress.done,
      dailyTotal: dailyProgress.total,
      dailyBonusClaimed: s.dailyBonusClaimed,
    }

    const decisions = decideNotifications(snap, logRef.current)
    // Filter by the player's per-type opt-ins. A player who finds needs-
    // critical notifications naggy can turn them off without losing the
    // streak-at-risk alert (the most retention-critical one).
    const prefs = s.notificationPrefs
    const allowed = decisions.filter((d) => prefs[d.tag] !== false)
    for (const d of allowed) {
      // Mark before the async fire: showNotification resolving later must not
      // let a second tick double-fire the same decision.
      logRef.current = markNotified(logRef.current, d.id, lastSeenAt)
      void showSystemNotification(d.title, {
        body: d.body,
        tag: d.tag, // browser collapses duplicate tags
        icon: '/icon-192.png',
      })
    }
  }, [lastSeenAt, permission])
}

/**
 * Fire a system notification the way the platform demands. Android Chrome
 * throws on page-created `new Notification()` — notifications there must go
 * through the service worker registration. Desktop accepts either; we prefer
 * the worker (its notificationclick refocuses the game tab) and fall back to
 * the page API, failing silently if both are unavailable.
 */
async function showSystemNotification(title: string, options: NotificationOptions): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      // getRegistration (not .ready): .ready never settles when registration
      // failed, which would swallow the fallback path below.
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.active) {
        await reg.showNotification(title, options)
        return
      }
    }
  } catch {
    // fall through to the page API
  }
  try {
    new Notification(title, options)
  } catch {
    // Neither path available — the in-app toast still covers the visible tab.
  }
}

/**
 * Local day-index helper, mirroring the store's private dayIndexOf. Reuses
 * clock.ts's zoneFor so the notification's notion of "today" matches the
 * TopBar clock and the streak engine exactly.
 */
function dayIndexOf(now: number, lat?: number, lng?: number): number {
  // Same crash guard as the store's copy — Intl throws RangeError on
  // timezone names some runtimes don't know, and this runs inside an effect.
  let zone: string
  try {
    zone = lat !== undefined && lng !== undefined ? zoneFor(lat, lng) : Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    zone = 'UTC'
  }
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))
  return Math.floor(Date.parse(ymd + 'T00:00:00Z') / 86_400_000)
}

function dailyChallengeNotificationProgressForState(
  s: ReturnType<typeof useGame.getState>,
  todayDay: number,
): { done: number; total: number } {
  if (!s.citizen) return { done: 0, total: 0 }
  const challenges = challengesForDay(s.citizen.citizenId ?? 'anon', todayDay, dailyChallengeContextOf(s))
  if (s.dailyCounters.day !== todayDay) return { done: 0, total: challenges.length }
  const snap: DailyChallengeSnapshot = {
    mealsToday: s.dailyCounters.mealsToday,
    drinksToday: s.dailyCounters.drinksToday,
    hygieneToday: s.dailyCounters.hygieneToday,
    shiftsToday: s.dailyCounters.shiftsToday,
    earnedToday: s.dailyCounters.earnedToday,
    sleptToday: s.dailyCounters.sleptToday,
    boughtToday: s.dailyCounters.boughtToday,
    studiedToday: s.dailyCounters.studiedToday,
    gatheredToday: s.dailyCounters.gatheredToday,
    constructionMinutesToday: s.dailyCounters.constructionMinutesToday,
    workersHiredToday: s.dailyCounters.workersHiredToday,
    communityToday: s.dailyCounters.communityToday,
    businessDevelopmentMinutesToday: s.dailyCounters.businessDevelopmentMinutesToday,
  }
  return notificationDailyChallengeProgress(challenges, s.dailyClaimed, snap)
}

/**
 * Count how many of today's challenges are done (claimed OR complete). Mirrors
 * the AchievementsPanel logic while keeping the total tied to the generated
 * challenge list instead of a hardcoded count.
 */
export function notificationDailyChallengeProgress(
  challenges: readonly ChallengeDef[],
  claimedIds: readonly string[],
  snap: DailyChallengeSnapshot,
): { done: number; total: number } {
  return {
    done: challenges.filter((c) => claimedIds.includes(c.id) || challengeProgress(c, snap).complete).length,
    total: challenges.length,
  }
}

export { NOTIFICATION_REASONS }
