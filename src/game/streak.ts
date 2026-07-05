/**
 * Daily streak — the come-back-tomorrow retention hook.
 *
 * Design (audit against docs/ARCHITECTURE.md "Pure engine" rule):
 *   This file is framework-free. No React, no store, no DOM. It exports pure
 *   predicates over a {@link StreakState} and a calendar day index. The store
 *   owns the only side effect: granting rewards + firing a toast on the first
 *   tick of a new day.
 *
 * What counts as a streak day?
 *   - A "day" is a real calendar day in the citizen's local timezone
 *     (Reality is real-time — see src/game/clock.ts). The store computes the
 *     day index via {@link dayIndexOf}; this module never touches time zones.
 *   - The player advances the streak the first time they tick on a calendar
 *     day after their last claimed day (gap ≥ 1).
 *
 * Forgiveness model:
 *   - Gap of exactly 1 day → streak advances normally (the normal case).
 *   - Gap of 2 days (you skipped yesterday) → streak is preserved but does
 *     NOT advance; the player keeps their tier and is nudged to come back.
 *   - Gap of 3+ days → streak resets to 1. The reward shrinks back to day-1.
 *   Rationale: one missed day shouldn't undo a month of habit; two missed
 *   days is a real break and the reset keeps the reward meaningful.
 *
 * Reward curve (cash + XP), balanced for the $200k founder economy and
 * the level curve in catalog.ts:
 *   day  1   →   $0      +   0 XP  (the day they spawn — no reward, no toast)
 *   day  2   →  $50      +  10 XP
 *   day  3   → $100      +  20 XP
 *   day  4   → $200      +  35 XP
 *   day  5   → $400      +  60 XP
 *   day  6   → $750      + 100 XP
 *   day  7   → $1,500    + 200 XP  ← weekly jackpot
 *   day 14   → $5,000    + 500 XP  ← fortnight
 *   day 30   → $25,000   +1,000 XP ← monthly legend
 *   day 100  → $100,000  +5,000 XP ← centurion
 *
 * Between named tiers the reward grows linearly (interpolated). This keeps
 * every single day meaningful — a design lesson from Wordle / Duolingo.
 */

/**
 * (dayIndex, cash, xp) anchor points on the reward curve.
 * Strictly increasing in dayIndex; rewards also strictly increasing.
 */
export const STREAK_REWARD_TIERS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [2, 50, 10],
  [3, 100, 20],
  [4, 200, 35],
  [5, 400, 60],
  [6, 750, 100],
  [7, 1_500, 200],
  [14, 5_000, 500],
  [30, 25_000, 1_000],
  [100, 100_000, 5_000],
] as const

/** Maximum gap (in days) before a streak resets. Gap of RESET_GAP+1 resets. */
export const STREAK_RESET_GAP = 2

export interface StreakState {
  /** Current streak length in days. 0 before the first claim. */
  length: number
  /** The day index the player last claimed on. 0 = never. */
  lastClaimDay: number
}

export interface StreakReward {
  /** New streak length after this claim. */
  length: number
  /** Cash reward for this claim. */
  cash: number
  /** XP reward for this claim. */
  xp: number
  /** Did the streak reset on this claim? */
  reset: boolean
  /** Did the streak advance (length increased)? */
  advanced: boolean
}

/**
 * Linear interpolation of the reward curve at the given streak length.
 * Below the first anchor → first anchor's reward. Above the last → last.
 * Pure; exported for tests and any future adapter (server-side balancing).
 */
export function rewardForStreakDay(length: number): { cash: number; xp: number } {
  if (length <= STREAK_REWARD_TIERS[0][0]) {
    return { cash: STREAK_REWARD_TIERS[0][1], xp: STREAK_REWARD_TIERS[0][2] }
  }
  const last = STREAK_REWARD_TIERS[STREAK_REWARD_TIERS.length - 1]
  if (length >= last[0]) return { cash: last[1], xp: last[2] }
  for (let i = 1; i < STREAK_REWARD_TIERS.length; i++) {
    const [d1, c1, x1] = STREAK_REWARD_TIERS[i - 1]
    const [d2, c2, x2] = STREAK_REWARD_TIERS[i]
    if (length >= d1 && length <= d2) {
      const t = (length - d1) / (d2 - d1)
      return {
        cash: Math.round(c1 + (c2 - c1) * t),
        xp: Math.round(x1 + (x2 - x1) * t),
      }
    }
  }
  // Unreachable given the bounds checks above, but keeps the type checker happy.
  return { cash: last[1], xp: last[2] }
}

/**
 * Decide what happens to the streak given the player's situation on the
 * current day. Returns the outcome; the store applies the rewards.
 *
 * @param prev      Previous streak state.
 * @param todayDay  The citizen's local calendar day index (days since epoch).
 * @returns         The claim outcome, or `null` if there is nothing to claim
 *                  today (already claimed, or before the first eligible day).
 */
export function computeStreakClaim(prev: StreakState, todayDay: number): StreakReward | null {
  // Never claim on a non-positive day index (citizen just spawned, clock
  // hasn't crossed midnight yet — the store seeds lastClaimDay on creation).
  if (todayDay <= 0) return null

  // Already claimed today — idempotent. The store relies on this so that
  // every 1-second tick after the claim is a no-op for streaks.
  if (todayDay <= prev.lastClaimDay) return null

  const gap = todayDay - prev.lastClaimDay
  if (prev.lastClaimDay === 0) {
    // First ever claim. Day 1 of the streak (the day of spawn is day 1,
    // but the reward is $0 by design — they were going to play anyway).
    const length = 1
    const r = rewardForStreakDay(length)
    return { length, cash: r.cash, xp: r.xp, reset: false, advanced: true }
  }

  if (gap >= STREAK_RESET_GAP + 1) {
    // Missed too many days. Reset to a fresh day 1. The streak did not
    // advance — it shrank — so `advanced` is always false here.
    const length = 1
    const r = rewardForStreakDay(length)
    return { length, cash: r.cash, xp: r.xp, reset: true, advanced: false }
  }

  if (gap === STREAK_RESET_GAP) {
    // Skipped exactly one day. Preserve the streak length without advancing.
    return { length: prev.length, cash: 0, xp: 0, reset: false, advanced: false }
  }

  // gap === 1 — the normal happy path. Advance.
  const length = prev.length + 1
  const r = rewardForStreakDay(length)
  return { length, cash: r.cash, xp: r.xp, reset: false, advanced: true }
}

/**
 * A short label for the player's current streak, for HUD chips.
 * Pure string formatting — the UI owns presentation.
 */
export function streakLabel(length: number): string {
  if (length <= 1) return '1-day streak'
  if (length === 7) return '1-week streak 🔥'
  if (length === 14) return '2-week streak 🔥'
  if (length === 30) return '1-month streak 🔥'
  if (length >= 100) return `${length}-day streak 👑`
  return `${length}-day streak`
}
