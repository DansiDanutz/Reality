import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, type BusinessDevelopmentProject } from './businessDevelopment'
import {
  STARTER_HOUSE_RECIPE,
  businessConstructionRecipe,
  createConstructionProject,
  createConstructionProjectFromRecipe,
} from './construction'
import { EDUCATION_COURSES, createEducationProgress } from './education'
import { businessDevelopmentDayForecast, constructionDayForecast, planLifeDay, type LifeLadderSnapshot } from './lifeLadder'
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
    inventory: {},
    resources: freshResources(),
    constructionProjects: [],
    businessDevelopmentProjects: [],
    educationActions: 0,
    educationProgress: [],
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
    expect(plan.routine.find((block) => block.id === 'sleep-block')).toMatchObject({
      minutes: 480,
      value: 'body',
      route: { kind: 'survival-action', action: 'sleep' },
    })
    expect(plan.routine.find((block) => block.id === 'work-block')).toMatchObject({
      minutes: 480,
      value: 'work',
      route: { kind: 'work-action', action: 'shift' },
    })
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
    expect(plan.primary.route).toEqual({ kind: 'survival-action', action: 'drink-water' })
    expect(plan.agenda.map((item) => item.id)).toEqual(expect.arrayContaining(['drink-water']))
    expect(plan.agenda.some((item) => item.id.startsWith('gather-') || item.id === 'deposit-house-materials')).toBe(true)
  })

  test('starts sleep directly when energy blocks the day', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, energy: 25 },
    }))

    expect(plan.primary.id).toBe('sleep-tonight')
    expect(plan.primary.value).toBe('body')
    expect(plan.primary.route).toEqual({ kind: 'survival-action', action: 'sleep' })
  })

  test('makes critical hunger consume owned food as the primary action', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 20 },
      inventory: { noodles: 1, sandwich: 1 },
    }))

    expect(plan.primary.id).toBe('eat-food')
    expect(plan.primary.route).toEqual({ kind: 'consume-action', itemId: 'sandwich' })
  })

  test('makes critical hunger cook a ready home meal before opening the market', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 20 },
      assets: [{ kind: 'home', incomePerDay: 0 }],
      inventory: { chicken: 1, veggies: 1, rice: 1 },
    }))

    expect(plan.primary.id).toBe('eat-food')
    expect(plan.primary.route).toEqual({ kind: 'cook-action', recipeId: 'chickendinner' })
  })

  test('keeps critical hunger on the food market when no food is owned', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 20 },
    }))

    expect(plan.primary.id).toBe('eat-food')
    expect(plan.primary.route).toEqual({ kind: 'market', focus: 'food' })
  })

  test('makes routine hydration care a direct drink action when safe', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hydration: 45 },
      money: 100,
    }))

    expect(plan.primary.id).not.toBe('drink-water')
    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'survival-action', action: 'drink-water' },
    })
  })

  test('opens the drinks market for hydration care when the player is broke', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hydration: 45 },
      money: 0,
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'drinks' },
    })
  })

  test('makes routine hydration care consume owned water before opening the market', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hydration: 45 },
      inventory: { water: 1 },
      money: 0,
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'consume-action', itemId: 'water' },
    })
  })

  test('makes routine energy care start sleep when energy is lowest but not critical', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, energy: 45 },
      money: 100,
    }))

    expect(plan.primary.id).not.toBe('sleep-tonight')
    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'survival-action', action: 'sleep' },
    })
  })

  test('opens the leisure market for hygiene care', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hygiene: 45 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'leisure' },
    })
  })

  test('makes routine hygiene care use the strongest owned hygiene item before shopping', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hygiene: 45 },
      inventory: { shower_public: 1, showerset: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'consume-action', itemId: 'showerset' },
    })
  })

  test('opens the leisure market for fun care', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, fun: 45 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'leisure' },
    })
  })

  test('makes routine fun care use the strongest owned fun item before shopping', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, fun: 45 },
      inventory: { speaker: 1, console: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'consume-action', itemId: 'console' },
    })
  })

  test('makes routine hunger care consume owned food before opening the market', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      inventory: { noodles: 1, sandwich: 1 },
    }))

    expect(plan.primary.id).not.toBe('eat-food')
    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'consume-action', itemId: 'sandwich' },
    })
  })

  test('makes routine hunger care cook a ready recipe before opening the market', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      assets: [{ kind: 'home', incomePerDay: 0 }],
      inventory: { bread: 1, cheese: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'cook-action', recipeId: 'grilledcheese' },
    })
  })

  test('does not treat raw groceries as owned ready food without a kitchen', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      inventory: { bread: 1, cheese: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'food' },
    })
  })

  test('opens the food market for hunger care when no food is owned', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'food' },
    })
  })

  test('sends an unemployed citizen to find work before capital tasks', () => {
    const plan = planLifeDay(snap({ money: 50 }))

    expect(plan.primary.id).toBe('find-job')
    expect(plan.primary.value).toBe('work')
    expect(plan.primary.route).toEqual({ kind: 'panel', panel: 'work' })
  })

  test('starts real shift routes once a citizen has a job', () => {
    const firstShiftPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 0, money: 500 }))

    expect(firstShiftPlan.primary.id).toBe('first-shift')
    expect(firstShiftPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const cashFloorPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 50 }))

    expect(cashFloorPlan.primary.id).toBe('cash-floor-shift')
    expect(cashFloorPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })
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
    expect(plan.primary.route).toEqual({ kind: 'market', focus: 'education' })
  })

  test('starts study directly for an enrolled unfinished course', () => {
    const progress = createEducationProgress(EDUCATION_COURSES.course, 1_700_000_000_000)
    const plan = planLifeDay(snap({
      lifeDay: 3,
      jobId: 'barista',
      shiftsWorked: 1,
      money: 120,
      educationActions: 0,
      educationProgress: [progress],
    }))

    expect(plan.primary.id).toBe('study-course')
    expect(plan.primary.value).toBe('school')
    expect(plan.primary.minutes).toBe(60)
    expect(plan.primary.route).toEqual({ kind: 'education-action', courseId: 'course' })
    expect(plan.routine.find((block) => block.id === 'growth-block')).toMatchObject({
      route: { kind: 'education-action', courseId: 'course' },
      taskId: 'study-course',
    })
  })

  test('keeps unfinished enrolled courses in the support plan after the first study block', () => {
    const progress = {
      ...createEducationProgress(EDUCATION_COURSES.certification, 1_700_000_000_000),
      studiedMinutes: 60,
    }
    const plan = planLifeDay(snap({
      lifeDay: 20,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      educationProgress: [progress],
      communityActionsThisWeek: 1,
    }))

    expect(plan.support.find((task) => task.id === 'support-study-certification')).toMatchObject({
      route: { kind: 'education-action', courseId: 'certification' },
      minutes: 60,
    })
    expect(plan.routine.find((block) => block.id === 'growth-block')).toMatchObject({
      taskId: 'study-certification',
      route: { kind: 'education-action', courseId: 'certification' },
    })
  })

  test('uses the growth routine for weekly community help when no course is active', () => {
    const plan = planLifeDay(snap({
      lifeDay: 10,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }, { kind: 'business', incomePerDay: 240 }],
      communityActionsThisWeek: 0,
    }))

    expect(plan.primary.id).toBe('plan-business-development')
    expect(plan.routine.find((block) => block.id === 'growth-block')).toMatchObject({
      taskId: 'help-local-person',
      value: 'community',
      route: { kind: 'community-action', actionId: 'help-errand' },
    })
  })

  test('uses the growth routine for friendship after weekly community help is done', () => {
    const plan = planLifeDay(snap({
      lifeDay: 20,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }, { kind: 'business', incomePerDay: 240 }],
      communityActionsThisWeek: 1,
    }))

    expect(plan.routine.find((block) => block.id === 'growth-block')).toMatchObject({
      taskId: 'support-friendship',
      value: 'friendship',
      route: { kind: 'community-action', actionId: 'check-neighbor' },
    })
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
    expect(plan.primary.route).toEqual({ kind: 'community-action', actionId: 'help-errand' })
  })

  test('routes a house project through materials, permit, worker help, then fallback labor', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const gatherPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-|deposit-house-materials$/)
    if (gatherPlan.primary.id.startsWith('gather-')) {
      expect(gatherPlan.primary.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
    }

    const depositPlan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      resources: freshResources(project.required),
      constructionProjects: [project],
    }))
    expect(depositPlan.primary.id).toBe('deposit-house-materials')
    expect(depositPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'deposit' })

    const readyForPermit = {
      ...project,
      deposited: freshResources(project.required),
    }
    const permitPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 1_000, constructionProjects: [readyForPermit] }))
    expect(permitPlan.primary.id).toBe('pay-house-permit')
    expect(permitPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'permit' })

    const workForPermitPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 100, constructionProjects: [readyForPermit] }))
    expect(workForPermitPlan.primary.id).toBe('work-for-permit')
    expect(workForPermitPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const workerPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [readyForLabor] }))
    expect(workerPlan.primary.id).toBe('hire-house-worker-hour')
    expect(workerPlan.primary.detail).toContain('$16/hour')
    expect(workerPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper' })
    expect(workerPlan.agenda[0].id).toBe('hire-house-worker-hour')
    expect(workerPlan.agenda.map((item) => item.id)).toContain('support-body')
    expect(workerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'hire-helper' },
      taskId: 'hire-house-worker-hour',
    })

    const selfLaborPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 100, constructionProjects: [readyForLabor] }))
    expect(selfLaborPlan.primary.id).toBe('build-house-hour')
    expect(selfLaborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
      taskId: 'build-house-hour',
    })

    const withActiveWorker = {
      ...readyForLabor,
      workerContracts: [{
        id: 'worker-1',
        workerId: 'helper' as const,
        workerName: 'Local helper',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 10,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    }
    const activeWorkerPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [withActiveWorker] }))
    expect(activeWorkerPlan.primary.id).toBe('build-house-with-worker-hour')
    expect(activeWorkerPlan.primary.detail).toContain('already paid and active')
    expect(activeWorkerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
      taskId: 'build-house-with-worker-hour',
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
    if (gatherPlan.primary.id.startsWith('gather-')) {
      expect(gatherPlan.primary.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
    }
    expect(gatherPlan.agenda.map((item) => item.id)).toContain(gatherPlan.primary.id)
    expect(gatherPlan.constructionForecast?.remainingLaborMinutes).toBe(project.laborRequiredMinutes)

    const depositPlan = planLifeDay(snap({
      ...base,
      resources: freshResources(project.required),
      constructionProjects: [project],
    }))
    expect(depositPlan.primary.id).toBe('deposit-business-building-materials')
    expect(depositPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'deposit' })

    const readyForPermit = {
      ...project,
      deposited: freshResources(project.required),
    }
    const permitPlan = planLifeDay(snap({ ...base, money: 1_000, constructionProjects: [readyForPermit] }))
    expect(permitPlan.primary.id).toBe('pay-business-building-permit')
    expect(permitPlan.primary.value).toBe('respect')
    expect(permitPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'permit' })

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const laborPlan = planLifeDay(snap({ ...base, constructionProjects: [readyForLabor] }))
    expect(laborPlan.primary.id).toBe('hire-business-building-worker-hour')
    expect(laborPlan.primary.title).toBe('Hire 1h helper for Food Cart')
    expect(laborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'hire-helper' },
      taskId: 'hire-business-building-worker-hour',
    })

    const cashTightLaborPlan = planLifeDay(snap({ ...base, money: 100, constructionProjects: [readyForLabor] }))
    expect(cashTightLaborPlan.primary.id).toBe('build-business-building-hour')
    expect(cashTightLaborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
      taskId: 'build-business-building-hour',
    })

    const completeReady = {
      ...readyForLabor,
      laborDoneMinutes: project.laborRequiredMinutes,
    }
    const finishPlan = planLifeDay(snap({ ...base, constructionProjects: [completeReady] }))
    expect(finishPlan.primary.id).toBe('complete-business-building')
    expect(finishPlan.primary.title).toBe('Open Food Cart')
    expect(finishPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'complete' })
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
    expect(gatherPlan.primary.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
    expect(gatherPlan.businessDevelopmentForecast).toMatchObject({
      budgetRemaining: project.budgetCost,
      remainingLaborMinutes: project.laborRequiredMinutes,
    })

    const depositPlan = planLifeDay(snap({
      ...base,
      resources: freshResources(project.required),
      businessDevelopmentProjects: [project],
    }))
    expect(depositPlan.primary.id).toBe('deposit-business-materials')
    expect(depositPlan.primary.route).toEqual({ kind: 'business-development-action', projectId: project.id, action: 'deposit' })

    const resourcesReady = businessProject({ deposited: freshResources(project.required) })
    const budgetPlan = planLifeDay(snap({ ...base, money: resourcesReady.budgetCost + 500, businessDevelopmentProjects: [resourcesReady] }))
    expect(budgetPlan.primary.id).toBe('pay-business-budget')
    expect(budgetPlan.primary.value).toBe('respect')
    expect(budgetPlan.primary.route).toEqual({ kind: 'business-development-action', projectId: resourcesReady.id, action: 'budget' })

    const workForBudgetPlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [resourcesReady] }))
    expect(workForBudgetPlan.primary.id).toBe('work-for-business-budget')
    expect(workForBudgetPlan.primary.value).toBe('work')
    expect(workForBudgetPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const laborReady = businessProject({ deposited: freshResources(project.required), budgetPaid: true })
    const hirePlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [laborReady] }))
    expect(hirePlan.primary.id).toBe('hire-business-worker-hour')
    expect(hirePlan.primary.route).toEqual({ kind: 'business-development-action', projectId: laborReady.id, action: 'hire-helper' })
    expect(hirePlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'business-development-action', projectId: laborReady.id, action: 'hire-helper' },
      taskId: 'hire-business-worker-hour',
    })

    const withActiveWorker = businessProject({
      deposited: freshResources(project.required),
      budgetPaid: true,
      workerContracts: [{
        id: 'business-worker-1',
        workerId: 'helper',
        workerName: 'Local helper',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 10,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    })
    const activeWorkerPlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [withActiveWorker] }))
    expect(activeWorkerPlan.primary.id).toBe('develop-business-with-worker-hour')
    expect(activeWorkerPlan.primary.detail).toContain('already paid and active')
    expect(activeWorkerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'business-development-action', projectId: withActiveWorker.id, action: 'work' },
      taskId: 'develop-business-with-worker-hour',
    })

    const selfWorkPlan = planLifeDay(snap({ ...base, money: 100, businessDevelopmentProjects: [laborReady] }))
    expect(selfWorkPlan.primary.id).toBe('develop-business-hour')
    expect(selfWorkPlan.primary.route).toEqual({ kind: 'business-development-action', projectId: laborReady.id, action: 'work' })

    const completeReady = businessProject({
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes,
    })
    const finishPlan = planLifeDay(snap({ ...base, businessDevelopmentProjects: [completeReady] }))
    expect(finishPlan.primary.id).toBe('finish-business-development')
    expect(finishPlan.primary.route).toEqual({ kind: 'business-development-action', projectId: completeReady.id, action: 'complete' })
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
    expect(forecast.activeWorkerCount).toBe(0)
    expect(forecast.activeWorkerPaidMinutesRemaining).toBe(0)
    expect(forecast.activeWorkerLaborMinutesRemaining).toBe(0)
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

  test('accounts for already active worker contracts in the build forecast', () => {
    const project = {
      ...createConstructionProject('starter-house', 1, 1, 1),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 120,
      hiredLaborMinutes: 60,
      workerContracts: [{
        id: 'worker-1',
        workerId: 'builder' as const,
        workerName: 'Skilled builder',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 20,
        laborMultiplier: 1.5,
        ratePerHour: 28,
        cost: 28,
      }],
    }

    const forecast = constructionDayForecast(project, freshResources(), 500)

    expect(forecast.remainingLaborMinutes).toBe(360)
    expect(forecast.activeWorkerCount).toBe(1)
    expect(forecast.activeWorkerPaidMinutesRemaining).toBe(40)
    expect(forecast.activeWorkerLaborMinutesRemaining).toBe(60)
  })
})

