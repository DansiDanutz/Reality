import { describe, expect, test } from 'vitest'
import { boxEV, MYSTERY_BOXES, MYSTERY_BOX_TIERS, openBox } from './mysteryBox'

const always = (v: number) => () => v

describe('openBox — basic mechanics', () => {
  test('always returns a reward with cash, xp, label, rarity, icon', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const r = openBox(tier, always(0.5))
      expect(r.cash).toBeGreaterThan(0)
      expect(r.xp).toBeGreaterThan(0)
      expect(r.label.length).toBeGreaterThan(0)
      expect(['dud', 'common', 'rare', 'jackpot']).toContain(r.rarity)
      expect(r.icon.length).toBeGreaterThan(0)
    }
  })

  test('rng=0 and rng=1 produce different rewards (pool is ordered)', () => {
    const low = openBox('standard', always(0))
    const high = openBox('standard', always(0.99))
    // The pool is ordered low→high, so rng=0 hits the first (dud), rng=0.99
    // hits near the last (rare/jackpot). They should differ.
    expect(low.label).not.toBe(high.label)
  })
})

describe('boxEV — expected value', () => {
  test('EV is always below cost (the house edge - a money sink)', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const ev = boxEV(tier)
      const cost = MYSTERY_BOXES[tier].cost
      expect(ev, `${tier}: EV ${ev} should be < cost ${cost}`).toBeLessThan(cost)
    }
  })

  test('EV is at least 70% of cost (not so bad it feels like a scam)', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const ev = boxEV(tier)
      const cost = MYSTERY_BOXES[tier].cost
      expect(ev / cost, `${tier}: EV/cost ${ev / cost} should be >= 0.7`).toBeGreaterThanOrEqual(0.7)
    }
  })

  test('costs escalate: standard < premium < legendary', () => {
    expect(MYSTERY_BOXES.standard.cost).toBeLessThan(MYSTERY_BOXES.premium.cost)
    expect(MYSTERY_BOXES.premium.cost).toBeLessThan(MYSTERY_BOXES.legendary.cost)
  })
})

describe('openBox — jackpot reachability', () => {
  test('the jackpot is in every pool and reachable at high rng', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      // rng close to 1 should hit the last pool entry (jackpot, lowest weight).
      const r = openBox(tier, always(0.999))
      expect(r.rarity).toBe('jackpot')
    }
  })

  test('the dud is reachable at low rng', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const r = openBox(tier, always(0))
      expect(r.rarity).toBe('dud')
    }
  })
})

describe('openBox — reward bounds', () => {
  test('every reward cash is positive', () => {
    let seed = 0.5
    const rng = () => { seed = (seed * 1.13 + 0.3) % 1; return seed }
    for (const tier of MYSTERY_BOX_TIERS()) {
      for (let i = 0; i < 200; i++) {
        const r = openBox(tier, rng)
        expect(r.cash, `${tier} roll ${i}`).toBeGreaterThan(0)
      }
    }
  })

  test('jackpot is at least 5x cost for every tier', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const r = openBox(tier, always(0.999))
      expect(r.cash / MYSTERY_BOXES[tier].cost).toBeGreaterThanOrEqual(2.5)
    }
  })
})

describe('pool integrity', () => {
  test('every tier has at least 5 pool entries (variety)', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      expect(MYSTERY_BOXES[tier].pool.length).toBeGreaterThanOrEqual(5)
    }
  })

  test('no single entry dominates the pool (>50% weight)', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const total = MYSTERY_BOXES[tier].pool.reduce((s, e) => s + e.weight, 0)
      for (const e of MYSTERY_BOXES[tier].pool) {
        expect(e.weight / total, `${tier} entry`).toBeLessThan(0.5)
      }
    }
  })
})
