import { describe, expect, test } from 'vitest'
import { isSameLocalDay, localDayIndex, localDayKey, nextLocalMidnightMs, shouldGrantForLocalDay } from './localDay'

describe('local-day scheduling', () => {
  test('uses the local calendar date rather than UTC date', () => {
    const instant = Date.parse('2024-01-02T00:30:00.000Z')
    expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2024-01-01')
    expect(localDayIndex(instant, 'America/Los_Angeles')).toBe(localDayIndex(Date.parse('2024-01-01T12:00:00.000Z'), 'UTC'))
    expect(isSameLocalDay(instant, Date.parse('2024-01-01T23:59:00.000Z'), 'America/Los_Angeles')).toBe(true)
  })

  test('finds the next midnight across spring-forward DST', () => {
    const now = Date.parse('2024-03-10T06:30:00.000Z')
    expect(nextLocalMidnightMs(now, 'America/New_York')).toBe(Date.parse('2024-03-11T04:00:00.000Z'))
  })

  test('finds the next midnight across fall-back DST', () => {
    const now = Date.parse('2024-11-03T05:30:00.000Z')
    expect(nextLocalMidnightMs(now, 'America/New_York')).toBe(Date.parse('2024-11-04T05:00:00.000Z'))
  })

  test('grants at most once per local calendar day', () => {
    const now = Date.parse('2024-06-15T12:00:00.000Z')
    const day = localDayKey(now, 'Europe/Bucharest')
    expect(shouldGrantForLocalDay(null, now, 'Europe/Bucharest')).toBe(true)
    expect(shouldGrantForLocalDay(day, now + 2 * 3_600_000, 'Europe/Bucharest')).toBe(false)
    expect(shouldGrantForLocalDay(day, now + 24 * 3_600_000, 'Europe/Bucharest')).toBe(true)
  })
})
