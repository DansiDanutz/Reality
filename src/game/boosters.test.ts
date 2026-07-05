import { describe, expect, test } from 'vitest'
import {
  BOOSTER_LIST,
  BOOSTERS,
  boosterMultiplier,
  boosterRemaining,
  cleanExpiredBoosters,
  isBoosterActive,
  type BoosterType,
} from './boosters'

const NOW = 1_000_000
const DUR = 30 * 60_000

const active = (types: BoosterType[], expiresAt = NOW + DUR) =>
  types.map((t) => ({ type: t, expiresAt }))

describe('isBoosterActive', () => {
  test('returns true when the type is active and not expired', () => {
    expect(isBoosterActive(active(['wage']), 'wage', NOW)).toBe(true)
  })

  test('returns false when the type is not in the list', () => {
    expect(isBoosterActive(active(['wage']), 'xp', NOW)).toBe(false)
  })

  test('returns false when expired', () => {
    expect(isBoosterActive(active(['wage'], NOW - 1000), 'wage', NOW)).toBe(false)
  })

  test('returns false for empty list', () => {
    expect(isBoosterActive([], 'wage', NOW)).toBe(false)
  })
})

describe('boosterMultiplier', () => {
  test('returns the multiplier when active', () => {
    expect(boosterMultiplier(active(['wage']), 'wage', NOW)).toBe(2)
  })

  test('returns 1 when not active', () => {
    expect(boosterMultiplier(active([]), 'wage', NOW)).toBe(1)
  })
})

describe('cleanExpiredBoosters', () => {
  test('removes expired boosters', () => {
    const a = [
      { type: 'wage' as BoosterType, expiresAt: NOW + DUR },
      { type: 'xp' as BoosterType, expiresAt: NOW - 1000 },
    ]
    expect(cleanExpiredBoosters(a, NOW)).toEqual([{ type: 'wage', expiresAt: NOW + DUR }])
  })

  test('returns empty when all expired', () => {
    const a = [{ type: 'wage' as BoosterType, expiresAt: NOW - 1 }]
    expect(cleanExpiredBoosters(a, NOW)).toEqual([])
  })

  test('keeps all when none expired', () => {
    const a = active(['wage', 'xp', 'income'])
    expect(cleanExpiredBoosters(a, NOW).length).toBe(3)
  })
})

describe('boosterRemaining', () => {
  test('returns remaining time when active', () => {
    expect(boosterRemaining(active(['wage']), 'wage', NOW)).toBe(DUR)
  })

  test('returns 0 when not active', () => {
    expect(boosterRemaining(active([]), 'wage', NOW)).toBe(0)
  })
})

describe('booster definitions — balance', () => {
  test('all three types exist', () => {
    expect(BOOSTER_LIST).toEqual(['wage', 'xp', 'income'])
  })

  test('costs escalate: xp < wage < income', () => {
    expect(BOOSTERS.xp.cost).toBeLessThan(BOOSTERS.wage.cost)
    expect(BOOSTERS.wage.cost).toBeLessThan(BOOSTERS.income.cost)
  })

  test('all multipliers are 2x', () => {
    for (const t of BOOSTER_LIST) {
      expect(BOOSTERS[t].multiplier).toBe(2)
    }
  })

  test('all durations are 30 minutes', () => {
    for (const t of BOOSTER_LIST) {
      expect(BOOSTERS[t].durationMs).toBe(30 * 60_000)
    }
  })
})
