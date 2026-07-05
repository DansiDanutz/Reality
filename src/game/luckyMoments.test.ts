import { describe, expect, test } from 'vitest'
import {
  LUCKY_MOMENT_CHANCE,
  LUCKY_MOMENT_COUNT,
  LUCKY_MOMENT_DEFS,
  RARITY_META,
  pickFirstLuckyMoment,
  pickLuckyMoment,
  rollLuckyMoment,
} from './luckyMoments'

// Deterministic RNG helpers — these tests must be reproducible.
const always = (v: number) => () => v
const cycle = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('rollLuckyMoment — chance gate', () => {
  test('returns null when the chance roll exceeds the threshold', () => {
    // rng() = 1.0 is always above LUCKY_MOMENT_CHANCE → no moment.
    expect(rollLuckyMoment(always(1.0))).toBeNull()
    expect(rollLuckyMoment(always(0.999))).toBeNull()
  })

  test('returns a moment when the chance roll is at/below the threshold', () => {
    // First call: rng() = 0 (passes the gate). Second call: weighted pick
    // lands on the first def, cash roll also 0 → cashMin.
    const out = rollLuckyMoment(always(0))
    expect(out).not.toBeNull()
    expect(out!.money).toBeGreaterThan(0)
    expect(out!.xp).toBeGreaterThan(0)
  })

  test('the configured chance is rare (≤ 0.1% per tick)', () => {
    // Guard against accidentally making jackpots common — they must stay rare
    // or the dopamine curve (and the economy) breaks.
    expect(LUCKY_MOMENT_CHANCE).toBeLessThanOrEqual(0.001)
    expect(LUCKY_MOMENT_CHANCE).toBeGreaterThan(0) // not zero — feature disabled check
  })
})

describe('rollLuckyMoment — rewards', () => {
  test('cash is always within the chosen tier bounds', () => {
    // Sweep many rolls; every result must respect some def's [min, max].
    let seed = 0.12345
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    let hits = 0
    for (let i = 0; i < 50_000; i++) {
      const out = rollLuckyMoment(rng)
      if (!out) continue
      hits++
      const def = LUCKY_MOMENT_DEFS.find((d) => d.id === out.id)
      expect(def, `unknown moment id ${out.id}`).toBeDefined()
      expect(out.money).toBeGreaterThanOrEqual(def!.cashMin)
      expect(out.money).toBeLessThanOrEqual(def!.cashMax)
    }
    // Sanity: with 50k rolls at ~0.05% we expect ~25 hits. Allow wide bounds.
    expect(hits).toBeGreaterThan(5)
  })

  test('xp is roughly cash / 50 (the documented ratio)', () => {
    const out = rollLuckyMoment(cycle(0, 0.5, 0.5)) // gate passes, pick mid-pool, cash mid-range
    if (out) {
      expect(out.xp).toBe(Math.round(out.money / 50))
    }
  })

  test('cash is rounded to the nearest $50 (no ugly amounts)', () => {
    // 1000 attempts; every reward must be a multiple of 50.
    let seed = 0.5
    const rng = () => {
      seed = (seed * 0.987 + 0.123) % 1
      return seed
    }
    for (let i = 0; i < 1_000; i++) {
      const out = rollLuckyMoment(rng)
      if (out) expect(out.money % 50).toBe(0)
    }
  })
})

describe('pickFirstLuckyMoment — first-session guarantee', () => {
  test('only picks tier-1 lucky moments', () => {
    for (const rng of [always(0), always(0.5), always(0.999)]) {
      const out = pickFirstLuckyMoment(rng)
      expect(out.rarity).toBe('lucky')
      const def = LUCKY_MOMENT_DEFS.find((d) => d.id === out.id)!
      expect(def.rarity).toBe('lucky')
      expect(out.money).toBeGreaterThanOrEqual(def.cashMin)
      expect(out.money).toBeLessThanOrEqual(def.cashMax)
    }
  })
})

