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
