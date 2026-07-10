import { describe, expect, test } from 'vitest'
import { dayOfLife, weekOfLife } from './clock'

const DAY = 86_400_000

describe('life calendar', () => {
  test('day 1 begins at creation; days advance on real 24h boundaries', () => {
    const born = 1_700_000_000_000
    expect(dayOfLife(born, born)).toBe(1)
    expect(dayOfLife(born, born + DAY - 1)).toBe(1)
    expect(dayOfLife(born, born + DAY)).toBe(2)
  })

  test('weeks roll every 7 real days: 1–7 → week 1, 8–14 → week 2', () => {
    const born = 1_700_000_000_000
    expect(weekOfLife(born, born)).toBe(1)
    expect(weekOfLife(born, born + 6 * DAY)).toBe(1) // day 7
    expect(weekOfLife(born, born + 7 * DAY)).toBe(2) // day 8
    expect(weekOfLife(born, born + 13 * DAY)).toBe(2) // day 14
    expect(weekOfLife(born, born + 14 * DAY)).toBe(3) // day 15
  })
})
