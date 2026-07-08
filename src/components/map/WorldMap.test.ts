import { describe, expect, test } from 'vitest'
import { constructionTimeLabel } from './WorldMap'

describe('WorldMap construction labels', () => {
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
