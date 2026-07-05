import { describe, expect, test } from 'vitest'
import { OPPORTUNITY_CHANCE, OPPORTUNITY_WINDOW_MS, rollOpportunity } from './goldenOpportunity'

const always = (v: number) => () => v

describe('rollOpportunity — spawning', () => {
  test('returns null when chance roll exceeds threshold', () => {
    expect(rollOpportunity(always(0.5))).toBeNull()
    expect(rollOpportunity(always(0.999))).toBeNull()
  })

  test('returns an opportunity when chance roll is at/below threshold', () => {
    // First rng() call is the gate; second picks from the pool.
    // always(0) → passes gate, picks pool[0].
    const out = rollOpportunity(always(0))
    expect(out).not.toBeNull()
    expect(out!.cash).toBeGreaterThan(0)
    expect(out!.xp).toBeGreaterThan(0)
    expect(out!.label.length).toBeGreaterThan(5)
    expect(out!.icon.length).toBeGreaterThan(0)
    expect(out!.id).toMatch(/^opp-/)
  })

  test('the configured chance is rare (≤ 0.02% per tick)', () => {
    // ~every 12 min at 1 tick/sec — rare enough to feel special.
    expect(OPPORTUNITY_CHANCE).toBeLessThanOrEqual(0.002)
    expect(OPPORTUNITY_CHANCE).toBeGreaterThan(0)
  })

  test('the window is reasonable (10-30 seconds)', () => {
    expect(OPPORTUNITY_WINDOW_MS).toBeGreaterThanOrEqual(10_000)
    expect(OPPORTUNITY_WINDOW_MS).toBeLessThanOrEqual(30_000)
  })
})

describe('rollOpportunity — variety', () => {
  test('different rng values produce different opportunities (not always [0])', () => {
    // Force the gate to pass (first rng call = 0), let the pool pick use Math.random.
    // With 100 forced spawns, we should see variety across the pool.
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      let first = true
      const out = rollOpportunity(() => first ? (first = false, 0) : Math.random())
      if (out) seen.add(out.label)
    }
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })

  test('every opportunity has positive cash + xp', () => {
    let seed = 0.5
    const rng = () => {
      seed = (seed * 1.13 + 0.07) % 1
      return seed
    }
    for (let i = 0; i < 5000; i++) {
      const out = rollOpportunity(rng)
      if (out) {
        expect(out.cash).toBeGreaterThan(0)
        expect(out.xp).toBeGreaterThan(0)
      }
    }
  })
})
