import { describe, expect, test } from 'vitest'
import { boxEV, creditTierForSeriousWorkStreak, freshMysteryBoxCredits, MYSTERY_BOXES, MYSTERY_BOX_TIERS, openBox } from './mysteryBox'

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

describe('boxEV — transparent average reward', () => {
  test('boxes require earned credits instead of cash costs', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      expect(MYSTERY_BOXES[tier].creditsRequired).toBe(1)
      expect('cost' in MYSTERY_BOXES[tier]).toBe(false)
    }
  })

  test('average rewards stay visible without comparing against a paid stake', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const ev = boxEV(tier)
      expect(ev, `${tier}: average reward`).toBeGreaterThan(0)
    }
  })

  test('credit ledgers normalize missing and fractional values', () => {
    expect(freshMysteryBoxCredits({ standard: 2.9, premium: -1 })).toEqual({
      standard: 2,
      premium: 0,
      legendary: 0,
    })
  })

  test('serious-work milestones award higher credits without cash purchases', () => {
    expect(creditTierForSeriousWorkStreak(4)).toBeNull()
    expect(creditTierForSeriousWorkStreak(5)).toBe('premium')
    expect(creditTierForSeriousWorkStreak(19)).toBeNull()
    expect(creditTierForSeriousWorkStreak(20)).toBe('legendary')
    expect(creditTierForSeriousWorkStreak(20.9)).toBe('legendary')
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

  test('top grant is visibly larger than the tier average', () => {
    for (const tier of MYSTERY_BOX_TIERS()) {
      const r = openBox(tier, always(0.999))
      expect(r.cash).toBeGreaterThan(boxEV(tier))
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
