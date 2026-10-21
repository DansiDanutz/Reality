import { afterEach, describe, expect, test } from 'vitest'
import { gameNow, rebaseTimestamps, rewindPolicy, setGameClockOffset } from './time'

afterEach(() => setGameClockOffset(0))

describe('game clock', () => {
  test('reads the device clock plus the trusted offset', () => {
    const before = Date.now()
    setGameClockOffset(-3_600_000)
    expect(gameNow()).toBeLessThanOrEqual(Date.now() - 3_600_000 + 5)
    expect(gameNow()).toBeGreaterThanOrEqual(before - 3_600_000)
    setGameClockOffset(Number.NaN)
    expect(Math.abs(gameNow() - Date.now())).toBeLessThan(5)
  })

  test('advances forward time, re-anchors small rewinds, freezes large ones', () => {
    expect(rewindPolicy(2_000, 1_000)).toBe('advance')
    expect(rewindPolicy(1_000, 1_000)).toBe('reanchor')
    expect(rewindPolicy(1_000, 1_000 + 5 * 60_000)).toBe('reanchor')
    expect(rewindPolicy(1_000, 1_000 + 5 * 60_000 + 1)).toBe('freeze')
  })

  test('rebases every timestamp and nothing else', () => {
    const T = 1_800_000_000_000
    const state = {
      lastSeenAt: T,
      money: 5_000,
      courierLastDay: 20_500,
      activity: { kind: 'work', startedAt: T, endsAt: T + 8 * 3_600_000, minutes: 480 },
      groceryRestockedAt: { bread: T, milk: T - 1 },
      constructionProjects: [{ placedAt: T, workerContracts: [{ hiredAt: T, paidUntil: T }] }],
      citizen: { name: 'Ada', createdAt: T, founderNumber: 12 },
      log: ['Day 1'],
      dismissedOfflineAt: null,
    }
    const out = rebaseTimestamps(state, -60_000)
    expect(out).toEqual({
      ...state,
      lastSeenAt: T - 60_000,
      activity: { kind: 'work', startedAt: T - 60_000, endsAt: T + 8 * 3_600_000 - 60_000, minutes: 480 },
      groceryRestockedAt: { bread: T - 60_000, milk: T - 1 - 60_000 },
      constructionProjects: [{ placedAt: T - 60_000, workerContracts: [{ hiredAt: T - 60_000, paidUntil: T - 60_000 }] }],
      citizen: { name: 'Ada', createdAt: T - 60_000, founderNumber: 12 },
    })
    expect(out.log).toBe(state.log)
    expect(rebaseTimestamps(state, 0)).toBe(state)
  })
})