describe('rollLuckyMoment — pool invariants', () => {
  test('every moment id is unique', () => {
    const ids = LUCKY_MOMENT_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every tier has at least one moment', () => {
    const tiers = new Set(LUCKY_MOMENT_DEFS.map((d) => d.rarity))
    expect(tiers.has('lucky')).toBe(true)
    expect(tiers.has('rare')).toBe(true)
    expect(tiers.has('legendary')).toBe(true)
  })

  test('cashMin ≤ cashMax for every def, and tiers are strictly separated', () => {
    for (const d of LUCKY_MOMENT_DEFS) {
      expect(d.cashMin).toBeLessThanOrEqual(d.cashMax)
    }
    // Tier ceilings: lucky < rare < legendary. No overlap.
    const luckyMax = Math.max(...LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'lucky').map((d) => d.cashMax))
    const rareMin = Math.min(...LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'rare').map((d) => d.cashMin))
    const rareMax = Math.max(...LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'rare').map((d) => d.cashMax))
    const legendMin = Math.min(...LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'legendary').map((d) => d.cashMin))
    expect(luckyMax).toBeLessThan(rareMin)
    expect(rareMax).toBeLessThan(legendMin)
  })

  test('no single moment dominates the pool weight (anti-monotony)', () => {
    const total = LUCKY_MOMENT_DEFS.reduce((s, d) => s + d.weight, 0)
    for (const d of LUCKY_MOMENT_DEFS) {
      // No def should be more than 40% of rolls — keeps variety high.
      expect(d.weight / total).toBeLessThan(0.4)
    }
  })

  test('legendary moments are the rarest (weight ≤ lucky weight)', () => {
    const legendWeight = LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'legendary').reduce((s, d) => s + d.weight, 0)
    const luckyWeight = LUCKY_MOMENT_DEFS.filter((d) => d.rarity === 'lucky').reduce((s, d) => s + d.weight, 0)
    expect(legendWeight).toBeLessThan(luckyWeight)
  })

  test('count constant matches the pool length', () => {
    expect(LUCKY_MOMENT_COUNT).toBe(LUCKY_MOMENT_DEFS.length)
  })

  test('every rarity has metadata', () => {
    expect(RARITY_META.lucky.icon).toBeTruthy()
    expect(RARITY_META.rare.icon).toBeTruthy()
    expect(RARITY_META.legendary.icon).toBeTruthy()
  })

  test('legendary top reward ≤ $50k (economy guard)', () => {
    const top = Math.max(...LUCKY_MOMENT_DEFS.map((d) => d.cashMax))
    expect(top).toBeLessThanOrEqual(50_000)
  })
})

describe('rollLuckyMoment — weighted distribution', () => {
  test('total weight matches the documented sum (regression guard)', () => {
    // If someone adds a moment without checking the weight balance, this
    // catches it. The expected EV/tick in luckyMoments.ts assumes this sum.
    const total = LUCKY_MOMENT_DEFS.reduce((s, d) => s + d.weight, 0)
    // lucky (24+22+20+22=88) + rare (8+8+6+5=27) + legendary (2+2=4) = 119
    expect(total).toBe(119)
  })

  test('every moment is reachable (weight > 0 — no dead moments)', () => {
    // Statistical reachability tests are flaky for weight=2 legendary moments
    // (200k rolls × 0.05% × 1.7% ≈ 1.7 expected hits). Instead we assert the
    // structural invariant: every def has positive weight, so the weighted
    // sampler can never exclude it. Combined with the "no single moment > 40%"
    // and "legendary < lucky" invariants above, this fully constrains the
    // distribution without depending on RNG luck.
    for (const def of LUCKY_MOMENT_DEFS) {
      expect(def.weight, `moment ${def.id} has zero weight`).toBeGreaterThan(0)
    }
  })

  test('weighted sampling produces a sensible distribution (pickLuckyMoment)', () => {
    // Use pickLuckyMoment directly (no chance gate) so we get enough samples
    // to assert the tier ordering deterministically with Math.random.
    const counts = { lucky: 0, rare: 0, legendary: 0 }
    for (let i = 0; i < 5_000; i++) {
      counts[pickLuckyMoment().rarity]++
    }
    // Lucky (88/119 ≈ 74%) should beat rare (27/119 ≈ 23%) should beat
    // legendary (4/119 ≈ 3%). With 5k samples these orderings are robust.
    expect(counts.lucky).toBeGreaterThan(counts.rare)
    expect(counts.rare).toBeGreaterThan(counts.legendary)
    expect(counts.legendary).toBeGreaterThan(0)
  })
})
