import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, type BusinessDevelopmentProject } from './businessDevelopment'
import {
  STARTER_HOUSE_RECIPE,
  businessConstructionRecipe,
  createConstructionProject,
  createConstructionProjectFromRecipe,
} from './construction'
import { constructionDayForecast, planLifeDay, type LifeLadderSnapshot } from './lifeLadder'
import { freshResources } from './resources'
import type { PlacedAsset } from './types'

const goodNeeds = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 70 }

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
    resources: freshResources(),
    constructionProjects: [],
    businessDevelopmentProjects: [],
    educationActions: 0,
    communityActionsThisWeek: 0,
    ...overrides,
  }
}

const business = (): PlacedAsset => ({
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
})

function businessProject(overrides: Partial<BusinessDevelopmentProject> = {}): BusinessDevelopmentProject {
  const project = createBusinessDevelopmentProject(business(), 1_700_000_000_000)
  if (!project) throw new Error('business project fixture failed')
  return { ...project, ...overrides }
}

function businessConstructionProject() {
  return createConstructionProjectFromRecipe(
    businessConstructionRecipe({ id: 'foodcart', name: 'Food Cart', price: 15_000, incomePerDay: 240 }),
    1,
    1,
    1,
  )
}

describe('planLifeDay', () => {
  test('returns exactly one primary action with life values attached', () => {
    const plan = planLifeDay(snap())
    expect(plan.primary).toBeTruthy()
    expect(plan.agenda[0].id).toBe(plan.primary.id)
    expect(plan.agenda.length).toBeLessThanOrEqual(3)
    expect(plan.support.length).toBeGreaterThan(0)
    expect(plan.routine.map((block) => block.id)).toEqual([
      'sleep-block',
      'body-block',
      'work-block',
      'growth-block',
      'free-time-block',
    ])
    expect(plan.valuesCovered).toEqual(expect.arrayContaining(['body', 'school', 'work', 'respect', 'friendship', 'community', 'capital']))
  })

  test('builds an employed 24-hour routine around sleep, work, and free-time ownership', () => {
    const plan = planLifeDay(snap({
      lifeDay: 6,
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
    }))

    expect(plan.routine.reduce((sum, block) => sum + block.minutes, 0)).toBe(24 * 60)
    expect(plan.routine.find((block) => block.id === 'sleep-block')).toMatchObject({ minutes: 480, value: 'body' })
    expect(plan.routine.find((block) => block.id === 'work-block')).toMatchObject({ minutes: 480, value: 'work' })
    expect(plan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({ minutes: 360, value: 'capital' })
  })

  test('puts body recovery before work and construction while preserving the next step', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      constructionProjects: [createConstructionProject('starter-house', 1, 1, 1)],
      needs: { ...goodNeeds, hydration: 20 },
    }))

    expect(plan.primary.id).toBe('drink-water')
    expect(plan.primary.value).toBe('body')
    expect(plan.agenda.map((item) => item.id)).toEqual(expect.arrayContaining(['drink-water']))
    expect(plan.agenda.some((item) => item.id.startsWith('gather-') || item.id === 'deposit-house-materials')).toBe(true)
  })

  test('sends an unemployed citizen to find work before capital tasks', () => {
    const plan = planLifeDay(snap({ money: 50 }))

    expect(plan.primary.id).toBe('find-job')
    expect(plan.primary.value).toBe('work')
  })

  test('adds school as the early-life primary once body, work, and cash are safe', () => {
    const plan = planLifeDay(snap({
      lifeDay: 3,
      jobId: 'barista',
      shiftsWorked: 1,
      money: 500,
      educationActions: 0,
      level: 1,
      xp: 0,
    }))

    expect(plan.primary.id).toBe('study-first-course')
    expect(plan.primary.value).toBe('school')
  })

  test('never invents high-income tasks for a player with no business', () => {
    const plan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, money: 150 }))
    const ids = [plan.primary, ...plan.support].map((item) => item.id)

    expect(ids).not.toContain('earn-1000')
    expect(ids).not.toContain('earn-2000')
    expect(plan.primary.title).not.toMatch(/\$1,000|\$2,000/)
  })

  test('surfaces community help once weekly survival and build blockers are clear', () => {
    const plan = planLifeDay(snap({
      lifeDay: 5,
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
      communityActionsThisWeek: 0,
    }))

    expect(plan.primary.id).toBe('help-local-person')
    expect(plan.primary.value).toBe('community')
  })

  test('routes a house project through materials, permit, worker help, then fallback labor', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const gatherPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-|deposit-house-materials$/)

    const readyForPermit = {
      ...project,
      deposited: freshResources(project.required),
    }
    const permitPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 1_000, constructionProjects: [readyForPermit] }))
    expect(permitPlan.primary.id).toBe('pay-house-permit')

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const workerPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [readyForLabor] }))
    expect(workerPlan.primary.id).toBe('hire-house-worker-hour')
    expect(workerPlan.primary.detail).toContain('$16/hour')
    expect(workerPlan.agenda[0].id).toBe('hire-house-worker-hour')
    expect(workerPlan.agenda.map((item) => item.id)).toContain('support-body')
    expect(workerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'construction' },
      taskId: 'hire-house-worker-hour',
    })

    const selfLaborPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 100, constructionProjects: [readyForLabor] }))
    expect(selfLaborPlan.primary.id).toBe('build-house-hour')
    expect(selfLaborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'construction' },
      taskId: 'build-house-hour',
    })
  })

  test('routes active business building through materials, permit, labor, and opening after the house exists', () => {
    const base = {
      lifeDay: 8,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home' as const, incomePerDay: 0 }],
      communityActionsThisWeek: 0,
    }
    const project = businessConstructionProject()

    const gatherPlan = planLifeDay(snap({ ...base, constructionProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-business-building-|deposit-business-building-materials$/)
    expect(gatherPlan.primary.route).toEqual({ kind: 'panel', panel: 'construction' })
    expect(gatherPlan.agenda.map((item) => item.id)).toContain(gatherPlan.primary.id)
    expect(gatherPlan.constructionForecast?.remainingLaborMinutes).toBe(project.laborRequiredMinutes)

    const readyForPermit = {
      ...project,
      deposited: freshResources(project.required),
    }
    const permitPlan = planLifeDay(snap({ ...base, money: 1_000, constructionProjects: [readyForPermit] }))
    expect(permitPlan.primary.id).toBe('pay-business-building-permit')
    expect(permitPlan.primary.value).toBe('respect')

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const laborPlan = planLifeDay(snap({ ...base, constructionProjects: [readyForLabor] }))
    expect(laborPlan.primary.id).toBe('hire-business-building-worker-hour')
    expect(laborPlan.primary.title).toBe('Hire 1h helper for Food Cart')
    expect(laborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'construction' },
      taskId: 'hire-business-building-worker-hour',
    })

    const cashTightLaborPlan = planLifeDay(snap({ ...base, money: 100, constructionProjects: [readyForLabor] }))
    expect(cashTightLaborPlan.primary.id).toBe('build-business-building-hour')
    expect(cashTightLaborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'construction' },
      taskId: 'build-business-building-hour',
    })

    const completeReady = {
      ...readyForLabor,
      laborDoneMinutes: project.laborRequiredMinutes,
    }
    const finishPlan = planLifeDay(snap({ ...base, constructionProjects: [completeReady] }))
    expect(finishPlan.primary.id).toBe('complete-business-building')
    expect(finishPlan.primary.title).toBe('Open Food Cart')
  })

  test('routes active business development through materials, budget, worker, and completion', () => {
    const base = {
      lifeDay: 8,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home' as const, incomePerDay: 0 }, { kind: 'business' as const, incomePerDay: 240 }],
      communityActionsThisWeek: 0,
    }
    const project = businessProject()

    const gatherPlan = planLifeDay(snap({ ...base, businessDevelopmentProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-business-/)
    expect(gatherPlan.primary.route).toEqual({ kind: 'panel', panel: 'construction' })

    const depositPlan = planLifeDay(snap({
      ...base,
      resources: freshResources(project.required),
      businessDevelopmentProjects: [project],
    }))
    expect(depositPlan.primary.id).toBe('deposit-business-materials')
    expect(depositPlan.primary.route).toEqual({ kind: 'panel', panel: 'business' })

    const resourcesReady = businessProject({ deposited: freshResources(project.required) })
    const budgetPlan = planLifeDay(snap({ ...base, money: resourcesReady.budgetCost + 500, businessDevelopmentProjects: [resourcesReady] }))
    expect(budgetPlan.primary.id).toBe('pay-business-budget')
    expect(budgetPlan.primary.value).toBe('respect')

    const workForBudgetPlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [resourcesReady] }))
    expect(workForBudgetPlan.primary.id).toBe('work-for-business-budget')
    expect(workForBudgetPlan.primary.value).toBe('work')

    const laborReady = businessProject({ deposited: freshResources(project.required), budgetPaid: true })
    const hirePlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [laborReady] }))
    expect(hirePlan.primary.id).toBe('hire-business-worker-hour')
    expect(hirePlan.primary.route).toEqual({ kind: 'panel', panel: 'business' })
    expect(hirePlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'business' },
      taskId: 'hire-business-worker-hour',
    })

    const selfWorkPlan = planLifeDay(snap({ ...base, money: 100, businessDevelopmentProjects: [laborReady] }))
    expect(selfWorkPlan.primary.id).toBe('develop-business-hour')

    const completeReady = businessProject({
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes,
    })
    const finishPlan = planLifeDay(snap({ ...base, businessDevelopmentProjects: [completeReady] }))
    expect(finishPlan.primary.id).toBe('finish-business-development')
  })

  test('plans the next business upgrade before generic community help when ownership is stable', () => {
    const plan = planLifeDay(snap({
      lifeDay: 10,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }, { kind: 'business', incomePerDay: 240 }],
      communityActionsThisWeek: 0,
    }))

    expect(plan.primary.id).toBe('plan-business-development')
    expect(plan.primary.route).toEqual({ kind: 'panel', panel: 'business' })
    expect(plan.agenda.map((item) => item.id)).toContain('help-local-person')
  })
})

