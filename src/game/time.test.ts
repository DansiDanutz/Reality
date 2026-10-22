import { afterEach, describe, expect, test, vi } from 'vitest'
import { anchorGameClock, gameNow, rebaseTimestamps, resetGameClock, rewindPolicy } from './time'

afterEach(() => {
  resetGameClock()
  vi.useRealTimers()
})

describe('game clock', () => {
  test('once anchored, advances with real elapsed time and ignores device clock changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    expect(gameNow()).toBe(1_000_000) // unanchored: the device clock
    anchorGameClock(5_000_000)
    vi.advanceTimersByTime(60_000) // a real minute passes
    expect(gameNow()).toBe(5_060_000)
    vi.setSystemTime(1_000_000 + 8 * 3_600_000) // someone moves the phone eight hours forward
    expect(gameNow()).toBe(5_060_000)
    resetGameClock()
    expect(gameNow()).toBe(Date.now())
  })

  test('anchored time is whole milliseconds, like Date.now()', () => {
    vi.useFakeTimers()
    anchorGameClock(1_000_000, performance.now() - 0.4)
    vi.advanceTimersByTime(0.7)
    expect(Number.isSafeInteger(gameNow())).toBe(true)
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
