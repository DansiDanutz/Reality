import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, hireBusinessDevelopmentWorker } from './businessDevelopment'
import { businessConstructionRecipe, createConstructionProject, createConstructionProjectFromRecipe, hireConstructionWorker } from './construction'
import { planLifeRoadmap } from './lifeRoadmap'
import type { LifeLadderSnapshot } from './lifeLadder'
import { freshResources } from './resources'
import type { Needs, PlacedAsset } from './types'

const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 70 }
const DAY_MS = 24 * 60 * 60 * 1000

function snap(overrides: Partial<LifeLadderSnapshot> = {}): LifeLadderSnapshot {
  return {
    lifeDay: 1,
    money: 500,
    needs: goodNeeds,
    health: 100,
    level: 1,
    xp: 0,
    jobId: null,
    shiftsWorked: 0,
    activityKind: null,
    assets: [],
    inventory: {},
    resources: freshResources(),
    constructionProjects: [],
    businessDevelopmentProjects: [],
    educationActions: 0,
    educationProgress: [],
    communityActionsThisWeek: 0,
    communityActionsToday: 0,
    communityRespect: 0,
    communityFriendship: 0,
    communityTrust: 0,
    ...overrides,
  }
}

const home = (): PlacedAsset => ({
  id: 'home-1',
  itemId: 'microstudio',
  kind: 'home',
  name: 'Starter House',
  lat: 45,
  lng: 21,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
})

const business = (): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 200,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
})