describe('constructionDayForecast', () => {
  test('matches the mandatory Starter House resource and labor math', () => {
    const forecast = constructionDayForecast()
    const trips = Object.fromEntries(forecast.resourceTrips.map((item) => [item.kind, item.trips]))

    expect(STARTER_HOUSE_RECIPE.required).toEqual({ wood: 120, stone: 60, metal: 20, glass: 10 })
    expect(STARTER_HOUSE_RECIPE.permitFee).toBe(500)
    expect(STARTER_HOUSE_RECIPE.laborRequiredMinutes).toBe(480)
    expect(trips).toEqual({ wood: 5, stone: 4, metal: 3, glass: 2 })
    expect(forecast.totalGatherMinutes).toBe(99)
    expect(forecast.playerOnlyDaysAtOneHour).toBe(8)
    expect(forecast.playerOnlyDaysAtTwoHours).toBe(4)
    expect(forecast.helperTwoHourDays).toBe(3)
    expect(forecast.helperTwoHourLaborMinutes).toBe(120)
    expect(forecast.helperTwoHourCost).toBe(32)
    expect(forecast.helperTwoHourAffordableToday).toBe(false)
    expect(forecast.helperTwoHourCashNeeded).toBe(132)
  })

  test('shows when a 2h helper plan is safe above the survival cash floor', () => {
    const project = {
      ...createConstructionProject('starter-house', 1, 1, 1),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 120,
    }

    const forecast = constructionDayForecast(project, freshResources(), 500)

    expect(forecast.remainingLaborMinutes).toBe(360)
    expect(forecast.playerOnlyDaysAtOneHour).toBe(6)
    expect(forecast.helperTwoHourDays).toBe(2)
    expect(forecast.totalGatherMinutes).toBe(0)
    expect(forecast.helperTwoHourAffordableToday).toBe(true)
    expect(forecast.helperTwoHourCashNeeded).toBe(0)
  })
})
