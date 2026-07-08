import { describe, expect, test } from 'vitest'
import {
  addBusinessDevelopmentLabor,
  createBusinessDevelopmentProject,
  depositBusinessDevelopmentResources,
  payBusinessDevelopmentBudget,
} from './businessDevelopment'
import type { PlacedAsset } from './types'
import {
  COURIER_PACKAGES,
  courierPackageForLifePlan,
  courierPackageForDay,
  courierRequirementMet,
  shouldCreateCourierPackage,
} from './courierPackages'
import { STARTER_HOUSE_RECIPE, businessConstructionRecipe, createConstructionProject, createConstructionProjectFromRecipe } from './construction'
import { EDUCATION_COURSES, createEducationProgress } from './education'
import { freshResources } from './resources'

const business = (overrides: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 240,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
  ...overrides,
})

describe('courierPackages', () => {
  test('defines the first 10 MVP packages in order', () => {
    expect(COURIER_PACKAGES).toHaveLength(10)
    expect(COURIER_PACKAGES.map((pkg) => pkg.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('returns authored MVP packages and generated Life Ladder campaign days', () => {
    expect(courierPackageForDay(1)?.title).toBe('The first package')
    expect(courierPackageForDay(10)?.title).toBe('A door of your own')
    expect(courierPackageForDay(11)).toMatchObject({
      day: 11,
      title: 'Life Ladder day 11',
      objective: 'Complete today\'s Life Ladder task.',
      requirement: { kind: 'none' },
    })
    expect(courierPackageForDay(60)?.title).toBe('Life Ladder day 60')
    expect(courierPackageForDay(61)).toBeNull()
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

  test('creates generated campaign packages after the MVP tutorial', () => {
    expect(shouldCreateCourierPackage({
      citizenAgeDay: 11,
      localDay: 20_011,
      courierLastDay: 20_010,
      completedDays: [],
    })).toMatchObject({
      day: 11,
      title: 'Life Ladder day 11',
    })
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

    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-permit' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-permit' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, permitFeePaid: true }],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-built', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, laborMinutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      assets: [business({ lat: 45, lng: 21 })],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-built', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, laborMinutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, resultKind: 'business', itemId: 'foodcart', laborDoneMinutes: 119 }],
      assets: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-built', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, laborMinutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, resultKind: 'business', itemId: 'foodcart', laborDoneMinutes: 120 }],
      assets: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-labor-complete', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, minutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, resultKind: 'business', itemId: 'foodcart', laborDoneMinutes: 119 }],
      assets: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-labor-complete', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, minutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, resultKind: 'business', itemId: 'foodcart', laborDoneMinutes: 120 }],
      assets: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'construction-labor-complete', resultKind: 'business', itemId: 'foodcart', lat: 45, lng: 21, minutes: 120 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      assets: [business({ lat: 45, lng: 21 })],
      hasHome: false,
    })).toBe(true)
  })

  test('checks Life Ladder job, shift, education, and community requirements', () => {
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'job' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      jobId: null,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'job' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      jobId: 'barista',
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'shift', shiftsWorked: 3 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      shiftsWorked: 2,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-enrolled', courseId: 'course' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [],
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-enrolled', courseId: 'course' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-study', courseId: 'course', studiedMinutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education-study', courseId: 'course', studiedMinutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [{ ...createEducationProgress(EDUCATION_COURSES.course, 1_000), studiedMinutes: 60 }],
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'education', educationActions: 1 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 1,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'community', actionsThisWeek: 2 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      communityActionsThisWeek: 2,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'community', actionId: 'check-neighbor', actionsThisWeek: 1 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      communityActionsThisWeek: 1,
      communityActionCountsThisWeek: { 'help-errand': 1 },
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(1)!, requirement: { kind: 'community', actionId: 'check-neighbor', actionsThisWeek: 1 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      communityActionCountsThisWeek: { 'check-neighbor': 1 },
    })).toBe(true)
  })

  test('checks survival drink and sleep requirements', () => {
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'drink', drinksToday: 1 } }, {
      timesEaten: 0,
      drinksToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'drink', drinksToday: 1 } }, {
      timesEaten: 0,
      drinksToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'sleep', timesSlept: 3 } }, {
      timesEaten: 0,
      timesSlept: 2,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'sleep', timesSlept: 3 } }, {
      timesEaten: 0,
      timesSlept: 3,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'hygiene', hygieneToday: 1 } }, {
      timesEaten: 0,
      hygieneToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'hygiene', hygieneToday: 1 } }, {
      timesEaten: 0,
      hygieneToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'purchase', boughtToday: 2 } }, {
      timesEaten: 0,
      boughtToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'purchase', boughtToday: 2 } }, {
      timesEaten: 0,
      boughtToday: 2,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'worker-hired', workersHiredToday: 1 } }, {
      timesEaten: 0,
      workersHiredToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'worker-hired', workersHiredToday: 1 } }, {
      timesEaten: 0,
      workersHiredToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'cooked-meal', cookedToday: 1 } }, {
      timesEaten: 3,
      cookedToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'cooked-meal', cookedToday: 1 } }, {
      timesEaten: 0,
      cookedToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'item-consumed', itemId: 'shower_public', consumedToday: 1 } }, {
      timesEaten: 0,
      consumedItemCountsToday: { noodles: 1 },
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'item-consumed', itemId: 'shower_public', consumedToday: 1 } }, {
      timesEaten: 0,
      consumedItemCountsToday: { shower_public: 1 },
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
  })

  test('checks business development requirements', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const paid = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project
    const worked = addBusinessDevelopmentLabor(paid, 60)
    const complete = addBusinessDevelopmentLabor(paid, paid.laborRequiredMinutes)
    const upgradedBusiness = { ...business(), level: project.levelTo, incomePerDay: project.incomeAfter }

    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-site' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-site' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-deposit', resources: project.required } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-deposit', resources: project.required } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [deposited],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-deposit-complete', resources: project.required, businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-deposit-complete', resources: project.required, businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [deposited],
      assets: [business()],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-deposit-complete', resources: project.required, businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      assets: [upgradedBusiness],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-budget' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [paid],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-budget-complete', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-budget-complete', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [paid],
      assets: [business()],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-budget-complete', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      assets: [upgradedBusiness],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-labor', minutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [worked],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-labor-complete', businessId: project.businessId, level: project.levelTo, minutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-labor-complete', businessId: project.businessId, level: project.levelTo, minutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [worked],
      assets: [business()],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-development-labor-complete', businessId: project.businessId, level: project.levelTo, minutes: 60 } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      assets: [upgradedBusiness],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-upgraded', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-upgraded', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [complete],
      assets: [business()],
      hasHome: true,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'business-upgraded', businessId: project.businessId, level: project.levelTo } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      assets: [upgradedBusiness],
      hasHome: true,
    })).toBe(true)
  })

  test('checks active commitment requirements', () => {
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'active-commitment', activityKind: 'shift' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      activityKind: 'shift',
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement: { kind: 'active-commitment', activityKind: 'shift' } }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      activityKind: null,
      hasHome: false,
    })).toBe(true)
  })

  test('wraps the current Life Ladder primary task as the courier objective', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'first-shift',
      title: 'Work your first shift',
      detail: 'A reliable first shift funds food, water, and the first build.',
      value: 'work',
      minutes: 480,
      route: { kind: 'work-action', action: 'shift' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      shiftsWorked: 0,
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Work your first shift',
      objective: 'Work your first shift',
      requirement: { kind: 'shift', shiftsWorked: 1 },
    })
    expect(pkg?.story).toContain('Life Ladder')
  })

  test('wraps generated campaign days with the current Life Ladder primary task', () => {
    const pkg = courierPackageForLifePlan(11, {
      id: 'help-local-person',
      title: 'Help one local person',
      detail: 'Respect and friendship grow from showing up before anyone owes you.',
      value: 'community',
      minutes: 35,
      route: { kind: 'community-action', actionId: 'help-errand' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: true,
      communityActionsThisWeek: 0,
      communityActionCountsThisWeek: {},
    })

    expect(pkg).toMatchObject({
      day: 11,
      title: 'Help one local person',
      objective: 'Help one local person',
      requirement: { kind: 'community', actionId: 'help-errand', actionsThisWeek: 1 },
    })
    expect(pkg?.story).toContain('Life Ladder')
  })

  test('wraps generated business interior tasks with clearable requirements', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const pkg = courierPackageForLifePlan(18, {
      id: 'develop-business-hour',
      title: 'Work 60m inside Food Cart',
      detail: 'Use free time after work and body care to add 1h inside.',
      value: 'capital',
      minutes: 60,
      route: { kind: 'business-development-action', projectId: project.id, action: 'work' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      hasHome: true,
    })

    expect(pkg).toMatchObject({
      day: 18,
      title: 'Work 60m inside Food Cart',
      requirement: {
        kind: 'business-development-labor-complete',
        businessId: project.businessId,
        level: project.levelTo,
        minutes: 60,
      },
    })
  })

  test('wraps generated business interior deposit tasks with permanent upgrade requirements', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const pkg = courierPackageForLifePlan(18, {
      id: 'deposit-business-materials',
      title: 'Deposit Food Cart materials',
      detail: 'Move gathered ingredients into the interior plan so the upgrade can advance.',
      value: 'capital',
      minutes: 15,
      route: { kind: 'business-development-action', projectId: project.id, action: 'deposit' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(project.required),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })

    expect(pkg).toMatchObject({
      day: 18,
      title: 'Deposit Food Cart materials',
      requirement: {
        kind: 'business-development-deposit-complete',
        resources: project.required,
        businessId: project.businessId,
        level: project.levelTo,
      },
    })
  })

  test('wraps generated business budget tasks with permanent upgrade requirements', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const pkg = courierPackageForLifePlan(19, {
      id: 'pay-business-budget',
      title: 'Fund Food Cart L2',
      detail: 'Put the upgrade budget into the interior plan before workers finish the space.',
      value: 'capital',
      minutes: 10,
      route: { kind: 'business-development-action', projectId: project.id, action: 'budget' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })

    expect(pkg).toMatchObject({
      day: 19,
      title: 'Fund Food Cart L2',
      requirement: {
        kind: 'business-development-budget-complete',
        businessId: project.businessId,
        level: project.levelTo,
      },
    })
  })

  test('wraps generated worker hire tasks with hire requirements instead of labor progress', () => {
    const constructionProject = createConstructionProject('starter-house', 45, 21, 1)
    const businessProject = createBusinessDevelopmentProject(business(), 1_000)!

    const constructionHire = courierPackageForLifePlan(18, {
      id: 'hire-helper-for-house',
      title: 'Hire a helper for Starter House',
      detail: 'Use the Workers Hall to move the build while you protect your workday.',
      value: 'capital',
      minutes: 5,
      route: { kind: 'construction-action', projectId: constructionProject.id, action: 'hire-helper', hours: 2 },
    }, {
      timesEaten: 0,
      workersHiredToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...constructionProject, laborDoneMinutes: 120 }],
      businessDevelopmentProjects: [businessProject],
      hasHome: false,
    })
    const businessHire = courierPackageForLifePlan(19, {
      id: 'hire-helper-for-business',
      title: 'Hire a helper inside Food Cart',
      detail: 'Book a Workers Hall helper for the interior, then keep the rest of the day disciplined.',
      value: 'capital',
      minutes: 5,
      route: { kind: 'business-development-action', projectId: businessProject.id, action: 'hire-helper', hours: 2 },
    }, {
      timesEaten: 0,
      workersHiredToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [constructionProject],
      businessDevelopmentProjects: [{ ...businessProject, laborDoneMinutes: 120 }],
      hasHome: false,
    })

    expect(constructionHire).toMatchObject({
      day: 18,
      requirement: { kind: 'worker-hired', workersHiredToday: 1 },
    })
    expect(businessHire).toMatchObject({
      day: 19,
      requirement: { kind: 'worker-hired', workersHiredToday: 2 },
    })
  })

  test('wraps generated construction work tasks with permanent asset requirements', () => {
    const project = {
      ...createConstructionProjectFromRecipe(businessConstructionRecipe({
        id: 'foodcart',
        name: 'Food Cart',
        price: 1_000,
        incomePerDay: 200,
      }), 45, 21, 1),
      laborDoneMinutes: 60,
    }
    const pkg = courierPackageForLifePlan(20, {
      id: 'work-business-foundation',
      title: 'Build Food Cart for 60m',
      detail: 'Put a real hour into the business foundation so it moves from plan to place.',
      value: 'capital',
      minutes: 60,
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      assets: [],
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      day: 20,
      title: 'Build Food Cart for 60m',
      requirement: {
        kind: 'construction-labor-complete',
        resultKind: 'business',
        itemId: 'foodcart',
        lat: 45,
        lng: 21,
        minutes: 120,
      },
    })
  })

  test('wraps generated business completion tasks with permanent asset requirements', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const pkg = courierPackageForLifePlan(20, {
      id: 'finish-business-development',
      title: 'Finish Food Cart L2',
      detail: 'Materials, budget, and labor are ready. Make the interior upgrade permanent.',
      value: 'capital',
      minutes: 10,
      route: { kind: 'business-development-action', projectId: project.id, action: 'complete' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [project],
      assets: [business()],
      hasHome: true,
    })

    expect(pkg).toMatchObject({
      day: 20,
      title: 'Finish Food Cart L2',
      requirement: { kind: 'business-upgraded', businessId: project.businessId, level: project.levelTo },
    })
  })

  test('wraps generated construction deposit and permit tasks with clearable requirements', () => {
    const project = createConstructionProject('starter-house', 45, 21, 1)
    const deposit = courierPackageForLifePlan(12, {
      id: 'deposit-house-materials',
      title: 'Deposit house materials',
      detail: 'Move gathered materials into the first home site.',
      value: 'capital',
      minutes: 15,
      route: { kind: 'construction-action', projectId: project.id, action: 'deposit' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(project.required),
      constructionProjects: [project],
      hasHome: false,
    })
    const permit = courierPackageForLifePlan(13, {
      id: 'pay-house-permit',
      title: 'Pay the house permit',
      detail: 'Pay the city fee before labor can begin.',
      value: 'respect',
      minutes: 10,
      route: { kind: 'construction-action', projectId: project.id, action: 'permit' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      hasHome: false,
    })

    expect(deposit).toMatchObject({
      day: 12,
      requirement: {
        kind: 'construction-deposit-complete',
        resources: project.required,
        resultKind: project.resultKind,
        itemId: project.itemId,
        lat: project.lat,
        lng: project.lng,
      },
    })
    expect(courierRequirementMet(deposit!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      assets: [{
        id: 'built-house',
        itemId: project.itemId,
        kind: project.resultKind,
        name: project.name,
        lat: project.lat,
        lng: project.lng,
        incomePerDay: project.incomePerDay,
        pendingIncome: 0,
        placedAtMinute: 0,
      }],
      hasHome: true,
    })).toBe(true)
    expect(permit).toMatchObject({
      day: 13,
      requirement: {
        kind: 'construction-permit-complete',
        resultKind: project.resultKind,
        itemId: project.itemId,
        lat: project.lat,
        lng: project.lng,
      },
    })
  })

  test('accepts permanent business foundations for generated construction permit tasks', () => {
    const project = createConstructionProjectFromRecipe(businessConstructionRecipe({
      id: 'foodcart',
      name: 'Food Cart',
      price: 1_000,
      incomePerDay: 200,
    }), 45, 21, 1)
    const requirement = {
      kind: 'construction-permit-complete' as const,
      resultKind: project.resultKind,
      itemId: project.itemId,
      lat: project.lat,
      lng: project.lng,
    }

    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      assets: [],
      hasHome: false,
    })).toBe(false)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [{ ...project, permitFeePaid: true }],
      assets: [],
      hasHome: false,
    })).toBe(true)
    expect(courierRequirementMet({ ...courierPackageForDay(11)!, requirement }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      assets: [{
        id: 'foodcart-built',
        itemId: project.itemId,
        kind: project.resultKind,
        name: project.name,
        lat: project.lat,
        lng: project.lng,
        incomePerDay: project.incomePerDay,
        pendingIncome: 0,
        placedAtMinute: 0,
      }],
      hasHome: false,
    })).toBe(true)
  })

  test('wraps generated construction completion tasks with permanent asset requirements', () => {
    const project = {
      ...createConstructionProjectFromRecipe(businessConstructionRecipe({
        id: 'foodcart',
        name: 'Food Cart',
        price: 1_000,
        incomePerDay: 200,
      }), 45, 21, 1),
      laborDoneMinutes: 360,
    }
    const pkg = courierPackageForLifePlan(14, {
      id: 'finish-business-foundation',
      title: 'Open Food Cart',
      detail: 'Materials, permit, and labor are done. Make the business permanent on the map.',
      value: 'capital',
      minutes: 10,
      route: { kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: 'business' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [project],
      assets: [],
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      day: 14,
      title: 'Open Food Cart',
      requirement: {
        kind: 'construction-built',
        resultKind: 'business',
        itemId: 'foodcart',
        lat: 45,
        lng: 21,
        laborMinutes: 360,
      },
    })
  })

  test('wraps generated survival tasks with clearable drink and sleep requirements', () => {
    const drink = courierPackageForLifePlan(14, {
      id: 'drink-water',
      title: 'Drink water',
      detail: 'Hydration is the fastest survival risk. Fix it before work or construction.',
      value: 'body',
      minutes: 5,
      route: { kind: 'survival-action', action: 'drink-water' },
    }, {
      timesEaten: 0,
      drinksToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })
    const sleep = courierPackageForLifePlan(15, {
      id: 'sleep-tonight',
      title: 'Sleep before pushing harder',
      detail: 'Energy is too low for serious work. Rest protects tomorrow.',
      value: 'body',
      minutes: 480,
      route: { kind: 'survival-action', action: 'sleep' },
    }, {
      timesEaten: 0,
      timesSlept: 2,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })

    expect(drink).toMatchObject({
      day: 14,
      requirement: { kind: 'drink', drinksToday: 2 },
    })
    expect(sleep).toMatchObject({
      day: 15,
      requirement: { kind: 'sleep', timesSlept: 3 },
    })
  })

  test('wraps generated consume tasks with exact item requirements', () => {
    const pkg = courierPackageForLifePlan(16, {
      id: 'support-body',
      title: 'Protect hygiene',
      detail: 'Drink, eat, clean up, or sleep before the day gets expensive.',
      value: 'body',
      minutes: 30,
      route: { kind: 'consume-action', itemId: 'shower_public' },
    }, {
      timesEaten: 0,
      hygieneToday: 1,
      consumedItemCountsToday: { noodles: 1 },
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      day: 16,
      requirement: { kind: 'item-consumed', itemId: 'shower_public', consumedToday: 1 },
    })
  })

  test('wraps generated cook tasks with cooked meal requirements', () => {
    const pkg = courierPackageForLifePlan(16, {
      id: 'support-body',
      title: 'Cook a home meal',
      detail: 'A cooked meal is cheaper and steadier than buying every bite.',
      value: 'body',
      minutes: 30,
      route: { kind: 'cook-action', recipeId: 'grilledcheese' },
    }, {
      timesEaten: 4,
      cookedToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: true,
    })

    expect(pkg).toMatchObject({
      day: 16,
      requirement: { kind: 'cooked-meal', cookedToday: 1 },
    })
  })

  test('wraps generated market tasks with clearable purchase requirements', () => {
    const health = courierPackageForLifePlan(17, {
      id: 'body-recover',
      title: 'Recover your body first',
      detail: 'Health is low. Drink, eat, and rest before chasing money.',
      value: 'body',
      minutes: 60,
      route: { kind: 'market', focus: 'health' },
    }, {
      timesEaten: 0,
      boughtToday: 1,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })
    const groceries = courierPackageForLifePlan(18, {
      id: 'support-body',
      title: 'Protect hunger',
      detail: 'Drink, eat, clean up, or sleep before the day gets expensive.',
      value: 'body',
      minutes: 30,
      route: { kind: 'market', focus: 'groceries' },
    }, {
      timesEaten: 0,
      boughtToday: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
    })

    expect(health).toMatchObject({
      day: 17,
      requirement: { kind: 'purchase', boughtToday: 2 },
    })
    expect(groceries).toMatchObject({
      day: 18,
      requirement: { kind: 'purchase', boughtToday: 1 },
    })
  })

  test('wraps generated active commitment tasks with clearable activity requirements', () => {
    const pkg = courierPackageForLifePlan(19, {
      id: 'finish-active-shift',
      title: 'Finish the work shift',
      detail: 'Income is already in motion. Complete the shift so food, permits, workers, and savings stay funded.',
      value: 'work',
      minutes: 0,
      route: { kind: 'none' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      activityKind: 'shift',
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      day: 19,
      title: 'Finish the work shift',
      requirement: { kind: 'active-commitment', activityKind: 'shift' },
    })
  })

  test('turns course enrollment tasks into enrollment requirements', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-first-course',
      title: 'Study one useful skill',
      detail: 'School compounds wages. Do one course while your body and income are safe.',
      value: 'school',
      minutes: 60,
      route: { kind: 'market', focus: 'education' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 0,
      educationProgress: [],
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Study one useful skill',
      objective: 'Study one useful skill',
      requirement: { kind: 'education-enrolled', courseId: 'course' },
    })
  })

  test('turns study tasks into exact study progress requirements', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-course',
      title: 'Study Online Course',
      detail: '60 minutes remain. Finish the course block before chasing the next credential.',
      value: 'school',
      minutes: 60,
      route: { kind: 'education-action', courseId: 'course' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 0,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Study Online Course',
      objective: 'Study Online Course',
      requirement: { kind: 'education-study', courseId: 'course', studiedMinutes: 60 },
    })
  })

  test('turns missing study enrollment into exact course enrollment requirements', () => {
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-certification',
      title: 'Study Professional Certification',
      detail: 'Enroll first, then study the credential that moves work forward.',
      value: 'school',
      minutes: 60,
      route: { kind: 'education-action', courseId: 'certification' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 3,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })

    expect(pkg).toMatchObject({
      day: 2,
      title: 'Study Professional Certification',
      requirement: { kind: 'education-enrolled', courseId: 'certification' },
    })
    expect(courierRequirementMet(pkg!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 3,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.course, 1_000)],
    })).toBe(false)
    expect(courierRequirementMet(pkg!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationProgress: [createEducationProgress(EDUCATION_COURSES.certification, 1_000)],
    })).toBe(true)
  })

  test('keeps repeated long-course study objectives clearable by minutes', () => {
    const progress = {
      ...createEducationProgress(EDUCATION_COURSES.certification, 1_000),
      studiedMinutes: 60,
    }
    const pkg = courierPackageForLifePlan(2, {
      id: 'study-certification',
      title: 'Study Professional Certification',
      detail: '120 minutes remain. Finish the course block before chasing the next credential.',
      value: 'school',
      minutes: 60,
      route: { kind: 'education-action', courseId: 'certification' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      hasHome: false,
      educationActions: 1,
      educationProgress: [progress],
    })

    expect(pkg).toMatchObject({
      requirement: { kind: 'education-study', courseId: 'certification', studiedMinutes: 120 },
    })
  })

  test('turns gather tasks into one concrete resource trip requirement', () => {
    const pkg = courierPackageForLifePlan(4, {
      id: 'gather-wood',
      title: 'Gather wood',
      detail: 'The starter house still needs wood.',
      value: 'capital',
      minutes: 20,
      route: { kind: 'gather', resourceKind: 'wood' },
    }, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 0 }),
      gatheredResourceAmountsToday: { wood: 10 },
      constructionProjects: [],
      hasHome: false,
    })

    expect(pkg).toMatchObject({
      targetResource: 'wood',
      requirement: { kind: 'resource-gathered', resource: 'wood', amount: 35 },
    })
    expect(courierRequirementMet(pkg!, {
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources({ wood: 0 }),
      gatheredResourceAmountsToday: { wood: 35 },
      constructionProjects: [],
      hasHome: false,
    })).toBe(true)
  })
})
