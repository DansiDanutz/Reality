import { describe, expect, test } from 'vitest'
import { advanceHealth } from './healthPolicy'

describe('shared health policy', () => {
  test('prioritizes dehydration damage', () => {
    expect(advanceHealth(100, { hydration: 0, hunger: 0, energy: 0 }, 1)).toBe(94)
  })

  test('uses the same neglect law for hunger and exhaustion', () => {
    expect(advanceHealth(100, { hydration: 50, hunger: 0, energy: 50 }, 2)).toBe(94)
    expect(advanceHealth(100, { hydration: 50, hunger: 50, energy: 0 }, 2)).toBe(94)
  })

  test('allows healthy recovery only above the triage thresholds', () => {
    expect(advanceHealth(80, { hydration: 51, hunger: 61, energy: 61 }, 2)).toBe(84)
    expect(advanceHealth(80, { hydration: 50, hunger: 61, energy: 61 }, 2)).toBe(80)
  })
})
