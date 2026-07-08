import { describe, expect, test } from 'vitest'
import { migrateSave } from './gameStore'
import type { Needs } from '../game/types'

/**
 * Regression tests for save migration. A future edit that adds a field to
 * GameState but forgets the backfill here would silently corrupt every old
 * save on load. These tests pin the post-migrate shape for every version.
 *
 * The strategy: build minimal saves shaped like each historical version,
 * run them through migrateSave, and assert every backfilled field is present
 * with the documented default while every pre-existing field is preserved.
 */

// The oldest possible save — a v1 citizen before hydration/pets/illness/streak.
// Only the fields the original persist wrote; everything else is undefined.
const v1Save = {
  citizen: { name: 'Ada', founderNumber: 1, createdAt: 1_700_000_000_00 },
  money: 50000,
  // v1 needs had no hydration key
  needs: { hunger: 80, energy: 80, hygiene: 80, fun: 70 } as Needs,
  health: 100,
  level: 3,
  xp: 40,
  jobId: 'cafeworker',
  shiftsWorked: 12,
  timesEaten: 5,
  timesSlept: 2,
  totalCollected: 1500,
  tutorialClaimed: ['first-shift'],
  tutorialHidden: false,
  activity: null,
  lastSeenAt: 1_700_000_100_000,
  inventory: { noodles: 2 },
  assets: [],
  groceryRestockedAt: {},
  placing: null,
  panel: null,
  log: ['hi'],
  cloudSyncedAt: null,
  marketFocus: null,
  lastFountainAt: 0,
  lastFoodBankAt: 0,
  targetsSeen: false,
  reachTier: 1,
  toasts: [],
  soundOn: true,
  hudLayout: {},
  hudDockOrder: ['objectives'],
}

describe('migrateSave — backfills every field added after v1', () => {
  test('a v1 save gets all v2–v5 backfills', () => {
    const out = migrateSave({ ...v1Save })
    // v2: hydration need
    expect(out.needs.hydration).toBe(75)
    // v3: pets
    expect(out.pets).toEqual([])
    // v4: illness
    expect(out.illness).toBeNull()
    expect(out.lastIllnessRollAt).toBe(0)
    // v5: streak + lucky moments
    expect(out.streakLength).toBe(0)
    // v7: per-item use cooldown clock
    expect(out.itemLastUsedAt).toEqual({})
    expect(out.streakLastClaimDay).toBe(0)
    expect(out.streakBest).toBe(0)
    expect(out.luckyMomentsSeen).toBe(0)
    expect(out.luckyMomentsSeenIds).toEqual([])
    // achievementsClaimed was added with the achievements feature; ensure it
    // doesn't crash if absent (the store's FRESH merge handles undefined).
  })

  test('pre-existing fields are preserved (no clobbering)', () => {
    const out = migrateSave({ ...v1Save })
    expect(out.citizen?.name).toBe('Ada')
    expect(out.money).toBe(50000)
    expect(out.shiftsWorked).toBe(12)
    expect(out.inventory.noodles).toBe(2)
    expect(out.needs.hunger).toBe(80) // original need untouched
  })

  test('a v3 save (has hydration + pets) is migrated idempotently', () => {
    // A save that already has hydration and pets should NOT have them reset.
    const v3Save = {
      ...v1Save,
      needs: { hunger: 60, hydration: 50, energy: 70, hygiene: 70, fun: 60 } as Needs,
      pets: [{ itemId: 'cat', hunger: 80, petId: 'cat-1' }],
    }
    const out = migrateSave({ ...v3Save })
    expect(out.needs.hydration).toBe(50) // preserved, not reset to 75
    expect(out.pets).toHaveLength(1)
    expect(out.pets[0].petId).toBe('cat-1')
  })

  test('a v5 save (has streak + lucky moments) is migrated idempotently', () => {
    const v5Save = {
      ...v1Save,
      needs: { ...v1Save.needs, hydration: 65 } as Needs,
      pets: [],
      illness: null,
      lastIllnessRollAt: 12345,
      streakLength: 7,
      streakLastClaimDay: 19000,
      streakBest: 14,
      luckyMomentsSeen: 3,
      luckyMomentsSeenIds: ['lottery', 'found_cash'],
    }
    const out = migrateSave({ ...v5Save })
    // Nothing should be reset — the values are already present.
    expect(out.streakLength).toBe(7)
    expect(out.streakBest).toBe(14)
    expect(out.luckyMomentsSeen).toBe(3)
    expect(out.luckyMomentsSeenIds).toEqual(['lottery', 'found_cash'])
    expect(out.lastIllnessRollAt).toBe(12345)
  })

  test('a citizen with an active illness keeps it (not reset to null)', () => {
    const v4Save = {
      ...v1Save,
      needs: { ...v1Save.needs, hydration: 40 } as Needs,
      illness: { kind: 'flu', startedAt: 1_000, endsAt: 2_000 },
      lastIllnessRollAt: 500,
    }
    const out = migrateSave({ ...v4Save })
    expect(out.illness).toEqual({ kind: 'flu', startedAt: 1_000, endsAt: 2_000 })
    expect(out.lastIllnessRollAt).toBe(500)
  })

  test('garbage input does not crash (returns the cast input)', () => {
    // migrate is called by zustand with whatever was in localStorage. If the
    // user hand-edited it to garbage, we must not throw — return it and let
    // the store's merge handle the fallout. This is defensive but important:
    // a thrown migrate would brick the entire app on load.
    expect(() => migrateSave(null)).not.toThrow()
    expect(() => migrateSave({})).not.toThrow()
    expect(() => migrateSave('not a state')).not.toThrow()
    expect(() => migrateSave(undefined)).not.toThrow()
  })

  test('a falsy lastIllnessRollAt (0) is preserved as 0, not treated as missing', () => {
    // The backfill uses `!state.lastIllnessRollAt` which is truthy for 0 —
    // this means a legit 0 gets "backfilled" to 0, which is harmless but
    // worth pinning so a future refactor doesn't accidentally change it.
    const out = migrateSave({ ...v1Save, lastIllnessRollAt: 0 })
    expect(out.lastIllnessRollAt).toBe(0)
  })

  test('sawAchievementsPanel backfills true for veterans (≥7 tutorial steps)', () => {
    // A returning player who finished the original 8-step tutorial shouldn't
    // be re-nudged to "discover achievements" — they're already past onboarding.
    const veteran = { ...v1Save, tutorialClaimed: ['avatar', 'eat', 'job', 'shift', 'sleep', 'home', 'business'] }
    const out = migrateSave(veteran)
    expect(out.sawAchievementsPanel).toBe(true)
  })

  test('sawAchievementsPanel backfills false for new players (<7 tutorial steps)', () => {
    // A player mid-onboarding SHOULD still get the discovery nudge.
    const newbie = { ...v1Save, tutorialClaimed: ['avatar', 'eat'] }
    const out = migrateSave(newbie)
    expect(out.sawAchievementsPanel).toBe(false)
  })
})