describe('planLifeRoadmap', () => {
  test('projects the first eight days from work to school to the starter house build', () => {
    const roadmap = planLifeRoadmap(snap(), 8)

    expect(roadmap.horizonDays).toBe(8)
    expect(roadmap.days).toHaveLength(8)
    expect(roadmap.days.map((day) => day.dayLabel)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 4',
      'Day 5',
      'Day 6',
      'Day 7',
      'Day 8',
    ])
    expect(roadmap.days[0].primary.id).toBe('find-job')
    expect(roadmap.days[0].dayFocusLabel).toBe('Work day')
    expect(roadmap.days[0].millionaireStageLabel).toBe('Survival')
    expect(roadmap.days[0].millionaireStageStory).toBe('Protect the body so the day can move at all.')
    expect(roadmap.days[1].primary.id).toBe('first-shift')
    expect(roadmap.days[1].dayFocusLabel).toBe('Work day')
    expect(roadmap.days[1].millionaireStageLabel).toBe('Stable cash')
    expect(roadmap.days[1].millionaireStageStory).toBe('Keep cash and routine steady so the climb stays repeatable.')
    expect(roadmap.days[2].primary.id).toBe('study-first-course')
    expect(roadmap.days[2].dayFocusLabel).toBe('School day')
    expect(roadmap.days[2].millionaireStageLabel).toBe('Stable cash')
    expect(roadmap.days[2].millionaireStageStory).toBe('Keep cash and routine steady so the climb stays repeatable.')
    expect(roadmap.days[3].primary.id).toBe('study-course')
    expect(roadmap.days[3].dayFocusLabel).toBe('School day')
    expect(roadmap.days[3].millionaireStageLabel).toBe('Stable cash')
    expect(roadmap.days[3].millionaireStageStory).toBe('Keep cash and routine steady so the climb stays repeatable.')
    expect(roadmap.days[1].routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      taskId: 'place-home-foundation',
      route: { kind: 'panel', panel: 'construction' },
    })
    expect(roadmap.days[1].valuesCovered).toEqual(['work', 'body', 'school', 'capital'])
    expect(roadmap.days[4].primary.id).toBe('gather-wood')
    expect(roadmap.days.some((day) => day.primary.id.startsWith('gather-'))).toBe(true)
    expect(roadmap.valuesCovered).toEqual(expect.arrayContaining(['body', 'work', 'school', 'capital']))
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
    expect(roadmap.finalSnapshot.educationActions).toBeGreaterThan(0)
    expect(roadmap.finalSnapshot.constructionProjects.length).toBe(1)
  })

  test('smokes the early ownership arc from survival habits into the first business foundation', () => {
    const roadmap = planLifeRoadmap(snap(), 60)
    const primaryIds = roadmap.days.map((day) => day.primary.id)
    const firstIndex = (id: string) => primaryIds.indexOf(id)
    const firstMatchingIndex = (prefix: string) => primaryIds.findIndex((id) => id.startsWith(prefix))

    expect(firstIndex('find-job')).toBeGreaterThanOrEqual(0)
    expect(firstIndex('first-shift')).toBeGreaterThan(firstIndex('find-job'))
    expect(firstIndex('study-first-course')).toBeGreaterThan(firstIndex('first-shift'))
    expect(firstMatchingIndex('gather-')).toBeGreaterThan(firstIndex('study-first-course'))
    expect(firstIndex('deposit-house-materials')).toBeGreaterThan(firstMatchingIndex('gather-'))
    expect(firstIndex('pay-house-permit')).toBeGreaterThan(firstIndex('deposit-house-materials'))
    expect(firstIndex('hire-house-worker-hour')).toBeGreaterThan(firstIndex('pay-house-permit'))
    expect(firstIndex('work-for-first-business-foundation')).toBeGreaterThan(firstIndex('hire-house-worker-hour'))
    expect(roadmap.valuesCovered).toEqual(expect.arrayContaining(['body', 'work', 'school', 'capital']))
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'business')).toBe(false)

    const launchRoadmap = planLifeRoadmap(snap({
      lifeDay: roadmap.finalSnapshot.lifeDay,
      money: 30_000,
      level: roadmap.finalSnapshot.level,
      xp: roadmap.finalSnapshot.xp,
      jobId: roadmap.finalSnapshot.jobId,
      shiftsWorked: roadmap.finalSnapshot.shiftsWorked,
      educationActions: roadmap.finalSnapshot.educationActions,
      educationProgress: roadmap.finalSnapshot.educationProgress,
      assets: roadmap.finalSnapshot.assets,
      resources: freshResources({ wood: 500, stone: 500, metal: 500, glass: 500 }),
      communityActionsThisWeek: roadmap.finalSnapshot.communityActionsThisWeek,
      communityRespect: roadmap.finalSnapshot.communityRespect,
      communityFriendship: roadmap.finalSnapshot.communityFriendship,
      communityTrust: roadmap.finalSnapshot.communityTrust,
    }), 1)
    expect(launchRoadmap.days[0].primary).toMatchObject({
      id: 'build-first-business',
      route: { kind: 'market', focus: 'business' },
    })
    expect(launchRoadmap.finalSnapshot.assets.some((asset) => asset.kind === 'business')).toBe(false)
    expect(launchRoadmap.finalSnapshot.constructionProjects.some((project) => project.resultKind === 'business')).toBe(true)
  })

  test('uses free time after work starts to move the home build without making it the primary task', () => {
    const roadmap = planLifeRoadmap(snap(), 2)

    expect(roadmap.days[1].primary.id).toBe('first-shift')
    expect(roadmap.days[1].routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      taskId: 'place-home-foundation',
      route: { kind: 'panel', panel: 'construction' },
    })
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
    expect(roadmap.finalSnapshot.shiftsWorked).toBe(1)
    expect(roadmap.days[1]).toMatchObject({
      startingShiftsWorked: 0,
      endingShiftsWorked: 1,
      shiftsWorkedDelta: 1,
      startingCommunityRespect: 0,
      endingCommunityRespect: 1,
      communityRespectDelta: 1,
      startingCommunityTrust: 0,
      endingCommunityTrust: 1,
      communityTrustDelta: 1,
      startingAssetCount: 0,
      endingAssetCount: 0,
      assetCountDelta: 0,
      startingConstructionProjectCount: 0,
      endingConstructionProjectCount: 1,
      constructionProjectCountDelta: 1,
    })
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(1)
    expect(roadmap.finalSnapshot.constructionProjects[0]).toMatchObject({
      name: 'Starter House',
      resultKind: 'home',
    })
  })

  test('projects critical hydration recovery before returning to work', () => {
    const roadmap = planLifeRoadmap(snap({
      needs: { ...goodNeeds, hydration: 20 },
    }), 2)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'drink-water',
      route: { kind: 'survival-action', action: 'drink-water' },
    })
    expect(roadmap.days[0].routine.find((block) => block.id === 'growth-block')).toMatchObject({
      value: 'body',
      taskId: 'drink-water',
      route: { kind: 'survival-action', action: 'drink-water' },
    })
    expect(roadmap.days[0].routineValues).not.toContain('community')
    expect(roadmap.days[0].routineValues).not.toContain('friendship')
    expect(roadmap.days[0].valuesCovered).toEqual(['body', 'work', 'capital'])
    expect(roadmap.days[1].primary.id).toBe('find-job')
    expect(roadmap.finalSnapshot.needs.hydration).toBeGreaterThan(35)
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
  })

  test('does not count a full workday while critical body care is the primary task', () => {
    const roadmap = planLifeRoadmap(snap({
      money: 500,
      needs: { ...goodNeeds, hydration: 20 },
      jobId: 'barista',
      shiftsWorked: 3,
      communityRespect: 2,
      communityTrust: 2,
    }), 1)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'drink-water',
      value: 'body',
      route: { kind: 'survival-action', action: 'drink-water' },
    })
    expect(roadmap.finalSnapshot.shiftsWorked).toBe(3)
    expect(roadmap.finalSnapshot.money).toBe(461)
    expect(roadmap.finalSnapshot.communityRespect).toBe(2)
    expect(roadmap.finalSnapshot.communityTrust).toBe(2)
  })

  test('exposes the projected cash delta for work and recovery days', () => {
    const workday = planLifeRoadmap(snap({
      money: 500,
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
    }), 1)

    const recoveryDay = planLifeRoadmap(snap({
      money: 500,
      needs: { ...goodNeeds, hydration: 20 },
      jobId: 'barista',
      shiftsWorked: 3,
      communityRespect: 2,
      communityTrust: 2,
    }), 1)

    expect(workday.days[0]).toMatchObject({
      primary: { value: 'capital' },
      startingMoney: 500,
      endingMoney: 582,
      projectedCashDelta: 82,
      actualCashDelta: 82,
    })
    expect(recoveryDay.days[0]).toMatchObject({
      primary: { value: 'body' },
      startingMoney: 500,
      endingMoney: 461,
      projectedCashDelta: -38,
      actualCashDelta: -39,
    })
  })

  test('does not spend free time on construction during a body recovery day', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForLabor = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
    }

    const roadmap = planLifeRoadmap(snap({
      money: 1_000,
      needs: { ...goodNeeds, hydration: 20 },
      jobId: 'barista',
      shiftsWorked: 3,
      communityRespect: 2,
      communityTrust: 2,
      constructionProjects: [readyForLabor],
    }), 1)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'drink-water',
      value: 'body',
      route: { kind: 'survival-action', action: 'drink-water' },
    })
    expect(roadmap.finalSnapshot.constructionProjects[0]).toMatchObject({
      id: readyForLabor.id,
      laborDoneMinutes: 0,
      workerContracts: [],
    })
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(false)
  })

  test('resumes projected work after a recovery day makes the body safe', () => {
    const roadmap = planLifeRoadmap(snap({
      money: 500,
      needs: { ...goodNeeds, hydration: 20 },
      jobId: 'barista',
      shiftsWorked: 3,
      communityRespect: 2,
      communityTrust: 2,
    }), 2)

    expect(roadmap.days[0].primary.id).toBe('drink-water')
    expect(roadmap.days[1].primary.value).not.toBe('body')
    expect(roadmap.finalSnapshot.shiftsWorked).toBe(4)
    expect(roadmap.finalSnapshot.money).toBeGreaterThan(461)
    expect(roadmap.finalSnapshot.communityRespect).toBe(3)
    expect(roadmap.finalSnapshot.communityTrust).toBe(3)
  })

  test('projects owned food consumption before returning to work', () => {
    const roadmap = planLifeRoadmap(snap({
      needs: { ...goodNeeds, hunger: 20 },
      inventory: { sandwich: 1 },
    }), 2)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'eat-food',
      route: { kind: 'consume-action', itemId: 'sandwich' },
    })
    expect(roadmap.days[1].primary.id).toBe('find-job')
    expect(roadmap.finalSnapshot.needs.hunger).toBeGreaterThan(35)
    expect(roadmap.finalSnapshot.inventory.sandwich).toBe(0)
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
  })

  test('projects a cooked home meal before returning to work', () => {
    const roadmap = planLifeRoadmap(snap({
      needs: { ...goodNeeds, hunger: 20 },
      assets: [home()],
      inventory: { bread: 1, cheese: 1 },
    }), 2)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'eat-food',
      route: { kind: 'cook-action', recipeId: 'grilledcheese' },
    })
    expect(roadmap.days[1].primary.id).toBe('find-job')
    expect(roadmap.finalSnapshot.needs.hunger).toBeGreaterThan(35)
    expect(roadmap.finalSnapshot.inventory).toMatchObject({ bread: 0, cheese: 0 })
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
  })

  test('projects emergency food purchase before returning to work', () => {
    const roadmap = planLifeRoadmap(snap({
      needs: { ...goodNeeds, hunger: 20 },
      money: 500,
    }), 2)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'eat-food',
      route: { kind: 'market', focus: 'food' },
    })
    expect(roadmap.days[1].primary.id).toBe('find-job')
    expect(roadmap.finalSnapshot.needs.hunger).toBeGreaterThan(35)
    expect(roadmap.finalSnapshot.money).toBeLessThan(500)
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
  })

  test('projects sleep recovery before returning to work', () => {
    const roadmap = planLifeRoadmap(snap({
      needs: { ...goodNeeds, energy: 25 },
    }), 2)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'sleep-tonight',
      route: { kind: 'survival-action', action: 'sleep' },
    })
    expect(roadmap.days[1].primary.id).toBe('find-job')
    expect(roadmap.finalSnapshot.needs.energy).toBeGreaterThan(30)
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
  })

  test('projects the first education course as paid enrollment before XP', () => {
    const roadmap = planLifeRoadmap(snap({
      money: 500,
      jobId: 'barista',
      shiftsWorked: 1,
    }), 1)

    expect(roadmap.days[0].primary).toMatchObject({
      id: 'study-first-course',
      route: { kind: 'market', focus: 'education' },
    })
    expect(roadmap.finalSnapshot.educationActions).toBe(0)
    expect(roadmap.finalSnapshot.xp).toBe(0)
    expect(roadmap.finalSnapshot.money).toBe(502)
    expect(roadmap.finalSnapshot.educationProgress[0]).toMatchObject({
      courseId: 'course',
      studiedMinutes: 0,
      completedAt: null,
    })
    expect(roadmap.days[0]).toMatchObject({
      startingMoney: 500,
      endingMoney: 502,
      projectedCashDelta: 82,
      actualCashDelta: 2,
    })
  })

  test('projects enrolled course study into completion XP', () => {
    const roadmap = planLifeRoadmap(snap({
      money: 500,
      jobId: 'barista',
      shiftsWorked: 1,
    }), 2)

    expect(roadmap.days.map((day) => day.primary.id)).toEqual([
      'study-first-course',
      'study-course',
    ])
    expect(roadmap.finalSnapshot.educationActions).toBe(1)
    expect(roadmap.finalSnapshot.xp).toBe(40)
    expect(roadmap.finalSnapshot.level).toBe(1)
    expect(roadmap.finalSnapshot.educationProgress[0]).toMatchObject({
      courseId: 'course',
      studiedMinutes: 60,
    })
    expect(roadmap.finalSnapshot.educationProgress[0].completedAt).toBeTypeOf('number')
  })

  test('keeps the first-month life loop clear from survival routine to house and business foundation', () => {
    const roadmap = planLifeRoadmap(snap({ money: 30_000 }), 30)
    const primaryIds = roadmap.days.map((day) => day.primary.id)

    expect(primaryIds.slice(0, 4)).toEqual([
      'find-job',
      'first-shift',
      'study-first-course',
      'study-course',
    ])
    expect(roadmap.days[1].routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      taskId: 'place-home-foundation',
    })
    expect(primaryIds[4]).toBe('gather-wood')
    expect(primaryIds).toEqual(expect.arrayContaining([
      'deposit-house-materials',
      'pay-house-permit',
      'hire-house-worker-hour',
      'gather-business-building-wood',
      'gather-business-building-stone',
    ]))
    expect(primaryIds.some((id) => id.startsWith('gather-'))).toBe(true)
    const firstGatherWood = roadmap.days.find((day) => day.primary.id === 'gather-wood')
    expect(firstGatherWood).toMatchObject({
      startingResources: expect.objectContaining({ wood: expect.any(Number) }),
      endingResources: expect.objectContaining({ wood: expect.any(Number) }),
      resourceDelta: expect.objectContaining({ wood: expect.any(Number) }),
    })
    expect(firstGatherWood?.endingResources.wood ?? 0).toBeGreaterThan(firstGatherWood?.startingResources.wood ?? 0)
    expect(firstGatherWood?.resourceDelta.wood ?? 0).toBeGreaterThan(0)

    const houseDeposit = roadmap.days.find((day) => day.primary.id === 'deposit-house-materials')
    expect(houseDeposit?.resourceDelta.wood ?? 0).toBeLessThan(0)
    expect(houseDeposit?.endingResources.wood ?? 0).toBeLessThan(houseDeposit?.startingResources.wood ?? 0)

    for (const day of roadmap.days) {
      expect(day.routine.map((block) => block.id)).toEqual([
        'sleep-block',
        'body-block',
        'work-block',
        'growth-block',
        'free-time-block',
      ])
      expect(day.routine[0].route).toEqual({ kind: 'survival-action', action: 'sleep' })
      expect(day.routineValues).toEqual(expect.arrayContaining(['body', 'work', 'capital']))
    }

    expect(roadmap.finalSnapshot.jobId).toBe('barista')
    expect(roadmap.finalSnapshot.shiftsWorked).toBeGreaterThan(0)
    expect(roadmap.finalSnapshot.educationActions).toBeGreaterThan(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)

    const businessBuild = roadmap.finalSnapshot.constructionProjects.find((project) => project.resultKind === 'business')
    expect(businessBuild).toMatchObject({
      name: 'Food Cart',
      resultKind: 'business',
    })
    expect(businessBuild?.laborDoneMinutes ?? 0).toBeGreaterThanOrEqual(0)
  })

  test('exposes the first business saving step before the foundation purchase becomes affordable', () => {
    const roadmap = planLifeRoadmap(snap({
      money: 12_000,
      assets: [home()],
      communityActionsThisWeek: 1,
      communityRespect: 3,
      communityFriendship: 3,
      communityTrust: 3,
    }), 20)
    const primaryIds = roadmap.days.map((day) => day.primary.id)

    expect(primaryIds).toContain('work-for-first-business-foundation')
    expect(primaryIds.indexOf('work-for-first-business-foundation')).toBeGreaterThanOrEqual(0)
  })

  test('projects the second month through business foundation labor and interior upgrade', () => {
    const roadmap = planLifeRoadmap(snap({ money: 30_000 }), 54)
    const primaryIds = roadmap.days.map((day) => day.primary.id)

    expect(roadmap.horizonDays).toBe(54)
    expect(primaryIds.indexOf('deposit-business-building-materials')).toBeGreaterThan(primaryIds.indexOf('gather-business-building-wood'))
    expect(primaryIds.indexOf('pay-business-building-permit')).toBeGreaterThan(primaryIds.indexOf('deposit-business-building-materials'))
    expect(primaryIds.indexOf('plan-business-development')).toBeGreaterThan(primaryIds.indexOf('pay-business-building-permit'))
    expect(primaryIds.indexOf('deposit-business-materials')).toBeGreaterThan(primaryIds.indexOf('gather-business-wood'))
    expect(primaryIds.indexOf('pay-business-budget')).toBeGreaterThan(primaryIds.indexOf('deposit-business-materials'))
    expect(primaryIds.filter((id) => id === 'hire-business-worker-hour').length).toBeGreaterThanOrEqual(2)
    expect(roadmap.finalSnapshot.constructionProjects).toEqual([])
    expect(roadmap.finalSnapshot.assets.find((asset) => asset.kind === 'business')).toMatchObject({
      name: 'Food Cart',
      kind: 'business',
      level: 2,
      incomePerDay: 400,
    })
    expect(roadmap.finalSnapshot.businessDevelopmentProjects[0]).toMatchObject({
      businessName: 'Food Cart',
      levelFrom: 2,
      levelTo: 3,
    })
  })

  test('caps long roadmap audits at two months', () => {
    const roadmap = planLifeRoadmap(snap({ money: 30_000 }), 99)

    expect(roadmap.horizonDays).toBe(60)
    expect(roadmap.days).toHaveLength(60)
  })

  test('surfaces community work at least weekly in the first 60-day curriculum', () => {
    const roadmap = planLifeRoadmap(snap({ money: 30_000 }), 60)

    for (let week = 0; week < 8; week += 1) {
      const weekDays = roadmap.days.slice(week * 7, week * 7 + 7)
      expect(
        weekDays.some((day) => day.primary.value === 'community' || day.routineValues.includes('community')),
        `missing community in week ${week + 1}`,
      ).toBe(true)
    }

    const firstCommunityGrowth = roadmap.days.find((day) =>
      day.communityRespectDelta > 0 ||
      day.communityFriendshipDelta > 0 ||
      day.communityTrustDelta > 0
    )
    expect(firstCommunityGrowth).toMatchObject({
      startingCommunityRespect: expect.any(Number),
      endingCommunityRespect: expect.any(Number),
      communityRespectDelta: expect.any(Number),
      startingCommunityFriendship: expect.any(Number),
      endingCommunityFriendship: expect.any(Number),
      communityFriendshipDelta: expect.any(Number),
      startingCommunityTrust: expect.any(Number),
      endingCommunityTrust: expect.any(Number),
      communityTrustDelta: expect.any(Number),
    })
    expect(
      (firstCommunityGrowth?.communityRespectDelta ?? 0) +
      (firstCommunityGrowth?.communityFriendshipDelta ?? 0) +
      (firstCommunityGrowth?.communityTrustDelta ?? 0),
    ).toBeGreaterThan(0)
  })

  test('projects routed Workers Hall helper hours into a completed house asset', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForFinalHelperBlock = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 120,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 1_000,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [readyForFinalHelperBlock],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('hire-house-worker-hour')
    expect(roadmap.days[0].primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 2 })
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
  })

  test('projects helper house work through the paid worker contract ledger', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForHelperBlock = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 180,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 1_000,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [readyForHelperBlock],
    }), 1)

    const remainingProject = roadmap.finalSnapshot.constructionProjects[0]
    expect(roadmap.days[0].primary.id).toBe('hire-house-worker-hour')
    expect(remainingProject.laborDoneMinutes).toBe(project.laborRequiredMinutes - 60)
    expect(remainingProject.hiredLaborMinutes).toBe(120)
    expect(remainingProject.workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      hiredAt: 10 * DAY_MS,
      paidUntil: 10 * DAY_MS + 2 * 60 * 60 * 1000,
      paidMinutes: 120,
      workedMinutes: 120,
    })
  })

  test('carries build ETA detail on each roadmap day', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForHelperBlock = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 180,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 1_000,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [readyForHelperBlock],
    }), 1)

    expect(roadmap.days[0]).toMatchObject({
      primary: { id: 'hire-house-worker-hour' },
      buildEta: 'Build ETA: 3d solo · 1d with helper · finish day 10 · $32/helper day · hire today',
      interiorEta: null,
    })
  })

  test('spends roadmap community helper credit once across repeated house helper hires', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const laborRequiredMinutes = project.laborRequiredMinutes + 300
    const readyForTwoHelperBlocks = {
      ...project,
      laborRequiredMinutes,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: laborRequiredMinutes - 300,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 156,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      communityRespect: 3,
      constructionProjects: [readyForTwoHelperBlocks],
    }), 2)

    const remainingProject = roadmap.finalSnapshot.constructionProjects[0]
    expect(roadmap.days.map((day) => day.primary.id)).toEqual(['hire-house-worker-hour', 'hire-house-worker-hour'])
    expect(remainingProject.workerContracts).toHaveLength(2)
    expect(remainingProject.workerContracts[0]).toMatchObject({
      cost: 24,
      communityCreditMinutes: 30,
      communityCreditValue: 8,
    })
    expect(remainingProject.workerContracts[1]).toMatchObject({
      cost: 32,
      communityCreditMinutes: 0,
      communityCreditValue: 0,
    })
    expect(roadmap.finalSnapshot.communityHelperMinutesUsedThisWeek).toBe(30)
  })

  test('resets projected community helper credit on the next roadmap week', () => {
    const roadmap = planLifeRoadmap(snap({
      lifeDay: 7,
      jobId: 'barista',
      shiftsWorked: 5,
      communityHelperMinutesUsedThisWeek: 30,
    }), 1)

    expect(roadmap.finalSnapshot.lifeDay).toBe(8)
    expect(roadmap.finalSnapshot.communityHelperMinutesUsedThisWeek).toBe(0)
  })

  test('lets an active paid house helper finish during a monitor day', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForActiveHelper = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 120,
    }
    const hired = hireConstructionWorker(readyForActiveHelper, 'helper', 1_000, 2, 10 * DAY_MS)

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: hired.money,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [hired.project],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('monitor-house-worker-finish')
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
  })

  test('projects cash-tight free-time labor into a completed house without hiring help', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const readyForFinalPlayerHour = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 100,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      constructionProjects: [readyForFinalPlayerHour],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('build-house-hour')
    expect(roadmap.days[0].primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'work' })
    expect(roadmap.days[0]).toMatchObject({
      startingAssetCount: 0,
      endingAssetCount: 1,
      assetCountDelta: 1,
      startingConstructionProjectCount: 1,
      endingConstructionProjectCount: 0,
      constructionProjectCountDelta: -1,
    })
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
  })

  test('clears stale completed house construction without duplicating the roadmap asset', () => {
    const project = {
      ...createConstructionProject('starter-house', 45, 21, 10),
      deposited: freshResources({ wood: 120, stone: 60, metal: 20, glass: 10 }),
      permitFeePaid: true,
      laborDoneMinutes: 480,
    }
    const existingHome = {
      ...home(),
      id: `${project.id}:asset`,
      lat: project.lat,
      lng: project.lng,
      placedAtMinute: 10 * 24 * 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 10,
      money: 1_000,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      assets: [existingHome],
      constructionProjects: [project],
    }), 1)

    expect(roadmap.finalSnapshot.constructionProjects).toEqual([])
    expect(roadmap.finalSnapshot.assets.filter((asset) => asset.id === existingHome.id)).toHaveLength(1)
    expect(roadmap.finalSnapshot.assets.filter((asset) =>
      asset.kind === 'home' &&
      asset.itemId === project.itemId &&
      asset.lat === project.lat &&
      asset.lng === project.lng
    )).toHaveLength(1)
  })

  test('clears stale completed business foundation construction without duplicating the roadmap asset', () => {
    const project = {
      ...createConstructionProjectFromRecipe(
        businessConstructionRecipe({ id: 'foodcart', name: 'Food Cart', price: 15_000, incomePerDay: 200 }),
        45,
        21,
        20,
      ),
      deposited: freshResources({ wood: 45, stone: 30, metal: 25, glass: 10 }),
      permitFeePaid: true,
      laborDoneMinutes: 480,
    }
    const existingBusiness = {
      ...business(),
      id: `${project.id}:asset`,
      lat: project.lat,
      lng: project.lng,
      placedAtMinute: 20 * 24 * 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: 2_000,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      assets: [home(), existingBusiness],
      constructionProjects: [project],
    }), 1)

    expect(roadmap.finalSnapshot.constructionProjects).toEqual([])
    expect(roadmap.finalSnapshot.assets.filter((asset) => asset.id === existingBusiness.id)).toHaveLength(1)
    expect(roadmap.finalSnapshot.assets.filter((asset) =>
      asset.kind === 'business' &&
      asset.itemId === project.itemId &&
      asset.lat === project.lat &&
      asset.lng === project.lng
    )).toHaveLength(1)
  })

  test('projects business interior labor into an upgraded earning asset', () => {
    const asset = business()
    const project = createBusinessDevelopmentProject(asset, 1)
    if (!project) throw new Error('business development fixture failed')
    const readyForFinalHour = {
      ...project,
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 60,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: 2_000,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityActionsThisWeek: 1,
      assets: [home(), asset],
      businessDevelopmentProjects: [readyForFinalHour],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('hire-business-worker-hour')
    expect(roadmap.days[0].primary.route).toEqual({ kind: 'business-development-action', projectId: readyForFinalHour.id, action: 'hire-helper', hours: 1 })
    expect(roadmap.finalSnapshot.businessDevelopmentProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.find((candidate) => candidate.id === asset.id)).toMatchObject({
      level: readyForFinalHour.levelTo,
      incomePerDay: readyForFinalHour.incomeAfter,
    })
  })

  test('projects helper business interior work through the paid worker contract ledger', () => {
    const asset = business()
    const project = createBusinessDevelopmentProject(asset, 1)
    if (!project) throw new Error('business development fixture failed')
    const laborRequiredMinutes = project.laborRequiredMinutes + 180
    const readyForHelperBlock = {
      ...project,
      laborRequiredMinutes,
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: laborRequiredMinutes - 180,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: 2_000,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityActionsThisWeek: 1,
      assets: [home(), asset],
      businessDevelopmentProjects: [readyForHelperBlock],
    }), 1)

    const remainingProject = roadmap.finalSnapshot.businessDevelopmentProjects[0]
    expect(roadmap.days[0].primary.id).toBe('hire-business-worker-hour')
    expect(remainingProject.laborDoneMinutes).toBe(laborRequiredMinutes - 60)
    expect(remainingProject.hiredLaborMinutes).toBe(120)
    expect(remainingProject.workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      hiredAt: 20 * DAY_MS,
      paidUntil: 20 * DAY_MS + 2 * 60 * 60 * 1000,
      paidMinutes: 120,
      workedMinutes: 120,
    })
  })

  test('lets an active paid business helper finish during a monitor day', () => {
    const asset = business()
    const project = createBusinessDevelopmentProject(asset, 1)
    if (!project) throw new Error('business development fixture failed')
    const readyForActiveHelper = {
      ...project,
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 60,
    }
    const hired = hireBusinessDevelopmentWorker(readyForActiveHelper, 'helper', 2_000, 1, 20 * DAY_MS)

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: hired.money,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityActionsThisWeek: 1,
      assets: [home(), asset],
      businessDevelopmentProjects: [hired.project],
    }), 1)

    expect(roadmap.days[0].primary.id).toBe('monitor-business-worker-finish')
    expect(roadmap.finalSnapshot.businessDevelopmentProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.find((candidate) => candidate.id === asset.id)).toMatchObject({
      kind: 'business',
      level: project.levelTo,
      incomePerDay: project.incomeAfter,
    })
  })

  test('carries community-backed interior ETA detail on roadmap days', () => {
    const asset = business()
    const project = createBusinessDevelopmentProject(asset, 1)
    if (!project) throw new Error('business development fixture failed')
    const readyForHelperBlock = {
      ...project,
      deposited: freshResources(project.required),
      budgetPaid: true,
    }

    const roadmap = planLifeRoadmap(snap({
      lifeDay: 20,
      money: 124,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityRespect: 3,
      communityActionsThisWeek: 1,
      assets: [home(), asset],
      businessDevelopmentProjects: [readyForHelperBlock],
    }), 1)

    expect(roadmap.days[0]).toMatchObject({
      primary: { id: 'hire-business-worker-hour' },
      buildEta: null,
      interiorEta: 'Interior ETA: 3d solo · 1d with helper · finish day 20 · $24/helper day · community -$8 · hire today',
    })
  })

  test('projects the first business from map placement into interior development', () => {
    const launchSnapshot = snap({
      lifeDay: 8,
      money: 30_000,
      level: 2,
      xp: 40,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      assets: [home()],
      resources: freshResources({ wood: 500, stone: 500, metal: 500, glass: 500 }),
      communityActionsThisWeek: 1,
      communityRespect: 5,
      communityFriendship: 5,
      communityTrust: 5,
    })

    const roadmap = planLifeRoadmap(launchSnapshot, 1)
    expect(roadmap.days[0].primary).toMatchObject({
      id: 'build-first-business',
      route: { kind: 'market', focus: 'business' },
    })
    expect(roadmap.finalSnapshot.money).toBeLessThan(16_000)
    expect(roadmap.finalSnapshot.money).toBeGreaterThan(15_000)
    expect(roadmap.finalSnapshot.assets.filter((asset) => asset.kind === 'business')).toEqual([])
    expect(roadmap.finalSnapshot.businessDevelopmentProjects).toEqual([])
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(1)
    expect(roadmap.days[0]).toMatchObject({
      startingAssetCount: 1,
      endingAssetCount: 1,
      assetCountDelta: 0,
      startingConstructionProjectCount: 0,
      endingConstructionProjectCount: 1,
      constructionProjectCountDelta: 1,
    })
    expect(roadmap.finalSnapshot.constructionProjects[0]).toMatchObject({
      name: 'Food Cart',
      resultKind: 'business',
      incomePerDay: 200,
      permitFeePaid: false,
      laborDoneMinutes: 0,
    })

    const built = planLifeRoadmap(launchSnapshot, 7)
    expect(built.days.map((day) => day.primary.id)).toEqual([
      'build-first-business',
      'deposit-business-building-materials',
      'pay-business-building-permit',
      'hire-business-building-worker-hour',
      'hire-business-building-worker-hour',
      'hire-business-building-worker-hour',
      'hire-business-building-worker-hour',
    ])
    expect(built.finalSnapshot.constructionProjects).toEqual([])
    expect(built.finalSnapshot.businessDevelopmentProjects).toEqual([])
    expect(built.days[6]).toMatchObject({
      startingAssetCount: 1,
      endingAssetCount: 2,
      assetCountDelta: 1,
      startingConstructionProjectCount: 1,
      endingConstructionProjectCount: 0,
      constructionProjectCountDelta: -1,
    })
    const builtBusiness = built.finalSnapshot.assets.find((asset) => asset.kind === 'business')
    expect(builtBusiness).toMatchObject({
      name: 'Food Cart',
      kind: 'business',
      incomePerDay: 200,
    })
    expect(builtBusiness?.level ?? 1).toBe(1)

    const interiorPlanned = planLifeRoadmap(launchSnapshot, 8)
    expect(interiorPlanned.days[7].primary).toMatchObject({
      id: 'plan-business-development',
      route: { kind: 'panel', panel: 'business' },
    })
    expect(interiorPlanned.finalSnapshot.constructionProjects).toEqual([])
    expect(interiorPlanned.finalSnapshot.businessDevelopmentProjects).toHaveLength(1)
    expect(interiorPlanned.days[7]).toMatchObject({
      startingBusinessDevelopmentProjectCount: 0,
      endingBusinessDevelopmentProjectCount: 1,
      businessDevelopmentProjectCountDelta: 1,
    })
    expect(interiorPlanned.finalSnapshot.businessDevelopmentProjects[0]).toMatchObject({
      businessId: builtBusiness?.id,
      businessName: 'Food Cart',
      levelFrom: 1,
      levelTo: 2,
      incomeBefore: 200,
      incomeAfter: 400,
    })

    const upgraded = planLifeRoadmap(launchSnapshot, 12)
    expect(upgraded.days.slice(7).map((day) => day.primary.id)).toEqual([
      'plan-business-development',
      'deposit-business-materials',
      'pay-business-budget',
      'hire-business-worker-hour',
      'hire-business-worker-hour',
    ])
    expect(upgraded.finalSnapshot.constructionProjects).toEqual([])
    expect(upgraded.finalSnapshot.businessDevelopmentProjects).toEqual([])
    expect(upgraded.days[11]).toMatchObject({
      startingAssetCount: 2,
      endingAssetCount: 2,
      assetCountDelta: 0,
      startingBusinessDevelopmentProjectCount: 1,
      endingBusinessDevelopmentProjectCount: 0,
      businessDevelopmentProjectCountDelta: -1,
    })
    expect(upgraded.finalSnapshot.assets.find((asset) => asset.id === builtBusiness?.id)).toMatchObject({
      kind: 'business',
      name: 'Food Cart',
      level: 2,
      incomePerDay: 400,
    })
  })
})
