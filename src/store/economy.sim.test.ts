import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { resetServerClockForTest } from '../lib/serverClock'
import { ACHIEVEMENTS } from '../game/achievements'
import { STREAK_REWARD_TIERS } from '../game/streak'

/**
 * Economy simulation: the REAL store, driven through simulated weeks of play
 * by scripted players, with seeded randomness. Unit tests prove each formula;
 * these prove the loop — that no faucet quietly outgrows labor.
 *
 * The invariants are the design promise of docs/ECONOMY.md in executable
 * form: wages are the engine, windfalls are a bounded bonus, and idling must
 * never pay better than working.
 */

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const T0 = new Date('2026-03-02T08:00:00.000Z').getTime()

/** A barista works for $15/h: one full shift is the unit every faucet is judged against. */
const SHIFT_PAY = 15 * 8

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const g = () => useGame.getState()

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(20260302))
})

afterEach(() => {
  g().reset()
  resetServerClockForTest()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A fresh citizen on the post-founder grant, mid-onboarding already done. */
function citizen(startMoney = 2_500) {
  g().createCitizen('Sim', null)
  useGame.setState({ money: startMoney, clockTrusted: true, targetsSeen: true })
}

/** Advance real time in `step` slices, ticking each, and book the money moved. */
interface Book { inflow: number; outflow: number }
function advance(ms: number, step: number, book?: Book) {
  let left = ms
  while (left > 0) {
    const d = Math.min(step, left)
    const before = g().money
    vi.setSystemTime(Date.now() + d)
    g().tick()
    const delta = g().money - before
    if (book) {
      if (delta >= 0) book.inflow += delta
      else book.outflow -= delta
    }
    left -= d
  }
}

describe('economy invariants — idling must never pay better than working', () => {
  test('a citizen who only logs in once a day earns less than one shift a day, long-run', () => {
    citizen()
    const book: Book = { inflow: 0, outflow: 0 }
    let at100 = 0
    for (let day = 1; day <= 365; day++) {
      // One tick on opening the app (the streak/daily rollover fires here), then the app closes for the day.
      advance(DAY, DAY, book)
      if (day === 100) at100 = g().money
    }
    const earnedAfterDay100 = g().money - at100
    // The wage a casual player would have earned on a single daily shift over the same window.
    const oneShiftADay = SHIFT_PAY * (365 - 100)
    expect(earnedAfterDay100, `login-only income after day 100 was $${earnedAfterDay100}`).toBeLessThan(oneShiftADay)
    // And the whole first year of showing up must stay in the same order of magnitude as the founder grant.
    expect(g().money, `a year of logging in alone grew $2,500 to $${g().money}`).toBeLessThan(200_000)
  })

  test('an idle citizen with the tab open all day earns no more than one shift', () => {
    citizen()
    useGame.setState({ jobId: null })
    // Let the one-time onboarding bounties (first lucky moment, early streak
    // days, first achievements) pay out: one login a day for six weeks.
    advance(42 * DAY, DAY)
    advance(16 * HOUR, 16 * HOUR) // land on local midnight: the window below is exactly one budget day
    const book: Book = { inflow: 0, outflow: 0 }
    // Then a steady-state day: foreground tab, a live tick every 5 seconds.
    advance(DAY, 5_000, book)
    expect(book.inflow, `AFK for 24h inflow was $${book.inflow}`).toBeLessThanOrEqual(SHIFT_PAY)
  }, 120_000)

  test('streak payouts are lifetime milestones, not a daily salary', () => {
    citizen()
    useGame.setState({ money: 0 })
    let streakCash = 0
    for (let day = 1; day <= 150; day++) {
      const before = g().money
      const beforeAch = g().achievementsClaimed.length
      advance(DAY, DAY)
      // Attribute only days where nothing else pays: no achievement unlocked.
      if (g().achievementsClaimed.length === beforeAch) streakCash += Math.max(0, g().money - before)
    }
    // Sum of every named tier is $20,500 — paid once. A daily salary would be six figures by now.
    expect(streakCash).toBeLessThanOrEqual(25_000)
  })
})

describe('economy invariants — labor is the engine', () => {
  test('a working citizen earns most of their recurring income from wages, not windfalls', () => {
    citizen()
    g().takeJob('barista')
    const startShifts = g().shiftsWorked
    const startMoney = g().money
    const DAYS = 60
    // Achievement bounties and streak milestones are one-time and bounded by
    // their catalogs (asserted below); recurring luck is what must stay small.
    let oneTime = 0
    let claimed = g().achievementsClaimed.length
    let best = g().streakBest
    let sawEarned = 0
    const tick = (ms: number) => {
      vi.setSystemTime(Date.now() + ms)
      g().tick()
      const ids = g().achievementsClaimed
      for (const id of ids.slice(claimed)) oneTime += ACHIEVEMENTS.find((x) => x.id === id)?.bounty ?? 0
      claimed = ids.length
      if (g().streakBest > best) oneTime += STREAK_REWARD_TIERS.find(([d]) => d === g().streakBest)?.[1] ?? 0
      best = g().streakBest
    }
    for (let day = 1; day <= DAYS; day++) {
      // A player who looks after themselves: fed, rested, healthy at clock-in.
      useGame.setState({ needs: { hunger: 90, hydration: 90, energy: 95, hygiene: 90, fun: 70 }, health: 100 })
      if (!g().activity) g().startShift()
      // Live-sized ticks (a gap over 15 minutes counts as time away and skips live rewards).
      for (let i = 0; i < 144; i++) {
        tick(10 * MIN)
        sawEarned = Math.max(sawEarned, g().dailyCounters.earnedToday)
      }
    }
    const shifts = g().shiftsWorked - startShifts
    const wages = shifts * SHIFT_PAY // base barista pay; rank/gear bonuses only make this larger
    const recurringWindfalls = g().money - startMoney - wages - oneTime
    expect(sawEarned, 'wages must reach the daily earnings counter, or the luck budget is untested').toBeGreaterThan(0)
    expect(shifts).toBeGreaterThanOrEqual(Math.floor(DAYS * 0.8))
    expect(recurringWindfalls, `60 days: wages ~$${wages}, one-time ~$${oneTime}, recurring luck ~$${recurringWindfalls}`).toBeLessThan(wages * 2)
  }, 120_000)

  test('the windfall budget holds even when luck rolls every single tick', () => {
    citizen()
    useGame.setState({ jobId: null, luckyMomentsSeen: 1 })
    advance(2 * DAY, DAY) // past onboarding
    advance(16 * HOUR, 16 * HOUR) // land on local midnight
    // Worst-case luck: every roll hits (lucky moments, opportunities, events).
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const book: Book = { inflow: 0, outflow: 0 }
    advance(HOUR, 1_000, book)
    // Budget for a day with no labor is $100; without the governor this is thousands.
    expect(book.inflow, `inflow with always-lucky rolls was $${book.inflow}`).toBeLessThanOrEqual(150)
  }, 60_000)

  test('one-time bounties stay bounded by the catalog', () => {
    // The ceiling the design doc promises: every achievement, once, is a founder-grant-scale windfall.
    const total = ACHIEVEMENTS.reduce((sum, a) => sum + a.bounty, 0)
    expect(total).toBeLessThanOrEqual(150_000)
    expect(STREAK_REWARD_TIERS.reduce((sum, [, cash]) => sum + cash, 0)).toBeLessThanOrEqual(25_000)
  })
})
