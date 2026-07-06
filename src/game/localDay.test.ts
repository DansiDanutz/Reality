import { describe, expect, test } from 'vitest'
import {
  LOCAL_DAY_MS,
  dailyLocalGrant,
  localDayIndex,
  localDayKey,
  nextLocalDayStartsAt,
} from './localDay'

describe('localDayKey', () => {
  test('uses the area time zone instead of UTC', () => {
    const at = Date.parse('2026-07-06T21:30:00.000Z')

    expect(localDayKey(at, 'UTC')).toBe('2026-07-06')
    expect(localDayKey(at, 'Europe/Bucharest')).toBe('2026-07-07')
  })

  test('falls back to UTC when the time zone is invalid', () => {
    const at = Date.parse('2026-07-06T21:30:00.000Z')

    expect(localDayKey(at, 'Reality/Unknown')).toBe('2026-07-06')
  })

  test('rejects invalid timestamps', () => {
    expect(() => localDayKey(Number.NaN, 'UTC')).toThrow(RangeError)
    expect(() => nextLocalDayStartsAt(Number.POSITIVE_INFINITY, 'UTC')).toThrow(RangeError)
  })
})

describe('localDayIndex', () => {
  test('counts local calendar days, not elapsed local hours', () => {
    const at = Date.parse('2026-07-06T21:30:00.000Z')

    expect(localDayIndex(at, 'Europe/Bucharest')).toBe(Date.parse('2026-07-07T00:00:00.000Z') / LOCAL_DAY_MS)
  })
})

describe('nextLocalDayStartsAt', () => {
  test('returns the next midnight for a normal local day', () => {
    const at = Date.parse('2026-07-06T10:15:30.000Z')
    const next = nextLocalDayStartsAt(at, 'Europe/Bucharest')

    expect(next).toBe(Date.parse('2026-07-06T21:00:00.000Z'))
  })

  test('handles spring-forward days with a 23-hour local day', () => {
    const startOfNewYorkDstDay = Date.parse('2026-03-08T05:00:00.000Z')
    const next = nextLocalDayStartsAt(startOfNewYorkDstDay, 'America/New_York')

    expect(next).toBe(Date.parse('2026-03-09T04:00:00.000Z'))
    expect(next - startOfNewYorkDstDay).toBe(23 * 60 * 60 * 1000)
  })

  test('handles fall-back days with a 25-hour local day', () => {
    const startOfNewYorkFallbackDay = Date.parse('2026-11-01T04:00:00.000Z')
    const next = nextLocalDayStartsAt(startOfNewYorkFallbackDay, 'America/New_York')

    expect(next).toBe(Date.parse('2026-11-02T05:00:00.000Z'))
    expect(next - startOfNewYorkFallbackDay).toBe(25 * 60 * 60 * 1000)
  })
})

describe('dailyLocalGrant', () => {
  test('allows one grant per local day', () => {
    const morning = Date.parse('2026-07-07T06:00:00.000Z')
    const evening = Date.parse('2026-07-07T19:00:00.000Z')
    const tomorrow = Date.parse('2026-07-07T22:00:00.000Z')

    const first = dailyLocalGrant(morning, null, 'Europe/Bucharest')
    expect(first.localDayKey).toBe('2026-07-07')
    expect(first.canGrant).toBe(true)

    expect(dailyLocalGrant(evening, first.localDayKey, 'Europe/Bucharest').canGrant).toBe(false)

    const next = dailyLocalGrant(tomorrow, first.localDayKey, 'Europe/Bucharest')
    expect(next.localDayKey).toBe('2026-07-08')
    expect(next.canGrant).toBe(true)
  })

  test('includes the next local-day boundary for scheduling', () => {
    const at = Date.parse('2026-07-06T21:30:00.000Z')
    const grant = dailyLocalGrant(at, undefined, 'Europe/Bucharest')

    expect(grant.nextLocalDayStartsAt).toBe(Date.parse('2026-07-07T21:00:00.000Z'))
    expect(grant.msUntilNextLocalDay).toBe(23.5 * 60 * 60 * 1000)
  })
})
