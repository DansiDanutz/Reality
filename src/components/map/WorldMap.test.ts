import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { constructionTimeLabel } from './WorldMap'

describe('WorldMap construction labels', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows remaining time while a beacon is under construction', () => {
    const now = Date.now()
    const label = constructionTimeLabel(now + 2 * 3_600_000 + 15 * 60_000)
    expect(label).toBe('2h 15m remaining')
  })

  test('returns null once construction is done', () => {
    const now = Date.now()
    expect(constructionTimeLabel(now - 1)).toBeNull()
  })
})
