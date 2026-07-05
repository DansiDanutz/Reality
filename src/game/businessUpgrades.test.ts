import { describe, expect, test } from 'vitest'
import {
  incomeAtLevel,
  MAX_BUSINESS_LEVEL,
  totalInvested,
  upgradeCost,
  upgradeOutcome,
  UPGRADE_COST_MULT,
} from './businessUpgrades'

describe('upgradeCost — geometric curve', () => {
  test('cost(1→2) = base × 4', () => {
    expect(upgradeCost(100, 1)).toBe(400)
  })

  test('cost escalates by 4× per level', () => {
    // cost(L→L+1) / cost(L-1→L) === 4
    for (let l = 2; l < 8; l++) {
      const prev = upgradeCost(100, l - 1)!
      const curr = upgradeCost(100, l)!
      expect(Math.round(curr / prev)).toBe(UPGRADE_COST_MULT)
    }
  })

  test('returns null at or above the cap', () => {
    expect(upgradeCost(100, MAX_BUSINESS_LEVEL)).toBeNull()
    expect(upgradeCost(100, MAX_BUSINESS_LEVEL + 5)).toBeNull()
  })

  test('returns null below level 1', () => {
    expect(upgradeCost(100, 0)).toBeNull()
    expect(upgradeCost(100, -1)).toBeNull()
  })
})

describe('incomeAtLevel — linear scaling', () => {
  test('level 1 = base, level N = N × base', () => {
    expect(incomeAtLevel(100, 1)).toBe(100)
    expect(incomeAtLevel(100, 5)).toBe(500)
    expect(incomeAtLevel(100, 10)).toBe(1000)
  })

  test('clamps to base for level < 1', () => {
    expect(incomeAtLevel(100, 0)).toBe(100)
    expect(incomeAtLevel(100, -3)).toBe(100)
  })
})

describe('upgradeOutcome — the full picture', () => {
  test('returns the cost, new level, new income, and delta', () => {
    const out = upgradeOutcome(100, 1)
    expect(out).toEqual({ cost: 400, newLevel: 2, newIncome: 200, incomeDelta: 100 })
  })

  test('returns null at the cap', () => {
    expect(upgradeOutcome(100, MAX_BUSINESS_LEVEL)).toBeNull()
  })

  test('income delta is always the base income (linear curve)', () => {
    // Each upgrade adds exactly 1 level = 1× base income.
    for (let l = 1; l < 8; l++) {
      const out = upgradeOutcome(100, l)!
      expect(out.incomeDelta).toBe(100)
    }
  })
})

describe('totalInvested — cumulative spend', () => {
  test('level 1 has zero invested (no upgrades yet)', () => {
    expect(totalInvested(100, 1)).toBe(0)
  })

  test('level 2 invested = cost(1→2)', () => {
    expect(totalInvested(100, 2)).toBe(400)
  })

  test('level 3 invested = cost(1→2) + cost(2→3)', () => {
    expect(totalInvested(100, 3)).toBe(400 + 1600)
  })

  test('invested grows geometrically (the idle-game deceleration)', () => {
    // Each level's marginal cost should exceed the previous.
    const v3 = totalInvested(100, 3)
    const v4 = totalInvested(100, 4)
    const v5 = totalInvested(100, 5)
    expect(v4 - v3).toBeGreaterThan(v3 - v2(v3))
    expect(v5 - v4).toBeGreaterThan(v4 - v3)
  })
})

function v2(v3: number): number {
  // Helper: given totalInvested(100, 3) = 2000, derive totalInvested(100, 2).
  // v3 = v2 + cost(2→3) = v2 + 1600 → v2 = v3 - 1600.
  return v3 - 1600
}

describe('payback bounds — the soft cap', () => {
  test('early upgrades pay back quickly, late ones slowly', () => {
    // Payback (days to recoup the upgrade cost via the added income):
    //   payback(L→L+1) = cost(L) / baseIncome = 4^L days.
    // L1→L2 = 4 days, L3→L4 = 64 days, L6→L7 = 4096 days.
    expect(upgradeCost(100, 1)! / 100).toBe(4) // 4 days
    expect(upgradeCost(100, 3)! / 100).toBe(64) // ~2 months
    expect(upgradeCost(100, 6)! / 100).toBe(4096) // ~11 years — soft cap
  })

  test('a typical food cart (base $230) at level 4 earns $920/day', () => {
    expect(incomeAtLevel(230, 4)).toBe(920)
  })
})
