import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { resetServerClockForTest } from '../lib/serverClock'
import { applyXp } from '../game/engine'
import { ACHIEVEMENTS } from '../game/achievements'
import { TUTORIAL_STEPS } from '../game/tutorial'

/** Regression tests for client-side economy actions that used to trust their caller or their timing. */

const HOUR = 3_600_000
const T0 = new Date('2026-03-02T08:00:00.000Z').getTime()
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
  g().createCitizen('Guard', null)
  useGame.setState({ money: 200_000, clockTrusted: true, targetsSeen: true })
})

afterEach(() => {
  g().reset()
  resetServerClockForTest()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('claims pay what the catalog says, and only when earned', () => {
  test('claimTutorial ignores caller-supplied XP and unknown steps', () => {
    const before = g().level
    // Old signature smuggled an XP number; extra args are ignored and unknown ids pay nothing.
    ;(g().claimTutorial as unknown as (id: string, xp: number) => void)('fake-step', 1e9)
    expect(g().level).toBe(before)
    expect(g().tutorialClaimed).not.toContain('fake-step')
    const step = TUTORIAL_STEPS[0]
    ;(g().claimTutorial as unknown as (id: string, xp: number) => void)(step.id, 1e9)
    expect(g().level).toBeLessThan(before + 5)
    expect(g().tutorialClaimed).toContain(step.id)
  })

  test('claimAchievement refuses a locked achievement', () => {
    const money = g().money
    for (const a of ACHIEVEMENTS) g().claimAchievement(a.id)
    // Only achievements already true of a brand-new citizen may pay; the bulk must not.
    expect(g().money - money).toBeLessThan(5_000)
  })

  test('applyXp shrugs off NaN and Infinity instead of poisoning or hanging', () => {
    expect(applyXp(3, 10, Number.NaN)).toEqual({ level: 3, xp: 10, levelsGained: 0 })
    expect(applyXp(3, 10, Number.POSITIVE_INFINITY)).toEqual({ level: 3, xp: 10, levelsGained: 0 })
    expect(applyXp(3, 10, -50)).toEqual({ level: 3, xp: 10, levelsGained: 0 })
  })
})

describe('items and activities', () => {
  test('the Hot Plate is cooking equipment, not an unlimited free meal', () => {
    g().buy('hotplate')
    const eaten = g().timesEaten
    useGame.setState({ needs: { ...g().needs, hunger: 10 } })
    for (let i = 0; i < 20; i++) g().consume('hotplate')
    expect(g().timesEaten).toBe(eaten)
    expect(g().needs.hunger).toBe(10)
  })

  test('leaving an expired 30-minute gig pays the gig, not an 8-hour shift', () => {
    g().takeJob('barista')
    g().startGig()
    expect(g().activity?.kind).toBe('shift')
    const money = g().money
    vi.setSystemTime(Date.now() + 6 * HOUR) // device slept: no tick resolved the gig
    g().leaveActivity()
    // Barista $15/h × 0.5h ≈ $8; never the ~$90 an 8h clamp would pay.
    expect(g().money - money).toBeLessThanOrEqual(10)
  })

  test('buying a second placeable mid-placement is refused, not charged', () => {
    g().buy('microstudio')
    const placing = g().placing
    const money = g().money
    g().buy('studio')
    expect(g().money).toBe(money)
    expect(g().placing).toEqual(placing)
  })
})

describe('daily slate', () => {
  test("yesterday's claimed challenges reset even when an action runs before the first tick of the day", () => {
    g().tick()
    useGame.setState({ dailyClaimed: ['x', 'y', 'z'], dailyBonusClaimed: true })
    vi.setSystemTime(Date.now() + 26 * HOUR)
    g().buy('water') // advances dailyCounters.day before any tick
    g().tick()
    expect(g().dailyClaimed).not.toContain('x')
    expect(g().dailyBonusClaimed).toBe(false)
  })
})

describe('review regressions', () => {
  test('a boosted 30-minute gig pays its booster, and daily earnings match the cash credited', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // no luck: isolate wages
    const now = Date.now()
    useGame.setState({
      money: 1_000,
      activity: { kind: 'shift', startedAt: now, endsAt: now + 30 * 60_000, wage: 14, title: 'Delivery gig', wageMult: 2 },
    })
    const before = g().dailyCounters.earnedToday
    // Live-sized ticks: a gap over 15 minutes counts as time away and is kept out of daily earnings.
    for (let i = 1; i <= 4; i++) {
      vi.setSystemTime(now + i * 10 * 60_000)
      g().tick()
    }
    expect(g().money - 1_000).toBe(14) // $7 × 2
    expect(g().dailyCounters.earnedToday - before).toBe(14)
    expect(g().shiftsWorked).toBe(0) // still not a career shift
  })

  test('a tick between starting and leaving sleep pays no sleep reward', () => {
    useGame.setState({ timesSlept: 24, needs: { hunger: 80, hydration: 80, energy: 20, hygiene: 80, fun: 80 } })
    g().tick()
    const claimedBefore = [...g().achievementsClaimed]
    const money = g().money
    g().startSleep()
    vi.setSystemTime(Date.now() + 2_000)
    g().tick()
    expect(g().achievementsClaimed).toEqual(claimedBefore)
    expect(g().money).toBe(money)
    g().leaveActivity()
    expect(g().timesSlept).toBe(24)
  })

  test('the save version moved, and a v22 daily-counter shape backfills the new fields', async () => {
    const { migrateSave, SAVE_VERSION } = await import('./gameStore')
    // zustand/persist only runs migrate when the stored version differs: without the bump, v22 saves skip it.
    expect(SAVE_VERSION).toBeGreaterThan(22)
    const dc = { day: 20_000, mealsToday: 0, drinksToday: 0, hygieneToday: 0, shiftsToday: 0, earnedToday: 0, sleptToday: 0, boughtToday: 0, studiedToday: 0, gatheredToday: 0, constructionMinutesToday: 0, workersHiredToday: 0, communityToday: 0, businessDevelopmentMinutesToday: 0 }
    const out = migrateSave({ money: 5_000, dailyCounters: dc, dailyClaimed: ['a'], dailyBonusClaimed: true })
    expect(out.dailyCounters.windfallToday).toBe(0)
    expect(out.dailyClaimedDay).toBe(20_000)
    expect(out.dailyClaimed).toEqual(['a'])
  })
})
