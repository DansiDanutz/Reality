import { describe, expect, test } from 'vitest'
import {
  COURIER_PACKAGES,
  courierPackageForDay,
  courierRequirementMet,
  shouldCreateCourierPackage,
} from './courierPackages'
import { STARTER_HOUSE_RECIPE, createConstructionProject } from './construction'
import { freshResources } from './resources'

describe('courierPackages', () => {
  test('defines the first 10 MVP packages in order', () => {
    expect(COURIER_PACKAGES).toHaveLength(10)
    expect(COURIER_PACKAGES.map((pkg) => pkg.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('returns packages for MVP days only', () => {
    expect(courierPackageForDay(1)?.title).toBe('The first package')
    expect(courierPackageForDay(10)?.title).toBe('A door of your own')
    expect(courierPackageForDay(11)).toBeNull()
  })

  test('enforces once-per-local-day courier creation', () => {
    const first = shouldCreateCourierPackage({
      citizenAgeDay: 1,
      localDay: 20_001,
      courierLastDay: 20_000,
      completedDays: [],
    })
    expect(first?.day).toBe(1)
    expect(shouldCreateCourierPackage({
      citizenAgeDay: 1,
      localDay: 20_001,
      courierLastDay: 20_001,
      completedDays: [],
    })).toBeNull()
  })

  test('does not recreate completed package days', () => {
    expect(shouldCreateCourierPackage({
      citizenAgeDay: 3,
      localDay: 20_003,
      courierLastDay: 20_002,
      completedDays: [3],
    })).toBeNull()
  })

  test('checks resource and construction requirements', () => {
    const woodDay = courierPackageForDay(4)!
    expect(courierRequirementMet(woodDay, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 24 }),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet(woodDay, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 25 }),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)

    const project = {
      ...createConstructionProject('starter-house', 45, 21, 1),
      deposited: freshResources({ wood: 25, stone: 15 }),
      laborDoneMinutes: STARTER_HOUSE_RECIPE.laborRequiredMinutes,
    }
    expect(courierRequirementMet(courierPackageForDay(7)!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      hasHome: false,
    })).toBe(true)
  })
})