/**
 * Forward-completeness guard: every field in the post-migrate output that the
 * tick() reads must be present (not undefined). If a future feature adds a
 * field to GameState but forgets the backfill, this test catches it on the
 * v1-save path — the most likely to be missed.
 */
describe('migrateSave — completeness guard', () => {
  test('a migrated v1 save has no undefined in the fields tick() touches', () => {
    const out = migrateSave({ ...v1Save })
    const tickCriticalFields = [
      'needs', 'health', 'money', 'level', 'xp', 'activity',
      'lastSeenAt', 'assets', 'pets', 'inventory', 'groceryRestockedAt',
      'illness', 'lastIllnessRollAt', 'lastFountainAt', 'lastFoodBankAt',
      'streakLength', 'streakLastClaimDay', 'streakBest',
      'luckyMomentsSeen', 'luckyMomentsSeenIds',
      'shiftsWorked', 'timesEaten', 'reachTier', 'sawAchievementsPanel',
    ] as const
    for (const f of tickCriticalFields) {
      expect((out as unknown as Record<string, unknown>)[f], `field ${f} is undefined after migrate`).toBeDefined()
    }
    // needs.hydration specifically — the most common migration bug
    expect(out.needs.hydration).toBeDefined()
  })
})

/**
 * The version pin. zustand/persist only calls migrate() when the stored
 * version differs from this configured one — so a new persisted field
 * WITHOUT a version bump means its backfill above is dead code for every
 * existing save (the v5→v6 incident: veterans were re-shown the
 * achievements nudge + street controls overlay because the conditional
 * backfills never ran). If you add a migration, bump the version and
 * update this pin in the same commit.
 */
describe('persist configuration', () => {
  test('the persist version matches the latest migration (bump both together)', async () => {
    const { SAVE_VERSION } = await import('./gameStore')
    expect(SAVE_VERSION).toBe(7)
  })
})

describe('migrateSave — v7 itemLastUsedAt', () => {
  test('a v6 save without itemLastUsedAt gets an empty map', () => {
    const out = migrateSave({ ...v1Save })
    expect(out.itemLastUsedAt).toEqual({})
  })

  test('an existing itemLastUsedAt map is preserved, not reset', () => {
    const out = migrateSave({ ...v1Save, itemLastUsedAt: { kitchen: 12345 } })
    expect(out.itemLastUsedAt).toEqual({ kitchen: 12345 })
  })
})
