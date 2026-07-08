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
    communityActionsToday: 0,
    communityRespect: 0,
    communityFriendship: 0,
    communityTrust: 0,
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

  test('names the active daily commitment before suggesting a new task', () => {
    const base = {
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home' as const, incomePerDay: 0 }],
      communityActionsThisWeek: 1,
    }

    expect(planLifeDay(snap({ ...base, activityKind: 'sleep' })).primary).toMatchObject({
      id: 'finish-active-sleep',
      title: 'Finish sleeping',
      value: 'body',
      route: { kind: 'none' },
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'shift' })).primary).toMatchObject({
      id: 'finish-active-shift',
      title: 'Finish the work shift',
      value: 'work',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'cook' })).primary).toMatchObject({
      id: 'finish-active-cook',
      title: 'Finish cooking the meal',
      value: 'body',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'gather' })).primary).toMatchObject({
      id: 'finish-active-gather',
      title: 'Finish the resource trip',
      value: 'capital',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'construction' })).primary).toMatchObject({
      id: 'finish-active-construction',
      title: 'Finish the build block',
      value: 'capital',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'study' })).primary).toMatchObject({
      id: 'finish-active-study',
      title: 'Finish the study block',
      value: 'school',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'community' })).primary).toMatchObject({
      id: 'finish-active-community',
      title: 'Finish helping locally',
      value: 'community',
    })
    expect(planLifeDay(snap({ ...base, activityKind: 'business-development' })).primary).toMatchObject({
      id: 'finish-active-business-development',
      title: 'Finish the business interior block',
      value: 'capital',
    })
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

  test('uses a missed-day repair task instead of shame copy once serious work exists', () => {
    const plan = planLifeDay(snap({
      lifeDay: 12,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      seriousWorkMissedYesterday: true,
    }))

    expect(plan.primary).toMatchObject({
      id: 'repair-serious-work',
      title: 'Restart serious work',
      value: 'respect',
      route: { kind: 'work-action', action: 'shift' },
    })
    expect(plan.primary.detail).toContain('rebuild rhythm and respect')
    expect(plan.primary.detail).not.toMatch(/shame|failed|punish/i)
  })

  test('keeps body recovery ahead of missed-day repair', () => {
    const plan = planLifeDay(snap({
      lifeDay: 12,
      jobId: 'barista',
      shiftsWorked: 5,
      educationActions: 1,
      seriousWorkMissedYesterday: true,
      needs: { ...goodNeeds, hydration: 20 },
    }))

    expect(plan.primary.id).toBe('drink-water')
    expect(plan.agenda.map((item) => item.id)).toContain('repair-serious-work')
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

  test('opens groceries for routine hunger when a kitchen exists but no recipe is ready', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      assets: [{ kind: 'home', incomePerDay: 0 }],
      inventory: { rice: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'groceries' },
    })
  })

  test('opens groceries for routine hunger when a hot plate creates cooking access', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      inventory: { hotplate: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'groceries' },
    })
  })

  test('does not treat kitchen furniture as owned ready food', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 45 },
      inventory: { kitchen: 1 },
    }))

    expect(plan.routine.find((block) => block.id === 'body-block')).toMatchObject({
      taskId: 'support-body',
      route: { kind: 'market', focus: 'groceries' },
    })
  })

  test('keeps critical hunger on ready food when a kitchen has no ready recipe', () => {
    const plan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      needs: { ...goodNeeds, hunger: 20 },
      assets: [{ kind: 'home', incomePerDay: 0 }],
      inventory: { rice: 1 },
    }))

    expect(plan.primary).toMatchObject({
      id: 'eat-food',
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

  test('uses school growth after today already has a community action', () => {
    const plan = planLifeDay(snap({
      lifeDay: 20,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }, { kind: 'business', incomePerDay: 240 }],
      communityActionsThisWeek: 1,
      communityActionsToday: 1,
    }))

    expect(plan.routine.find((block) => block.id === 'growth-block')).toMatchObject({
      taskId: 'support-school',
      value: 'school',
      route: { kind: 'market', focus: 'education' },
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

  test('keeps community primary while keeping the millionaire path visible', () => {
    const plan = planLifeDay(snap({
      lifeDay: 5,
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
      communityActionsThisWeek: 0,
    }))

    expect(plan.primary.id).toBe('help-local-person')
    expect(plan.millionairePath.nextAction).toBe('buy-business')
    expect(plan.millionaireTask.id).toBe('work-for-first-business-foundation')
    expect(plan.agenda.map((item) => item.id)).toContain('work-for-first-business-foundation')
  })

  test('passes friendship into the millionaire opportunity forecast', () => {
    const plan = planLifeDay(snap({
      lifeDay: 12,
      money: 50_000,
      jobId: 'barista',
      shiftsWorked: 4,
      educationActions: 1,
      communityActionsThisWeek: 1,
      communityRespect: 3,
      communityFriendship: 8,
      communityTrust: 3,
    }))

    expect(plan.millionairePath.stage).toBe('reliable')
    expect(plan.millionairePath.communityAdvantage).toMatchObject({
      tier: 'trusted',
      dailyOpportunityValue: 22,
    })
    expect(plan.millionairePath.nextActionDetail).toContain('Local trust adds about $22/day')
  })

  test('shows the first business as a cash-gated construction shell before it exists', () => {
    const plan = planLifeDay(snap({
      lifeDay: 8,
      money: 500,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
      communityActionsThisWeek: 1,
    }))
    const trips = Object.fromEntries(plan.constructionForecast?.resourceTrips.map((item) => [item.kind, item.trips]) ?? [])

    expect(plan.primary.id).toBe('work-for-first-business-foundation')
    expect(plan.primary.title).toBe('Save for Food Cart foundation')
    expect(plan.primary.value).toBe('work')
    expect(plan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })
    expect(plan.primary.detail).toContain('Food Cart costs $15,000 before the map shell')
    expect(plan.constructionForecast).toMatchObject({
      upfrontCostRemaining: 15_000,
      upfrontCashNeeded: 14_600,
      upfrontAffordableToday: false,
      permitRemaining: 500,
      permitCashNeeded: 100,
      permitAffordableToday: false,
      remainingLaborMinutes: 480,
      totalGatherMinutes: 80,
    })
    expect(trips).toEqual({ wood: 2, stone: 2, metal: 4, glass: 2 })
  })

  test('routes the first business into Market placement once the shell cost is safe', () => {
    const plan = planLifeDay(snap({
      lifeDay: 8,
      money: 20_000,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
      communityActionsThisWeek: 1,
    }))

    expect(plan.primary.id).toBe('build-first-business')
    expect(plan.primary.title).toBe('Place Food Cart foundation')
    expect(plan.primary.value).toBe('capital')
    expect(plan.primary.route).toEqual({ kind: 'market', focus: 'business' })
    expect(plan.constructionForecast).toMatchObject({
      upfrontCostRemaining: 15_000,
      upfrontCashNeeded: 0,
      upfrontAffordableToday: true,
      permitRemaining: 500,
      permitCashNeeded: 0,
      permitAffordableToday: true,
    })
  })

  test('returns millionaire forecast data from the daily plan', () => {
    const plan = planLifeDay(snap({
      lifeDay: 30,
      money: 1_000_000,
      jobId: 'barista',
      shiftsWorked: 10,
      educationActions: 1,
      communityActionsThisWeek: 1,
      communityRespect: 6,
      communityTrust: 6,
    }))

    expect(plan.millionairePath.stage).toBe('millionaire')
    expect(plan.millionairePath.daysToMillionaire).toBe(0)
    expect(plan.millionairePath.reach.label).toBe('your continent')
    expect(plan.millionaireTask.id).toBe('millionaire-keep-growing')
  })

  test('does not surface community help after today already has a local action', () => {
    const plan = planLifeDay(snap({
      lifeDay: 5,
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }],
      communityActionsThisWeek: 0,
      communityActionsToday: 1,
    }))

    expect(plan.primary.id).not.toBe('help-local-person')
    expect(plan.primary.route).not.toEqual({ kind: 'community-action', actionId: 'help-errand' })
  })

  test('routes a house project through materials, permit, worker help, then fallback labor', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const gatherPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [project] }))
    expect(gatherPlan.primary.id).toMatch(/^gather-|deposit-house-materials$/)
    if (gatherPlan.primary.id.startsWith('gather-')) {
      expect(gatherPlan.primary.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
      expect(gatherPlan.primary.detail).toBe('Starter House still needs 120 wood. Gather 120 locally, then deposit it.')
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
    expect(permitPlan.primary.detail).toBe('Pay $500 and keep at least $100 for food and water so the house build stays legal and safe.')
    expect(permitPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'permit' })

    const workForPermitPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 100, constructionProjects: [readyForPermit] }))
    expect(workForPermitPlan.primary.id).toBe('work-for-permit')
    expect(workForPermitPlan.primary.detail).toBe('Building permit costs $500 plus $100 safety cash. You have $100, so earn $500 before paying the permit.')
    expect(workForPermitPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const workerPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [readyForLabor] }))
    expect(workerPlan.primary.id).toBe('hire-house-worker-hour')
    expect(workerPlan.primary.title).toBe('Hire 2h helper for the house')
    expect(workerPlan.primary.detail).toBe('Workers Hall help costs $32 total for 2h ($16/hour) and adds 2h on site against 8h remaining.')
    expect(workerPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 2 })
    expect(workerPlan.agenda[0].id).toBe('hire-house-worker-hour')
    expect(workerPlan.agenda.map((item) => item.id)).toContain('support-body')
    expect(workerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 2 },
      taskId: 'hire-house-worker-hour',
    })

    const finalHourPlan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      constructionProjects: [{
        ...readyForLabor,
        laborDoneMinutes: project.laborRequiredMinutes - 60,
      }],
    }))
    expect(finalHourPlan.primary.title).toBe('Hire 1h helper for the house')
    expect(finalHourPlan.primary.detail).toBe('Workers Hall help costs $16 total for 1h ($16/hour) and adds 1h on site against 1h remaining.')
    expect(finalHourPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 1 })

    const oneHourBudgetPlan = planLifeDay(snap({
      jobId: 'barista',
      shiftsWorked: 1,
      educationActions: 1,
      money: 120,
      constructionProjects: [readyForLabor],
    }))
    expect(oneHourBudgetPlan.primary.title).toBe('Hire 1h helper for the house')
    expect(oneHourBudgetPlan.primary.detail).toBe('Workers Hall help costs $16 total for 1h ($16/hour) and adds 1h on site against 8h remaining.')
    expect(oneHourBudgetPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 1 })

    const selfLaborPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, money: 100, constructionProjects: [readyForLabor] }))
    expect(selfLaborPlan.primary.id).toBe('build-house-hour')
    expect(selfLaborPlan.primary.detail).toBe('Use free time after work and body care to add 1h yourself; 8h remains before this hour.')
    expect(selfLaborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
      taskId: 'build-house-hour',
    })

    const withActiveWorker = {
      ...readyForLabor,
      workerContracts: [{
        id: 'worker-1',
        source: 'workers-hall' as const,
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
    expect(activeWorkerPlan.primary.detail).toBe('A Workers Hall helper is already paid and active. Add 1h yourself while they continue; 8h remains before this hour.')
    expect(activeWorkerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'work' },
      taskId: 'build-house-with-worker-hour',
    })

    const activeWorkerCanFinish = {
      ...readyForLabor,
      laborDoneMinutes: project.laborRequiredMinutes - 50,
      hiredLaborMinutes: 0,
      workerContracts: [{
        id: 'worker-can-finish',
        source: 'workers-hall' as const,
        workerId: 'helper' as const,
        workerName: 'Local helper',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 0,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    }
    const workerFinishPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [activeWorkerCanFinish] }))
    expect(workerFinishPlan.primary.id).toBe('monitor-house-worker-finish')
    expect(workerFinishPlan.primary.detail).toBe('Paid Workers Hall time can cover the remaining 50m. Check the site and finish when the worker ledger turns ready.')
    expect(workerFinishPlan.primary.route).toEqual({ kind: 'panel', panel: 'construction', target: { kind: 'construction', id: activeWorkerCanFinish.id } })
    expect(workerFinishPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'construction', target: { kind: 'construction', id: activeWorkerCanFinish.id } },
      taskId: 'monitor-house-worker-finish',
    })

    const completeReady = {
      ...readyForLabor,
      laborDoneMinutes: project.laborRequiredMinutes,
    }
    const finishPlan = planLifeDay(snap({ jobId: 'barista', shiftsWorked: 1, educationActions: 1, constructionProjects: [completeReady] }))
    expect(finishPlan.primary).toMatchObject({
      id: 'complete-house',
      title: 'Enter the house',
      route: { kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: 'home' },
    })
    expect(finishPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: 'home' },
      taskId: 'complete-house',
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

    const gatherPlan = planLifeDay(snap({
      ...base,
      resources: freshResources({ wood: 10 }),
      constructionProjects: [project],
    }))
    expect(gatherPlan.primary.id).toMatch(/^gather-business-building-|deposit-business-building-materials$/)
    if (gatherPlan.primary.id.startsWith('gather-')) {
      expect(gatherPlan.primary.route).toEqual({ kind: 'gather', resourceKind: 'wood' })
      expect(gatherPlan.primary.detail).toBe('Food Cart still needs 45 wood. You have 10; gather 35 more locally, then deposit it.')
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
    expect(permitPlan.primary.detail).toBe('Pay $500 and keep at least $100 for food and water so the business build stays legal and safe.')
    expect(permitPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'permit' })

    const workForPermitPlan = planLifeDay(snap({ ...base, money: 100, constructionProjects: [readyForPermit] }))
    expect(workForPermitPlan.primary.id).toBe('work-for-business-building-permit')
    expect(workForPermitPlan.primary.detail).toBe('Food Cart permit costs $500 plus $100 safety cash. You have $100, so earn $500 before paying the permit.')
    expect(workForPermitPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const readyForLabor = {
      ...readyForPermit,
      permitFeePaid: true,
    }
    const laborPlan = planLifeDay(snap({ ...base, constructionProjects: [readyForLabor] }))
    expect(laborPlan.primary.id).toBe('hire-business-building-worker-hour')
    expect(laborPlan.primary.title).toBe('Hire 2h helper for Food Cart')
    expect(laborPlan.primary.detail).toBe('Workers Hall help costs $32 total for 2h ($16/hour) and adds 2h on site against 8h remaining.')
    expect(laborPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 2 },
      taskId: 'hire-business-building-worker-hour',
    })

    const cashTightLaborPlan = planLifeDay(snap({ ...base, money: 100, constructionProjects: [readyForLabor] }))
    expect(cashTightLaborPlan.primary.id).toBe('build-business-building-hour')
    expect(cashTightLaborPlan.primary.detail).toBe('Use free time after work and body care to add 1h yourself; 8h remains before this hour.')
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
    expect(finishPlan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: 'business' })
    expect(finishPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'construction-action', projectId: project.id, action: 'complete', resultKind: 'business' },
      taskId: 'complete-business-building',
    })
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
    expect(gatherPlan.primary.detail).toBe("Food Cart's interior still needs 20 wood. Gather 20 locally, then deposit it.")
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
    expect(budgetPlan.primary.detail).toBe('Pay $960 and keep at least $100 safe cash to unlock interior labor for level 2.')
    expect(budgetPlan.primary.route).toEqual({ kind: 'business-development-action', projectId: resourcesReady.id, action: 'budget' })

    const workForBudgetPlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [resourcesReady] }))
    expect(workForBudgetPlan.primary.id).toBe('work-for-business-budget')
    expect(workForBudgetPlan.primary.value).toBe('work')
    expect(workForBudgetPlan.primary.detail).toBe("Food Cart interior budget costs $960 plus $100 safety cash. You have $500, so earn $560 before funding the upgrade.")
    expect(workForBudgetPlan.primary.route).toEqual({ kind: 'work-action', action: 'shift' })

    const laborReady = businessProject({ deposited: freshResources(project.required), budgetPaid: true })
    const hirePlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [laborReady] }))
    expect(hirePlan.primary.id).toBe('hire-business-worker-hour')
    expect(hirePlan.primary.title).toBe('Hire 2h worker for Food Cart')
    expect(hirePlan.primary.detail).toBe('Workers Hall help costs $32 total for 2h ($16/hour) and adds 2h inside against 2h 30m remaining.')
    expect(hirePlan.primary.route).toEqual({ kind: 'business-development-action', projectId: laborReady.id, action: 'hire-helper', hours: 2 })
    expect(hirePlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'business-development-action', projectId: laborReady.id, action: 'hire-helper', hours: 2 },
      taskId: 'hire-business-worker-hour',
    })

    const withActiveWorker = businessProject({
      deposited: freshResources(project.required),
      budgetPaid: true,
      workerContracts: [{
        id: 'business-worker-1',
        source: 'workers-hall' as const,
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
    expect(activeWorkerPlan.primary.detail).toBe('A Workers Hall helper is already paid and active. Add 1h inside while they continue; 2h 30m remains before this hour.')
    expect(activeWorkerPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'business-development-action', projectId: withActiveWorker.id, action: 'work' },
      taskId: 'develop-business-with-worker-hour',
    })

    const activeInteriorWorkerCanFinish = businessProject({
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 45,
      hiredLaborMinutes: 0,
      workerContracts: [{
        id: 'business-worker-can-finish',
        source: 'workers-hall' as const,
        workerId: 'helper',
        workerName: 'Local helper',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 0,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    })
    const interiorWorkerFinishPlan = planLifeDay(snap({ ...base, money: 500, businessDevelopmentProjects: [activeInteriorWorkerCanFinish] }))
    expect(interiorWorkerFinishPlan.primary.id).toBe('monitor-business-worker-finish')
    expect(interiorWorkerFinishPlan.primary.detail).toBe('Paid Workers Hall time can cover the remaining 45m inside. Check the business and finish when the worker ledger turns ready.')
    expect(interiorWorkerFinishPlan.primary.route).toEqual({ kind: 'panel', panel: 'business', target: { kind: 'asset', id: activeInteriorWorkerCanFinish.businessId } })
    expect(interiorWorkerFinishPlan.routine.find((block) => block.id === 'free-time-block')).toMatchObject({
      route: { kind: 'panel', panel: 'business', target: { kind: 'asset', id: activeInteriorWorkerCanFinish.businessId } },
      taskId: 'monitor-business-worker-finish',
    })

    const selfWorkPlan = planLifeDay(snap({ ...base, money: 100, businessDevelopmentProjects: [laborReady] }))
    expect(selfWorkPlan.primary.id).toBe('develop-business-hour')
    expect(selfWorkPlan.primary.detail).toBe('Use free time after work and body care to add 1h inside; 2h 30m remains before this hour.')
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
      assets: [{ kind: 'home', incomePerDay: 0 }, { id: 'foodcart-1', kind: 'business', incomePerDay: 240 }],
      communityActionsThisWeek: 0,
    }))

    expect(plan.primary.id).toBe('plan-business-development')
    expect(plan.primary.route).toEqual({ kind: 'panel', panel: 'business', target: { kind: 'asset', id: 'foodcart-1' } })
    expect(plan.agenda.map((item) => item.id)).toContain('help-local-person')
  })

  test('uses community backing to make Workers Hall help the next safe build step', () => {
    const project = {
      ...createConstructionProject('starter-house', 1, 1, 1),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 120,
    }

    const plan = planLifeDay(snap({
      money: 124,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      constructionProjects: [project],
      communityRespect: 3,
    }))

    expect(plan.primary.id).toBe('hire-house-worker-hour')
    expect(plan.primary.detail).toContain('Community backing covers 30m ($8).')
    expect(plan.primary.route).toEqual({ kind: 'construction-action', projectId: project.id, action: 'hire-helper', hours: 2 })
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
    expect(forecast.playerOnlyCompletionLifeDay).toBe(8)
    expect(forecast.helperTwoHourDays).toBe(3)
    expect(forecast.helperTwoHourCompletionLifeDay).toBe(3)
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

    const forecast = constructionDayForecast(project, freshResources(), 500, undefined, undefined, 6)

    expect(forecast.remainingLaborMinutes).toBe(360)
    expect(forecast.playerOnlyDaysAtOneHour).toBe(6)
    expect(forecast.playerOnlyCompletionLifeDay).toBe(11)
    expect(forecast.helperTwoHourDays).toBe(2)
    expect(forecast.helperTwoHourCompletionLifeDay).toBe(7)
    expect(forecast.totalGatherMinutes).toBe(0)
    expect(forecast.helperTwoHourAffordableToday).toBe(true)
    expect(forecast.helperTwoHourCashNeeded).toBe(0)
  })

  test('applies community helper credit to the construction forecast cash gate', () => {
    const project = {
      ...createConstructionProject('starter-house', 1, 1, 1),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: 120,
    }

    const withoutCredit = constructionDayForecast(project, freshResources(), 124)
    const withCredit = constructionDayForecast(project, freshResources(), 124, undefined, undefined, 1, 30)

    expect(withoutCredit.helperTwoHourCost).toBe(32)
    expect(withoutCredit.helperTwoHourCommunityCreditMinutes).toBe(0)
    expect(withoutCredit.helperTwoHourCommunityCreditValue).toBe(0)
    expect(withoutCredit.helperTwoHourAffordableToday).toBe(false)
    expect(withoutCredit.helperTwoHourCashNeeded).toBe(8)
    expect(withCredit.helperTwoHourCost).toBe(24)
    expect(withCredit.helperTwoHourCommunityCreditMinutes).toBe(30)
    expect(withCredit.helperTwoHourCommunityCreditValue).toBe(8)
    expect(withCredit.helperTwoHourAffordableToday).toBe(true)
    expect(withCredit.helperTwoHourCashNeeded).toBe(0)
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
        source: 'workers-hall' as const,
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
    expect(forecast.activeWorkerCompletionLifeDay).toBe(5)
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
    expect(forecast.playerOnlyCompletionLifeDay).toBe(3)
    expect(forecast.helperTwoHourDays).toBe(1)
    expect(forecast.helperTwoHourCompletionLifeDay).toBe(1)
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
        source: 'workers-hall' as const,
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
    expect(forecast.activeWorkerCompletionLifeDay).toBe(1)
    expect(forecast.helperTwoHourAffordableToday).toBe(true)
  })

  test('applies community helper credit to the business interior forecast cash gate', () => {
    const project = businessProject({
      deposited: freshResources({ wood: 20, stone: 10, metal: 20, glass: 10 }),
      budgetPaid: true,
    })

    const withoutCredit = businessDevelopmentDayForecast(project, freshResources(), 124)
    const withCredit = businessDevelopmentDayForecast(project, freshResources(), 124, undefined, 1, 30)

    expect(withoutCredit.helperTwoHourCost).toBe(32)
    expect(withoutCredit.helperTwoHourCommunityCreditMinutes).toBe(0)
    expect(withoutCredit.helperTwoHourCommunityCreditValue).toBe(0)
    expect(withoutCredit.helperTwoHourAffordableToday).toBe(false)
    expect(withoutCredit.helperTwoHourCashNeeded).toBe(8)
    expect(withCredit.helperTwoHourCost).toBe(24)
    expect(withCredit.helperTwoHourCommunityCreditMinutes).toBe(30)
    expect(withCredit.helperTwoHourCommunityCreditValue).toBe(8)
    expect(withCredit.helperTwoHourAffordableToday).toBe(true)
    expect(withCredit.helperTwoHourCashNeeded).toBe(0)
  })

  test('shows community backing in the business helper plan copy', () => {
    const project = businessProject({
      deposited: freshResources({ wood: 20, stone: 10, metal: 20, glass: 10 }),
      budgetPaid: true,
    })

    const plan = planLifeDay(snap({
      money: 124,
      jobId: 'barista',
      shiftsWorked: 2,
      educationActions: 1,
      assets: [{ kind: 'home', incomePerDay: 0 }, { kind: 'business', incomePerDay: 240 }],
      businessDevelopmentProjects: [project],
      communityRespect: 3,
    }))

    expect(plan.primary.id).toBe('hire-business-worker-hour')
    expect(plan.primary.detail).toContain('Community backing covers 30m ($8).')
    expect(plan.primary.route).toEqual({ kind: 'business-development-action', projectId: project.id, action: 'hire-helper', hours: 2 })
  })
})
