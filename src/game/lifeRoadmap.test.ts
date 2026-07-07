import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, hireBusinessDevelopmentWorker } from './businessDevelopment'
import { createConstructionProject, hireConstructionWorker } from './construction'
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
    expect(roadmap.days[0].primary.id).toBe('find-job')
    expect(roadmap.days[1].primary.id).toBe('first-shift')
    expect(roadmap.days[2].primary.id).toBe('study-first-course')
    expect(roadmap.days[3].primary.id).toBe('place-home-foundation')
    expect(roadmap.days.some((day) => day.primary.id.startsWith('gather-'))).toBe(true)
    expect(roadmap.valuesCovered).toEqual(expect.arrayContaining(['body', 'work', 'school', 'capital']))
    expect(roadmap.finalSnapshot.jobId).toBe('barista')
    expect(roadmap.finalSnapshot.educationActions).toBeGreaterThan(0)
    expect(roadmap.finalSnapshot.constructionProjects.length).toBe(1)
  })

  test('keeps the first-month life loop clear from survival routine to house and business shell', () => {
    const roadmap = planLifeRoadmap(snap({ money: 30_000 }), 30)
    const primaryIds = roadmap.days.map((day) => day.primary.id)

    expect(primaryIds.slice(0, 4)).toEqual([
      'find-job',
      'first-shift',
      'study-first-course',
      'place-home-foundation',
    ])
    expect(primaryIds).toEqual(expect.arrayContaining([
      'deposit-house-materials',
      'pay-house-permit',
      'hire-house-worker-hour',
      'build-first-business',
      'deposit-business-building-materials',
      'pay-business-building-permit',
      'hire-business-building-worker-hour',
    ]))
    expect(primaryIds.some((id) => id.startsWith('gather-'))).toBe(true)

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
      permitFeePaid: true,
    })
    expect(businessBuild?.workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      paidMinutes: 120,
      workedMinutes: 120,
    })
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
    expect(roadmap.finalSnapshot.constructionProjects).toHaveLength(0)
    expect(roadmap.finalSnapshot.assets.some((asset) => asset.kind === 'home')).toBe(true)
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

  test('projects the first business from map shell into interior development', () => {
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

    const shell = planLifeRoadmap(launchSnapshot, 1)
    expect(shell.days[0].primary).toMatchObject({
      id: 'build-first-business',
      route: { kind: 'market', focus: 'business' },
    })
    expect(shell.finalSnapshot.assets.filter((asset) => asset.kind === 'business')).toEqual([])
    expect(shell.finalSnapshot.businessDevelopmentProjects).toEqual([])
    expect(shell.finalSnapshot.constructionProjects).toHaveLength(1)
    expect(shell.finalSnapshot.constructionProjects[0]).toMatchObject({
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
    expect(upgraded.finalSnapshot.assets.find((asset) => asset.id === builtBusiness?.id)).toMatchObject({
      kind: 'business',
      name: 'Food Cart',
      level: 2,
      incomePerDay: 400,
    })
  })
})