describe('businessDevelopmentDayForecast', () => {
  test('forecasts interior materials, budget, and helper labor from day one', () => {
    const project = businessProject()
    const forecast = businessDevelopmentDayForecast(project, freshResources(), 500)
    const trips = Object.fromEntries(forecast.resourceTrips.map((item) => [item.kind, item.trips]))

    expect(project.required).toEqual({ wood: 20, stone: 10, metal: 20, glass: 10 })
    expect(project.budgetCost).toBe(960)
    expect(project.laborRequiredMinutes).toBe(150)
    expect(trips).toEqual({ wood: 1, stone: 1, metal: 3, glass: 2 })
    expect(forecast.totalGatherMinutes).toBe(58)
    expect(forecast.budgetRemaining).toBe(960)
    expect(forecast.budgetAffordableToday).toBe(false)
    expect(forecast.budgetCashNeeded).toBe(560)
    expect(forecast.remainingLaborMinutes).toBe(150)
    expect(forecast.playerOnlyDaysAtOneHour).toBe(3)
    expect(forecast.playerOnlyDaysAtTwoHours).toBe(2)
    expect(forecast.helperTwoHourDays).toBe(1)
    expect(forecast.helperTwoHourLaborMinutes).toBe(120)
    expect(forecast.helperTwoHourCost).toBe(32)
    expect(forecast.helperTwoHourAffordableToday).toBe(false)
    expect(forecast.helperTwoHourCashNeeded).toBe(592)
  })

  test('accounts for already active interior worker contracts', () => {
    const project = businessProject({
      deposited: freshResources({ wood: 20, stone: 10, metal: 20, glass: 10 }),
      budgetPaid: true,
      laborDoneMinutes: 30,
      hiredLaborMinutes: 30,
      workerContracts: [{
        id: 'business-worker-1',
        workerId: 'builder',
        workerName: 'Skilled builder',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 10,
        laborMultiplier: 1.5,
        ratePerHour: 28,
        cost: 28,
      }],
    })

    const forecast = businessDevelopmentDayForecast(project, freshResources(), 500)

    expect(forecast.totalGatherMinutes).toBe(0)
    expect(forecast.budgetRemaining).toBe(0)
    expect(forecast.remainingLaborMinutes).toBe(120)
    expect(forecast.activeWorkerCount).toBe(1)
    expect(forecast.activeWorkerPaidMinutesRemaining).toBe(50)
    expect(forecast.activeWorkerLaborMinutesRemaining).toBe(75)
    expect(forecast.helperTwoHourAffordableToday).toBe(true)
  })
})
