import { describe, expect, test } from 'vitest'
import { thoughtForDay, THOUGHT_COUNT } from './thoughts'

describe('thoughtForDay', () => {
  test('returns a non-empty string for any day index', () => {
    for (let d = 0; d < 400; d++) {
      const t = thoughtForDay(d)
      expect(t.length, `day ${d}`).toBeGreaterThan(10)
    }
  })

  test('is deterministic — same day returns the same thought', () => {
    expect(thoughtForDay(19_000)).toBe(thoughtForDay(19_000))
  })

  test('rotates across days (not the same every day)', () => {
    const set = new Set<string>()
    for (let d = 0; d < THOUGHT_COUNT; d++) set.add(thoughtForDay(d))
    // Every thought in the pool should be reachable over the pool's length.
    expect(set.size).toBe(THOUGHT_COUNT)
  })

  test('wraps around for large day indices (no out-of-bounds)', () => {
    expect(() => thoughtForDay(999_999)).not.toThrow()
    expect(thoughtForDay(999_999).length).toBeGreaterThan(0)
  })

  test('handles negative day indices (defensive)', () => {
    expect(() => thoughtForDay(-1)).not.toThrow()
    expect(thoughtForDay(-1).length).toBeGreaterThan(0)
  })
})
