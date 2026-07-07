import { describe, expect, test } from 'vitest'
import type { Needs } from '../game/types'
import { migrateSave } from './gameStore'

/**
 * Regression tests for save migration. A future edit that adds a field to
 * GameState but forgets the backfill here would silently corrupt every old
 * save on load.
 */

const v1Save = {
  citizen: { name: 'Ada', founderNumber: 1, createdAt: 1_700_000_000_00 },
  money: 50000,
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

describe('migrateSave - backfills every field added after v1', () => {
  test('a v1 save gets all current backfills', () => {
    const out = migrateSave({ ...v1Save })

    expect(out.needs.hydration).toBe(75)
    expect(out.pets).toEqual([])
    expect(out.illness).toBeNull()
    expect(out.lastIllnessRollAt).toBe(0)
    expect(out.streakLength).toBe(0)
    expect(out.streakLastClaimDay).toBe(0)
    expect(out.streakBest).toBe(0)
    expect(out.luckyMomentsSeen).toBe(0)
    expect(out.luckyMomentsSeenIds).toEqual([])
    expect(out.resources).toEqual({ wood: 0, stone: 0, metal: 0, glass: 0 })
    expect(out.resourceNodes).toEqual([])
    expect(out.constructionProjects).toEqual([])
    expect(out.placingConstruction).toBeNull()
    expect(out.selectedMapTarget).toBeNull()
    expect(out.educationProgress).toEqual([])
    expect(out.community).toMatchObject({
      respect: 0,
      friendship: 0,
      trust: 0,
      actionsThisWeek: 0,
    })
    expect(out.businessDevelopmentProjects).toEqual([])
    expect(out.activeCourierPackage).toBeNull()
    expect(out.courierLastDay).toBe(0)
    expect(out.courierOpenedDays).toEqual([])
    expect(out.completedCourierDays).toEqual([])
  })

  test('pre-existing fields are preserved', () => {
    const out = migrateSave({ ...v1Save })
    expect(out.citizen?.name).toBe('Ada')
    expect(out.money).toBe(50000)
    expect(out.shiftsWorked).toBe(12)
    expect(out.inventory.noodles).toBe(2)
    expect(out.needs.hunger).toBe(80)
  })

  test('a v3 save with hydration and pets is migrated idempotently', () => {
    const v3Save = {
      ...v1Save,
      needs: { hunger: 60, hydration: 50, energy: 70, hygiene: 70, fun: 60 } as Needs,
      pets: [{ itemId: 'cat', hunger: 80, petId: 'cat-1' }],
    }
    const out = migrateSave({ ...v3Save })
    expect(out.needs.hydration).toBe(50)
    expect(out.pets).toHaveLength(1)
    expect(out.pets[0].petId).toBe('cat-1')
  })

  test('a v5 save with streak and lucky moments is migrated idempotently', () => {
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
    expect(out.streakLength).toBe(7)
    expect(out.streakBest).toBe(14)
    expect(out.luckyMomentsSeen).toBe(3)
    expect(out.luckyMomentsSeenIds).toEqual(['lottery', 'found_cash'])
    expect(out.lastIllnessRollAt).toBe(12345)
  })

  test('old construction projects backfill asset result fields', () => {
    const out = migrateSave({
      ...v1Save,
      constructionProjects: [{
        id: 'starter-house-old',
        recipeId: 'starter-house',
        name: 'Starter House',
        lat: 45.7,
        lng: 21.2,
        required: { wood: 120, stone: 60, metal: 20, glass: 10 },
        deposited: { wood: 0, stone: 0, metal: 0, glass: 0 },
        laborRequiredMinutes: 480,
        laborDoneMinutes: 0,
        permitFee: 500,
        permitFeePaid: false,
        status: 'planned',
        placedAt: 123,
      }],
    })

    expect(out.constructionProjects[0]).toMatchObject({
      itemId: 'microstudio',
      resultKind: 'home',
      incomePerDay: 0,
      hiredLaborMinutes: 0,
      workerContracts: [],
    })
  })

  test('old education progress is normalized by course id', () => {
    const out = migrateSave({
      ...v1Save,
      educationProgress: [{
        courseId: 'certification',
        studiedMinutes: 90.8,
      }],
    })

    expect(out.educationProgress[0]).toMatchObject({
      courseId: 'certification',
      itemId: 'certification',
      studiedMinutes: 90,
      completedAt: null,
    })
    expect(out.educationProgress[0].enrolledAt).toBeTypeOf('number')
  })

  test('unknown education progress entries are dropped', () => {
    const out = migrateSave({
      ...v1Save,
      educationProgress: [{
        courseId: 'mystery-degree',
        studiedMinutes: 20,
      }],
    })

    expect(out.educationProgress).toEqual([])
  })

  test('old community stats are normalized without losing earned values', () => {
    const out = migrateSave({
      ...v1Save,
      community: {
        respect: 4.8,
        friendship: 3.1,
        trust: 2.9,
        actionsThisWeek: 1.7,
        week: 42.4,
      },
    })

    expect(out.community).toEqual({
      respect: 4,
      friendship: 3,
      trust: 2,
      actionsThisWeek: 1,
      week: 42,
    })
  })

  test('old business development projects normalize missing ledger fields', () => {
    const out = migrateSave({
      ...v1Save,
      businessDevelopmentProjects: [{
        id: 'foodcart-1:develop',
        businessId: 'foodcart-1',
        businessName: 'Food Cart',
        itemId: 'foodcart',
        levelFrom: 1,
        levelTo: 2,
        required: { wood: 20, stone: 15, metal: 25, glass: 10 },
        deposited: { wood: 5 },
        laborRequiredMinutes: 150,
        laborDoneMinutes: 20,
        budgetCost: 960,
      }],
    })

    expect(out.businessDevelopmentProjects[0]).toMatchObject({
      id: 'foodcart-1:develop',
      businessId: 'foodcart-1',
      levelFrom: 1,
      levelTo: 2,
      required: { wood: 20, stone: 15, metal: 25, glass: 10 },
      deposited: { wood: 5, stone: 0, metal: 0, glass: 0 },
      laborRequiredMinutes: 150,
      laborDoneMinutes: 20,
      hiredLaborMinutes: 0,
      budgetCost: 960,
      budgetPaid: false,
    })
  })

  test('a citizen with an active illness keeps it', () => {
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

  test('garbage input does not crash', () => {
    expect(() => migrateSave(null)).not.toThrow()
    expect(() => migrateSave({})).not.toThrow()
    expect(() => migrateSave('not a state')).not.toThrow()
    expect(() => migrateSave(undefined)).not.toThrow()
  })

  test('a falsy lastIllnessRollAt is preserved as 0', () => {
    const out = migrateSave({ ...v1Save, lastIllnessRollAt: 0 })
    expect(out.lastIllnessRollAt).toBe(0)
  })

  test('sawAchievementsPanel backfills true for veterans', () => {
    const veteran = { ...v1Save, tutorialClaimed: ['avatar', 'eat', 'job', 'shift', 'sleep', 'home', 'business'] }
    const out = migrateSave(veteran)
    expect(out.sawAchievementsPanel).toBe(true)
  })

  test('sawAchievementsPanel backfills false for new players', () => {
    const newbie = { ...v1Save, tutorialClaimed: ['avatar', 'eat'] }
    const out = migrateSave(newbie)
    expect(out.sawAchievementsPanel).toBe(false)
  })
})

describe('migrateSave - completeness guard', () => {
  test('a migrated v1 save has no undefined in the fields tick() touches', () => {
    const out = migrateSave({ ...v1Save })
    const tickCriticalFields = [
      'needs', 'health', 'money', 'level', 'xp', 'activity',
      'lastSeenAt', 'assets', 'pets', 'inventory', 'groceryRestockedAt',
      'illness', 'lastIllnessRollAt', 'lastFountainAt', 'lastFoodBankAt',
      'streakLength', 'streakLastClaimDay', 'streakBest',
      'luckyMomentsSeen', 'luckyMomentsSeenIds',
      'shiftsWorked', 'timesEaten', 'reachTier', 'sawAchievementsPanel',
      'resources', 'resourceNodes', 'constructionProjects', 'placingConstruction',
      'selectedMapTarget', 'educationProgress', 'community', 'businessDevelopmentProjects',
      'activeCourierPackage', 'courierLastDay', 'courierOpenedDays', 'completedCourierDays',
    ] as const
    for (const f of tickCriticalFields) {
      expect((out as unknown as Record<string, unknown>)[f], `field ${f} is undefined after migrate`).toBeDefined()
    }
    expect(out.needs.hydration).toBeDefined()
  })
})

describe('persist configuration', () => {
  test('the persist version matches the latest migration', async () => {
    const { SAVE_VERSION } = await import('./gameStore')
    expect(SAVE_VERSION).toBe(13)
  })
})
