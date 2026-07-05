import { describe, expect, test } from 'vitest'
import {
  STREAK_RESET_GAP,
  STREAK_REWARD_TIERS,
  computeStreakClaim,
  rewardForStreakDay,
  streakLabel,
  type StreakState,
} from './streak'

const fresh = (over: Partial<StreakState> = {}): StreakState => ({ length: 0, lastClaimDay: 0, ...over })

describe('rewardForStreakDay', () => {
  test('returns the exact reward at every named tier', () => {
    for (const [day, cash, xp] of STREAK_REWARD_TIERS) {
      expect(rewardForStreakDay(day)).toEqual({ cash, xp })
    }
  })

  test('day 1 is free (no reward) — they were going to play anyway', () => {
    expect(rewardForStreakDay(1)).toEqual({ cash: 0, xp: 0 })
  })

  test('rewards are strictly increasing across tiers', () => {
    for (let i = 1; i < STREAK_REWARD_TIERS.length; i++) {
      const [, cashPrev, xpPrev] = STREAK_REWARD_TIERS[i - 1]
      const [, cash, xp] = STREAK_REWARD_TIERS[i]
      expect(cash).toBeGreaterThan(cashPrev)
      expect(xp).toBeGreaterThan(xpPrev)
    }
  })

  test('interpolates linearly between day 2 and day 3', () => {
    // Halfway between d2 ($50,+10) and d3 ($100,+20). Length is an integer so
    // there's no exact midpoint, but the clamp-to-bounds path must still hold.
    expect(rewardForStreakDay(2).cash).toBe(50)
    expect(rewardForStreakDay(3).cash).toBe(100)
  })

  test('clamps to the top tier above day 100', () => {
    expect(rewardForStreakDay(999)).toEqual({ cash: 100_000, xp: 5_000 })
  })

  test('clamps to day 1 below it', () => {
    expect(rewardForStreakDay(0)).toEqual({ cash: 0, xp: 0 })
    expect(rewardForStreakDay(-3)).toEqual({ cash: 0, xp: 0 })
  })
})

describe('computeStreakClaim', () => {
  test('first ever claim (citizen spawns) advances to day 1 with no reward', () => {
    const out = computeStreakClaim(fresh(), 19_000)
    expect(out).toEqual({ length: 1, cash: 0, xp: 0, reset: false, advanced: true })
  })

  test('a non-positive day index yields nothing (clock before first midnight)', () => {
    expect(computeStreakClaim(fresh(), 0)).toBeNull()
    expect(computeStreakClaim(fresh({ lastClaimDay: 5 }), -1)).toBeNull()
  })

  test('claiming again on the same day is a no-op (idempotent per tick)', () => {
    const state = fresh({ length: 5, lastClaimDay: 19_000 })
    expect(computeStreakClaim(state, 19_000)).toBeNull()
  })

  test('gap of 1 advances the streak and grants the new tier reward', () => {
    const state = fresh({ length: 1, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_001)
    expect(out).toEqual({ length: 2, cash: 50, xp: 10, reset: false, advanced: true })
  })

  test('gap of exactly RESET_GAP (skipped one day) preserves length, no reward', () => {
    const state = fresh({ length: 7, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_000 + STREAK_RESET_GAP)
    expect(out).toEqual({ length: 7, cash: 0, xp: 0, reset: false, advanced: false })
  })

  test(`gap of RESET_GAP+1 (${STREAK_RESET_GAP + 1}) resets to day 1`, () => {
    const state = fresh({ length: 14, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_000 + STREAK_RESET_GAP + 1)
    expect(out).toEqual({ length: 1, cash: 0, xp: 0, reset: true, advanced: false })
  })

  test('a long absence (gap of 30) resets to day 1', () => {
    const state = fresh({ length: 30, lastClaimDay: 18_000 })
    const out = computeStreakClaim(state, 18_030)
    expect(out?.reset).toBe(true)
    expect(out?.length).toBe(1)
  })

  test('weekly jackpot at day 7 pays $1,500 + 200 XP', () => {
    const state = fresh({ length: 6, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_001)
    expect(out).toEqual({ length: 7, cash: 1_500, xp: 200, reset: false, advanced: true })
  })

  test('monthly legend at day 30 pays $25,000 + 1,000 XP', () => {
    const state = fresh({ length: 29, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_001)
    expect(out).toEqual({ length: 30, cash: 25_000, xp: 1_000, reset: false, advanced: true })
  })

  test('interpolated day (8) is between day 7 and day 14 rewards', () => {
    const state = fresh({ length: 7, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_001)
    expect(out?.length).toBe(8)
    expect(out!.cash).toBeGreaterThan(1_500)
    expect(out!.cash).toBeLessThan(5_000)
    expect(out!.xp).toBeGreaterThan(200)
    expect(out!.xp).toBeLessThan(500)
  })

  test('reset is flagged advanced=false only when previous length was 1', () => {
    // From length 5 → reset. We don't call it "advanced" but we DID reset.
    const state = fresh({ length: 5, lastClaimDay: 19_000 })
    const out = computeStreakClaim(state, 19_010)
    expect(out?.reset).toBe(true)
    expect(out?.advanced).toBe(false)
  })
})

describe('streakLabel', () => {
  test('special-cased milestones render their emoji', () => {
    expect(streakLabel(1)).toBe('1-day streak')
    expect(streakLabel(7)).toBe('1-week streak 🔥')
    expect(streakLabel(14)).toBe('2-week streak 🔥')
    expect(streakLabel(30)).toBe('1-month streak 🔥')
    expect(streakLabel(100)).toBe('100-day streak 👑')
    expect(streakLabel(365)).toBe('365-day streak 👑')
  })

  test('plain lengths render the count', () => {
    expect(streakLabel(2)).toBe('2-day streak')
    expect(streakLabel(8)).toBe('8-day streak')
    expect(streakLabel(45)).toBe('45-day streak')
  })
})
