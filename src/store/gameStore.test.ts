import { afterEach, describe, expect, test, vi } from 'vitest'
import { createBusinessDevelopmentProject, depositBusinessDevelopmentResources, payBusinessDevelopmentBudget } from '../game/businessDevelopment'
import { communityDay, freshCommunityStats } from '../game/community'
import { STARTER_HOUSE_RECIPE, createConstructionProject } from '../game/construction'
import { eligibleChallengesForContext } from '../game/dailyChallenges'
import { EDUCATION_COURSES, createEducationProgress, type EducationCourse } from '../game/education'
import { RESOURCE_META, freshResources, type ResourceNode } from '../game/resources'
import type { PlacedAsset, ShopItem } from '../game/types'
import { dailyChallengeContextOf, useGame } from './gameStore'

const pendingHome: ShopItem = {
  id: 'microstudio',
  name: 'Micro Studio',
  category: 'home',
  price: 45_000,
  description: 'Tiny but yours.',
  placeable: true,
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

const resourceNode = (kind: ResourceNode['kind'] = 'wood'): ResourceNode => ({
  id: `${kind}-node`,
  kind,
  label: `${RESOURCE_META[kind].label} stand`,
  lat: 45,
  lng: 21,
  source: 'fallback',
  yieldAmount: RESOURCE_META[kind].yieldAmount,
  gatherMinutes: RESOURCE_META[kind].gatherMinutes,
  energyCost: RESOURCE_META[kind].energyCost,
})

const LIVE_STEP_MS = 15 * 60_000

function advanceLiveTo(endAt: number, stepMs = LIVE_STEP_MS) {
  let cursor = Date.now()
  while (cursor < endAt) {
    cursor = Math.min(cursor + stepMs, endAt)
    vi.setSystemTime(cursor)
    useGame.getState().tick()
  }
}

function completedCourse(course: EducationCourse, completedAt = Date.now()) {
  return {
    ...createEducationProgress(course, completedAt - course.studyMinutesRequired * 60_000),
    studiedMinutes: course.studyMinutesRequired,
    completedAt,
  }
}

type StoreChallengeState = Parameters<typeof dailyChallengeContextOf>[0]

function emptyDailyCounters(): StoreChallengeState['dailyCounters'] {
  return {
    day: 0,
    mealsToday: 0,
    drinksToday: 0,
    hygieneToday: 0,
    shiftsToday: 0,
    earnedToday: 0,
    sleptToday: 0,
    boughtToday: 0,
    studiedToday: 0,
    gatheredToday: 0,
    constructionMinutesToday: 0,
    workersHiredToday: 0,
    communityToday: 0,
    businessDevelopmentMinutesToday: 0,
    cookedToday: 0,
    consumedItemCountsToday: {},
    gatheredResourceAmountsToday: {},
  }
}

function challengeState(overrides: Partial<StoreChallengeState> = {}): StoreChallengeState {
  return {
    money: 0,
    needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    health: 100,
    jobId: null,
    shiftsWorked: 0,
    inventory: {},
    assets: [],
    resourceNodes: [],
    constructionProjects: [],
    businessDevelopmentProjects: [],
    educationProgress: [],
    community: freshCommunityStats(),
    dailyCounters: emptyDailyCounters(),
    ...overrides,
  }
}

function eligibleDailyIds(state: Partial<StoreChallengeState>): string[] {
  return eligibleChallengesForContext(dailyChallengeContextOf(challengeState(state))).map((challenge) => challenge.id)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  useGame.getState().reset()
})

describe('construction placement guard', () => {
  test('does not erase a paid pending placement when starting a foundation', () => {
    useGame.setState({
      activity: null,
      placing: pendingHome,
      placingConstruction: null,
      log: [],
      toasts: [],
    })

    useGame.getState().startPlacingConstruction()

    const state = useGame.getState()
    expect(state.placing).toBe(pendingHome)
    expect(state.placingConstruction).toBeNull()
    expect(state.log.at(-1)).toContain('waiting for a map spot')
    expect(state.toasts.at(-1)?.tone).toBe('blocked')
  })
})

describe('hard work body gates', () => {
  test('gathering, building, business work, shifts, and gigs require food and water', () => {
    const now = Date.now()
    const constructionProject = {
      ...createConstructionProject('starter-house', 45.7, 21.2, now),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
    }
    const businessPlan = createBusinessDevelopmentProject(business(), now)!
    const businessDeposited = depositBusinessDevelopmentResources(businessPlan, freshResources(businessPlan.required)).project
    const businessReady = payBusinessDevelopmentBudget(businessDeposited, businessDeposited.budgetCost).project
    const base = {
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      money: 1_000,
      jobId: 'barista',
      health: 100,
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    }

    useGame.setState({
      ...base,
      needs: { hunger: 80, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
      resourceNodes: [{
        id: 'wood-node',
        kind: 'wood',
        label: 'Local timber lot',
        lat: 45,
        lng: 21,
        source: 'fallback',
        yieldAmount: 25,
        gatherMinutes: 5,
        energyCost: 8,
      }],
    })
    useGame.getState().startGatherResource('wood-node')
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Drink water before gathering wood.',
      tone: 'blocked',
    })

    useGame.setState({
      ...base,
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      constructionProjects: [constructionProject],
    })
    useGame.getState().startConstructionWork(constructionProject.id)
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: constructionProject.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Eat before construction work.',
      tone: 'blocked',
    })

    useGame.setState({
      ...base,
      needs: { hunger: 80, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
      assets: [business()],
      businessDevelopmentProjects: [businessReady],
    })
    useGame.getState().startBusinessDevelopmentWork(businessReady.id)
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'asset', id: businessReady.businessId })
    expect(useGame.getState().panel).toBe('business')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Drink water before interior work.',
      tone: 'blocked',
    })

    useGame.setState({
      ...base,
      needs: { hunger: 80, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
    })
    useGame.getState().startShift()
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Drink water before starting a shift.',
      tone: 'blocked',
    })

    useGame.setState({
      ...base,
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })
    useGame.getState().startGig()
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Eat before taking a gig.',
      tone: 'blocked',
    })
  })
})

describe('daily challenge readiness context', () => {
  test('meal challenges unlock only when stock or realistic cash can cover them', () => {
    const broke = dailyChallengeContextOf(challengeState({ money: 0, inventory: {} }))
    expect(broke.maxMealsToday).toBe(0)
    expect(eligibleDailyIds({ money: 0, inventory: {} })).not.toContain('eat-2')

    const stockedIds = eligibleDailyIds({ money: 0, inventory: { noodles: 2 } })
    expect(stockedIds).toContain('eat-2')
    expect(stockedIds).not.toContain('eat-3')

    const lunchMoneyIds = eligibleDailyIds({ money: 6, inventory: {} })
    expect(lunchMoneyIds).toContain('eat-2')
    expect(lunchMoneyIds).toContain('eat-3')
    expect(lunchMoneyIds).not.toContain('eat-5')

    const workdayIds = eligibleDailyIds({ money: 0, jobId: 'barista' })
    expect(workdayIds).toContain('eat-5')
  })

  test('drink challenges unlock only when stock or realistic cash can cover them', () => {
    const broke = dailyChallengeContextOf(challengeState({ money: 0, inventory: {} }))
    expect(broke.maxDrinksToday).toBe(0)
    expect(eligibleDailyIds({ money: 0, inventory: {} })).not.toContain('drink-2')

    const stockedIds = eligibleDailyIds({ money: 0, inventory: { water: 2 } })
    expect(stockedIds).toContain('drink-2')
    expect(stockedIds).not.toContain('drink-4')

    const pocketChangeIds = eligibleDailyIds({ money: 4, inventory: {} })
    expect(pocketChangeIds).toContain('drink-2')
    expect(pocketChangeIds).toContain('drink-4')
  })

  test('hygiene challenges unlock only when stock or realistic cash can cover cleanup', () => {
    const broke = dailyChallengeContextOf(challengeState({ money: 0, inventory: {} }))
    expect(broke.maxHygieneToday).toBe(0)
    expect(eligibleDailyIds({ money: 0, inventory: {} })).not.toContain('clean-1')

    expect(eligibleDailyIds({ money: 0, inventory: { shower_public: 1 } })).toContain('clean-1')
    expect(eligibleDailyIds({ money: 0, inventory: { showerset: 1 } })).toContain('clean-1')
    expect(eligibleDailyIds({ money: 5, inventory: {} })).toContain('clean-1')
  })

  test('resource trip challenges unlock only after map resource nodes exist', () => {
    expect(dailyChallengeContextOf(challengeState({ resourceNodes: [] })).canGatherResources).toBe(false)
    expect(eligibleDailyIds({ resourceNodes: [] })).not.toContain('gather-1')

    expect(dailyChallengeContextOf(challengeState({ resourceNodes: [resourceNode('wood')] })).canGatherResources).toBe(true)
    expect(eligibleDailyIds({ resourceNodes: [resourceNode('wood')] })).toContain('gather-1')

    expect(dailyChallengeContextOf(challengeState({
      resourceNodes: [resourceNode('wood')],
      needs: { hunger: 80, hydration: 80, energy: 5, hygiene: 80, fun: 80 },
    })).canGatherResources).toBe(false)
    expect(eligibleDailyIds({
      resourceNodes: [resourceNode('wood')],
      needs: { hunger: 80, hydration: 80, energy: 5, hygiene: 80, fun: 80 },
    })).not.toContain('gather-1')
  })

  test('started resource trip challenges stay visible after nodes disappear today', () => {
    const ids = eligibleDailyIds({
      resourceNodes: [],
      dailyCounters: {
        ...emptyDailyCounters(),
        gatheredToday: 1,
      },
    })

    expect(ids).toContain('gather-1')
  })

  test('study challenges unlock only when the enrolled course and body can start study', () => {
    const course = EDUCATION_COURSES.course
    const progress = createEducationProgress(course, Date.now())

    expect(dailyChallengeContextOf(challengeState({ educationProgress: [progress] })).hasStudyBlock).toBe(true)
    expect(eligibleDailyIds({ educationProgress: [progress] })).toContain('study-1')

    expect(dailyChallengeContextOf(challengeState({
      educationProgress: [progress],
      needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 },
    })).hasStudyBlock).toBe(false)
    expect(eligibleDailyIds({
      educationProgress: [progress],
      needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 },
    })).not.toContain('study-1')

    expect(dailyChallengeContextOf(challengeState({
      educationProgress: [progress],
      health: 10,
    })).hasStudyBlock).toBe(false)
    expect(eligibleDailyIds({
      educationProgress: [progress],
      health: 10,
    })).not.toContain('study-1')
  })

  test('started study challenges stay visible after the body can no longer start study today', () => {
    const ids = eligibleDailyIds({
      needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 },
      dailyCounters: {
        ...emptyDailyCounters(),
        studiedToday: 1,
      },
    })

    expect(ids).toContain('study-1')
  })

  test('community challenges unlock only when local help and body readiness line up', () => {
    const community = freshCommunityStats()

    expect(dailyChallengeContextOf(challengeState({ community })).canHelpCommunity).toBe(true)
    expect(eligibleDailyIds({ community })).toContain('community-1')

    expect(dailyChallengeContextOf(challengeState({
      community,
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })).canHelpCommunity).toBe(false)
    expect(eligibleDailyIds({
      community,
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })).not.toContain('community-1')

    expect(dailyChallengeContextOf(challengeState({
      community,
      health: 10,
    })).canHelpCommunity).toBe(false)
    expect(eligibleDailyIds({
      community,
      health: 10,
    })).not.toContain('community-1')
  })

  test('started community challenges stay visible after the body can no longer help today', () => {
    const ids = eligibleDailyIds({
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      dailyCounters: {
        ...emptyDailyCounters(),
        communityToday: 1,
      },
    })

    expect(ids).toContain('community-1')
  })

  test('construction labor challenges unlock only after materials and permit are ready', () => {
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)
    const deposited = { ...project, deposited: freshResources(STARTER_HOUSE_RECIPE.required) }
    const ready = { ...deposited, permitFeePaid: true }
    const complete = { ...ready, laborDoneMinutes: ready.laborRequiredMinutes }

    expect(dailyChallengeContextOf(challengeState({ constructionProjects: [project] })).canDoConstructionLabor).toBe(false)
    expect(eligibleDailyIds({ constructionProjects: [project] })).not.toContain('build-60')

    expect(dailyChallengeContextOf(challengeState({ constructionProjects: [deposited] })).canDoConstructionLabor).toBe(false)
    expect(eligibleDailyIds({ constructionProjects: [deposited] })).not.toContain('build-60')

    expect(dailyChallengeContextOf(challengeState({ constructionProjects: [ready] })).canDoConstructionLabor).toBe(true)
    expect(eligibleDailyIds({ constructionProjects: [ready] })).toContain('build-60')

    expect(dailyChallengeContextOf(challengeState({
      constructionProjects: [ready],
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })).canDoConstructionLabor).toBe(false)
    expect(eligibleDailyIds({
      constructionProjects: [ready],
      needs: { hunger: 5, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
    })).not.toContain('build-60')

    expect(dailyChallengeContextOf(challengeState({ constructionProjects: [complete] })).canDoConstructionLabor).toBe(false)
    expect(eligibleDailyIds({ constructionProjects: [complete] })).not.toContain('build-60')
  })

  test('started construction challenges stay visible even after the project finishes today', () => {
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)
    const complete = {
      ...project,
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes,
    }

    const ids = eligibleDailyIds({
      constructionProjects: [complete],
      dailyCounters: {
        ...emptyDailyCounters(),
        constructionMinutesToday: 30,
      },
    })

    expect(ids).toContain('build-60')
  })

  test('Workers Hall hire challenges unlock only when a helper can be paid for ready work', () => {
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)
    const ready = {
      ...project,
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
    }

    expect(dailyChallengeContextOf(challengeState({ money: 1_000, constructionProjects: [project] })).canHireWorkers).toBe(false)
    expect(eligibleDailyIds({ money: 1_000, constructionProjects: [project] })).not.toContain('hire-worker-1')

    expect(dailyChallengeContextOf(challengeState({ money: 4, constructionProjects: [ready] })).canHireWorkers).toBe(false)
    expect(eligibleDailyIds({ money: 4, constructionProjects: [ready] })).not.toContain('hire-worker-1')

    expect(dailyChallengeContextOf(challengeState({ money: 1_000, constructionProjects: [ready] })).canHireWorkers).toBe(true)
    expect(eligibleDailyIds({ money: 1_000, constructionProjects: [ready] })).toContain('hire-worker-1')
  })

  test('started Workers Hall hire challenges stay visible after the target is no longer hire-ready', () => {
    const ids = eligibleDailyIds({
      dailyCounters: {
        ...emptyDailyCounters(),
        workersHiredToday: 1,
      },
    })

    expect(ids).toContain('hire-worker-1')
  })

  test('business development challenges unlock only after resources and budget are ready', () => {
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!
    const deposited = depositBusinessDevelopmentResources(plan, freshResources(plan.required)).project
    const ready = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project
    const complete = { ...ready, laborDoneMinutes: ready.laborRequiredMinutes }

    expect(dailyChallengeContextOf(challengeState({
      assets: [business()],
      businessDevelopmentProjects: [plan],
    })).canDevelopBusiness).toBe(false)
    expect(eligibleDailyIds({ assets: [business()], businessDevelopmentProjects: [plan] })).not.toContain('business-dev-60')

    expect(dailyChallengeContextOf(challengeState({
      assets: [business()],
      businessDevelopmentProjects: [deposited],
    })).canDevelopBusiness).toBe(false)
    expect(eligibleDailyIds({ assets: [business()], businessDevelopmentProjects: [deposited] })).not.toContain('business-dev-60')

    expect(dailyChallengeContextOf(challengeState({
      assets: [business()],
      businessDevelopmentProjects: [ready],
    })).canDevelopBusiness).toBe(true)
    expect(eligibleDailyIds({ assets: [business()], businessDevelopmentProjects: [ready] })).toContain('business-dev-60')

    expect(dailyChallengeContextOf(challengeState({
      assets: [business()],
      businessDevelopmentProjects: [ready],
      needs: { hunger: 80, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
    })).canDevelopBusiness).toBe(false)
    expect(eligibleDailyIds({
      assets: [business()],
      businessDevelopmentProjects: [ready],
      needs: { hunger: 80, hydration: 5, energy: 80, hygiene: 80, fun: 80 },
    })).not.toContain('business-dev-60')

    expect(dailyChallengeContextOf(challengeState({
      assets: [business()],
      businessDevelopmentProjects: [complete],
    })).canDevelopBusiness).toBe(false)
    expect(eligibleDailyIds({ assets: [business()], businessDevelopmentProjects: [complete] })).not.toContain('business-dev-60')
  })

  test('started business development challenges stay visible even after the upgrade finishes today', () => {
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!
    const deposited = depositBusinessDevelopmentResources(plan, freshResources(plan.required)).project
    const ready = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project
    const complete = { ...ready, laborDoneMinutes: ready.laborRequiredMinutes }

    const ids = eligibleDailyIds({
      assets: [business()],
      businessDevelopmentProjects: [complete],
      dailyCounters: {
        ...emptyDailyCounters(),
        businessDevelopmentMinutesToday: 30,
      },
    })

    expect(ids).toContain('business-dev-60')
  })

  test('shift challenges unlock only when the body can safely start work', () => {
    expect(dailyChallengeContextOf(challengeState({ jobId: 'barista' })).maxShiftsToday).toBe(1)
    expect(eligibleDailyIds({ jobId: 'barista' })).toContain('shift-1')

    expect(dailyChallengeContextOf(challengeState({
      jobId: 'barista',
      health: 10,
    })).maxShiftsToday).toBe(0)
    expect(eligibleDailyIds({
      jobId: 'barista',
      health: 10,
    })).not.toContain('shift-1')

    expect(dailyChallengeContextOf(challengeState({
      jobId: 'barista',
      needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 },
    })).maxShiftsToday).toBe(0)
    expect(eligibleDailyIds({
      jobId: 'barista',
      needs: { hunger: 80, hydration: 80, energy: 10, hygiene: 80, fun: 80 },
    })).not.toContain('shift-1')
  })
})

describe('sleep daily counter', () => {
  test('starting sleep counts once for daily tasks even if the player leaves early', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      activity: null,
      dailyCounters: emptyDailyCounters(),
      timesSlept: 0,
      log: [],
    })

    useGame.getState().startSleep()
    expect(useGame.getState().timesSlept).toBe(1)
    expect(useGame.getState().dailyCounters.sleptToday).toBe(1)

    useGame.getState().leaveActivity()
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().timesSlept).toBe(1)
    expect(useGame.getState().dailyCounters.sleptToday).toBe(1)
  })

  test('completed sleep does not double-count after the start action', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 20, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      lastSeenAt: now,
      dailyCounters: emptyDailyCounters(),
      log: [],
      toasts: [],
    })

    useGame.getState().startSleep()
    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'sleep' })
    expect(useGame.getState().dailyCounters.sleptToday).toBe(1)

    advanceLiveTo(activity!.endsAt)

    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().dailyCounters.sleptToday).toBe(1)
  })
})

describe('meal daily counter', () => {
  test('consuming food and drinks count toward the correct daily self-care tasks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      activity: null,
      money: 2,
      inventory: { noodles: 1, water: 1, shower_public: 1 },
      needs: { hunger: 50, hydration: 50, energy: 50, hygiene: 30, fun: 50 },
      dailyCounters: emptyDailyCounters(),
      timesEaten: 0,
      log: [],
    })

    useGame.getState().consume('noodles')
    expect(useGame.getState().timesEaten).toBe(1)
    expect(useGame.getState().dailyCounters.mealsToday).toBe(1)
    expect(useGame.getState().dailyCounters.consumedItemCountsToday).toEqual({ noodles: 1 })
    expect(useGame.getState().dailyCounters.drinksToday).toBe(0)
    expect(useGame.getState().dailyCounters.hygieneToday).toBe(0)

    useGame.getState().consume('water')
    expect(useGame.getState().timesEaten).toBe(1)
    expect(useGame.getState().dailyCounters.mealsToday).toBe(1)
    expect(useGame.getState().dailyCounters.drinksToday).toBe(1)
    expect(useGame.getState().dailyCounters.consumedItemCountsToday).toEqual({ noodles: 1, water: 1 })
    expect(useGame.getState().dailyCounters.hygieneToday).toBe(0)

    useGame.getState().quickDrink()
    expect(useGame.getState().dailyCounters.mealsToday).toBe(1)
    expect(useGame.getState().dailyCounters.drinksToday).toBe(2)
    expect(useGame.getState().dailyCounters.hygieneToday).toBe(0)

    useGame.getState().consume('shower_public')
    expect(useGame.getState().dailyCounters.mealsToday).toBe(1)
    expect(useGame.getState().dailyCounters.drinksToday).toBe(2)
    expect(useGame.getState().dailyCounters.hygieneToday).toBe(1)
    expect(useGame.getState().dailyCounters.consumedItemCountsToday).toEqual({ noodles: 1, water: 1, shower_public: 1 })
  })
})

describe('completed home benefits', () => {
  test('active construction does not grant home sleep recovery until it becomes an asset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)
    const base = {
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 20, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      timesSlept: 0,
      lastSeenAt: now,
      log: [],
      toasts: [],
    }

    useGame.setState({
      ...base,
      assets: [],
      constructionProjects: [project],
    })
    useGame.getState().startSleep()
    expect(useGame.getState().log.at(-1)).toBe('Sleeping rough. A home would make this count for more.')

    vi.setSystemTime(now + 60 * 60_000)
    useGame.getState().tick()
    expect(useGame.getState().needs.energy).toBe(31)

    useGame.setState({
      ...base,
      assets: [home()],
      constructionProjects: [project],
    })
    useGame.getState().startSleep()
    expect(useGame.getState().log.at(-1)).toBe('Lights out at home. Energy refills through the night.')

    vi.setSystemTime(now + 60 * 60_000)
    useGame.getState().tick()
    expect(useGame.getState().needs.energy).toBe(36)
  })

  test('active construction does not grant a kitchen until the home is complete', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)
    const base = {
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      inventory: { bread: 1, cheese: 1 },
      activity: null,
      dailyCounters: emptyDailyCounters(),
      timesEaten: 0,
      needs: { hunger: 50, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      lastSeenAt: now,
      log: [],
      toasts: [],
    }

    useGame.setState({
      ...base,
      assets: [],
      constructionProjects: [project],
    })
    useGame.getState().cook('grilledcheese')

    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().log.at(-1)).toBe('No kitchen yet — a $40 Hot Plate or any home lets you cook.')

    useGame.setState({
      ...base,
      assets: [home()],
      constructionProjects: [project],
    })
    useGame.getState().cook('grilledcheese')

    expect(useGame.getState().activity).toMatchObject({
      kind: 'cook',
      recipeId: 'grilledcheese',
    })
    expect(useGame.getState().inventory).toMatchObject({ bread: 0, cheese: 0 })

    const cookEndsAt = useGame.getState().activity!.endsAt
    useGame.setState({ lastSeenAt: cookEndsAt - 1_000 })
    vi.setSystemTime(cookEndsAt)
    useGame.getState().tick()
    expect(useGame.getState().timesEaten).toBe(1)
    expect(useGame.getState().dailyCounters.mealsToday).toBe(1)
    expect(useGame.getState().dailyCounters.cookedToday).toBe(1)
  })
})

describe('construction worker contracts', () => {
  test('a bought business becomes a map construction project before interior development', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada', spawnLat: 45, spawnLng: 21 },
      money: 20_000,
      assets: [{
        id: 'home-1',
        itemId: 'microstudio',
        kind: 'home',
        name: 'Starter House',
        lat: 45,
        lng: 21,
        incomePerDay: 0,
        pendingIncome: 0,
        placedAtMinute: 0,
      }],
      resources: freshResources(),
      constructionProjects: [],
      businessDevelopmentProjects: [],
      placing: null,
      selectedMapTarget: null,
      panel: null,
      log: [],
      toasts: [],
    })

    useGame.getState().buy('foodcart')
    expect(useGame.getState().money).toBe(5_000)
    expect(useGame.getState().placing).toMatchObject({ id: 'foodcart', category: 'business' })
    expect(useGame.getState().assets.filter((asset) => asset.kind === 'business')).toEqual([])

    useGame.getState().placeAt(45.01, 21.01)

    let state = useGame.getState()
    expect(state.placing).toBeNull()
    expect(state.assets.filter((asset) => asset.kind === 'business')).toEqual([])
    expect(state.businessDevelopmentProjects).toEqual([])
    expect(state.constructionProjects).toHaveLength(1)
    expect(state.constructionProjects[0]).toMatchObject({
      itemId: 'foodcart',
      name: 'Food Cart',
      resultKind: 'business',
      incomePerDay: 200,
      permitFee: 500,
    })
    expect(state.selectedMapTarget).toEqual({ kind: 'construction', id: state.constructionProjects[0].id })
    expect(state.panel).toBe('construction')
    expect(state.log[0]).toContain('Build it before it can open')

    const project = state.constructionProjects[0]
    useGame.setState({ resources: freshResources(project.required) })
    useGame.getState().depositConstructionResources(project.id)
    useGame.getState().payConstructionPermit(project.id)
    state = useGame.getState()
    const ready = state.constructionProjects[0]
    useGame.setState({
      constructionProjects: [{
        ...ready,
        laborDoneMinutes: ready.laborRequiredMinutes,
      }],
    })
    useGame.getState().completeConstructionIfReady(project.id)

    state = useGame.getState()
    const builtBusiness = state.assets.find((asset) => asset.kind === 'business')
    expect(state.constructionProjects).toEqual([])
    expect(builtBusiness).toMatchObject({
      itemId: 'foodcart',
      name: 'Food Cart',
      kind: 'business',
      incomePerDay: 200,
    })
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: builtBusiness!.id })
    expect(state.panel).toBe('business')

    useGame.setState({
      constructionProjects: [{
        ...ready,
        laborDoneMinutes: ready.laborRequiredMinutes,
      }],
      selectedMapTarget: { kind: 'construction', id: ready.id },
      panel: 'construction',
      toasts: [],
    })
    useGame.getState().completeConstructionIfReady(ready.id)

    state = useGame.getState()
    expect(state.constructionProjects).toEqual([])
    expect(state.assets.filter((asset) => asset.id === builtBusiness!.id)).toHaveLength(1)
    expect(state.assets.filter((asset) =>
      asset.kind === 'business' &&
      asset.itemId === builtBusiness!.itemId &&
      asset.lat === builtBusiness!.lat &&
      asset.lng === builtBusiness!.lng
    )).toHaveLength(1)
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: builtBusiness!.id })
    expect(state.panel).toBe('business')

    useGame.getState().upgradeBusiness(builtBusiness!.id)
    state = useGame.getState()
    expect(state.businessDevelopmentProjects).toHaveLength(1)
    expect(state.businessDevelopmentProjects[0]).toMatchObject({
      businessId: builtBusiness!.id,
      businessName: 'Food Cart',
      levelFrom: 1,
      levelTo: 2,
    })
  })

  test('player construction labor waits for materials and permit like hired workers do', () => {
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      constructionProjects: [project],
      selectedMapTarget: null,
      log: [],
      toasts: [],
    })

    useGame.getState().startConstructionWork(project.id)
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: project.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Deposit construction materials before work starts.',
      tone: 'blocked',
    })

    useGame.setState({
      activity: null,
      constructionProjects: [{ ...project, deposited: freshResources(STARTER_HOUSE_RECIPE.required) }],
      selectedMapTarget: null,
      toasts: [],
    })
    useGame.getState().startConstructionWork(project.id)
    expect(useGame.getState().activity).toBeNull()
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: project.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Pay the building permit before work starts.',
      tone: 'blocked',
    })

    useGame.setState({
      activity: null,
      constructionProjects: [{
        ...project,
        deposited: freshResources(STARTER_HOUSE_RECIPE.required),
        permitFeePaid: true,
      }],
      toasts: [],
    })
    useGame.getState().startConstructionWork(project.id)
    expect(useGame.getState().activity).toMatchObject({ kind: 'construction', projectId: project.id })
  })

  test('blocked construction plan actions keep the build site selected', () => {
    const now = Date.now()
    const project = createConstructionProject('starter-house', 45.7, 21.2, now)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      money: 0,
      resources: freshResources(),
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      constructionProjects: [project],
      selectedMapTarget: null,
      panel: null,
      log: [],
      toasts: [],
    })

    useGame.getState().depositConstructionResources(project.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: project.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'No matching construction materials to deposit yet.',
      tone: 'blocked',
    })

    useGame.setState({ selectedMapTarget: null, panel: null, toasts: [] })
    useGame.getState().payConstructionPermit(project.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: project.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Permit needs $500.',
      tone: 'blocked',
    })

    useGame.setState({ selectedMapTarget: null, panel: null, toasts: [] })
    useGame.getState().completeConstructionIfReady(project.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'construction', id: project.id })
    expect(useGame.getState().panel).toBe('construction')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Construction still needs materials, labor, or the permit.',
      tone: 'blocked',
    })
  })

  test('hired workers advance construction over real time without occupying the player activity slot', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, now),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
    }

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      money: 1_000,
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      constructionProjects: [project],
      assets: [],
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().hireConstructionWorker(project.id, 'helper', 1)
    let hired = useGame.getState()
    expect(hired.money).toBe(984)
    expect(hired.activity).toBeNull()
    expect(hired.dailyCounters.workersHiredToday).toBe(1)
    expect(hired.constructionProjects[0].laborDoneMinutes).toBe(0)
    expect(hired.constructionProjects[0].workerContracts).toHaveLength(1)
    expect(hired.constructionProjects[0].workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      paidMinutes: 60,
      workedMinutes: 0,
    })

    advanceLiveTo(now + 30 * 60_000)
    hired = useGame.getState()
    expect(hired.constructionProjects[0].laborDoneMinutes).toBe(30)
    expect(hired.constructionProjects[0].hiredLaborMinutes).toBe(30)
    expect(hired.constructionProjects[0].workerContracts[0].workedMinutes).toBe(30)
    expect(hired.dailyCounters.constructionMinutesToday).toBe(30)
    expect(hired.activity).toBeNull()

    advanceLiveTo(now + 60 * 60_000)
    hired = useGame.getState()
    expect(hired.constructionProjects[0].laborDoneMinutes).toBe(60)
    expect(hired.constructionProjects[0].hiredLaborMinutes).toBe(60)
    expect(hired.constructionProjects[0].workerContracts[0].workedMinutes).toBe(60)
    expect(hired.log.some((entry) => entry === 'Local helper finished paid Workers Hall time on Starter House; 7h labor remains.')).toBe(true)
  })

  test('community backing pays part of a Workers Hall construction contract once per weekly ledger', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, now),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
    }

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      money: 8,
      shiftsWorked: 0,
      community: { ...freshCommunityStats(now), respect: 3 },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      constructionProjects: [project],
      assets: [],
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().hireConstructionWorker(project.id, 'helper', 1)
    const hired = useGame.getState()

    expect(hired.money).toBe(0)
    expect(hired.dailyCounters.workersHiredToday).toBe(1)
    expect(hired.community.helperMinutesUsedThisWeek).toBe(30)
    expect(hired.constructionProjects[0].workerContracts[0]).toMatchObject({
      paidMinutes: 60,
      cost: 8,
      communityCreditMinutes: 30,
      communityCreditValue: 8,
    })
  })

  test('community backing pays part of a Workers Hall business interior contract once per weekly ledger', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!
    const deposited = depositBusinessDevelopmentResources(plan, freshResources(plan.required)).project
    const ready = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [ready],
      money: 8,
      shiftsWorked: 0,
      community: { ...freshCommunityStats(now), respect: 3 },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().hireBusinessDevelopmentWorker(ready.id, 'helper', 1)
    const hired = useGame.getState()

    expect(hired.money).toBe(0)
    expect(hired.dailyCounters.workersHiredToday).toBe(1)
    expect(hired.community.helperMinutesUsedThisWeek).toBe(30)
    expect(hired.businessDevelopmentProjects[0].workerContracts[0]).toMatchObject({
      paidMinutes: 60,
      cost: 8,
      communityCreditMinutes: 30,
      communityCreditValue: 8,
    })
  })

  test('completed construction stays a permanent map asset after duplicate completion attempts', () => {
    const now = Date.now()
    const project = {
      ...createConstructionProject('starter-house', 45.7, 21.2, now),
      deposited: freshResources(STARTER_HOUSE_RECIPE.required),
      permitFeePaid: true,
      laborDoneMinutes: STARTER_HOUSE_RECIPE.laborRequiredMinutes,
    }

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      constructionProjects: [project],
      assets: [],
      selectedMapTarget: { kind: 'construction', id: project.id },
      panel: 'construction',
      log: [],
      toasts: [],
    })

    useGame.getState().completeConstructionIfReady(project.id)

    let state = useGame.getState()
    const builtHome = state.assets.find((asset) => asset.kind === 'home')
    expect(state.constructionProjects).toEqual([])
    expect(builtHome).toMatchObject({
      itemId: 'microstudio',
      kind: 'home',
      name: 'Starter House',
      lat: 45.7,
      lng: 21.2,
    })
    expect(builtHome?.id).toMatch(/^starter-house-home-\d+$/)
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: builtHome!.id })
    expect(state.panel).toBe('home')

    useGame.getState().completeConstructionIfReady(project.id)

    state = useGame.getState()
    expect(state.constructionProjects).toEqual([])
    expect(state.assets.filter((asset) => asset.id === builtHome!.id)).toHaveLength(1)
    expect(state.assets.find((asset) => asset.id === builtHome!.id)).toMatchObject(builtHome!)
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: builtHome!.id })
    expect(state.panel).toBe('home')
    expect(state.toasts.at(-1)).toMatchObject({
      text: 'Construction still needs materials, labor, or the permit.',
      tone: 'blocked',
    })

    useGame.setState({
      constructionProjects: [project],
      selectedMapTarget: { kind: 'construction', id: project.id },
      panel: 'construction',
      toasts: [],
    })
    useGame.getState().completeConstructionIfReady(project.id)

    state = useGame.getState()
    expect(state.constructionProjects).toEqual([])
    expect(state.assets.filter((asset) => asset.id === builtHome!.id)).toHaveLength(1)
    expect(state.assets.filter((asset) =>
      asset.kind === 'home' &&
      asset.itemId === builtHome!.itemId &&
      asset.lat === builtHome!.lat &&
      asset.lng === builtHome!.lng
    )).toHaveLength(1)
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: builtHome!.id })
    expect(state.panel).toBe('home')
  })
})

describe('resource gathering loop', () => {
  test('completed gathering trips count toward roadmap daily challenges', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      resources: freshResources(),
      resourceNodes: [{
        id: 'wood-node',
        kind: 'wood',
        label: 'Local timber lot',
        lat: 45,
        lng: 21,
        source: 'fallback',
        yieldAmount: 25,
        gatherMinutes: 5,
        energyCost: 8,
      }],
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startGatherResource('wood-node')
    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'gather', resourceKind: 'wood', resourceAmount: 25 })

    vi.setSystemTime(activity!.endsAt)
    useGame.getState().tick()

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.resources.wood).toBe(25)
    expect(state.dailyCounters.gatheredToday).toBe(1)
    expect(state.dailyCounters.gatheredResourceAmountsToday).toEqual({ wood: 25 })
  })
})

describe('courier Life Ladder wrapper', () => {
  test('new daily package follows the current Life Ladder primary task', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      money: 500,
      jobId: null,
      shiftsWorked: 0,
      activity: null,
      lastSeenAt: now - 60_000,
      activeCourierPackage: null,
      courierLastDay: 0,
      completedCourierDays: [],
      log: [],
      toasts: [],
    })

    useGame.getState().tick()

    const pkg = useGame.getState().activeCourierPackage
    expect(pkg).toMatchObject({
      day: 1,
      title: 'Find honest work',
      objective: 'Find honest work',
      requirement: { kind: 'job' },
    })

    useGame.getState().completeCourierPackage()
    expect(useGame.getState().completedCourierDays).toEqual([])
    expect(useGame.getState().toasts.at(-1)).toMatchObject({ tone: 'blocked' })

    useGame.setState({ jobId: 'barista' })
    useGame.getState().completeCourierPackage()

    expect(useGame.getState().completedCourierDays).toEqual([1])
    expect(useGame.getState().activeCourierPackage).toBeNull()
  })

  test('campaign packages continue after the first 10 tutorial days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T12:00:00Z'))
    const now = Date.now()
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: tenDaysAgo, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      money: 500,
      jobId: null,
      shiftsWorked: 0,
      activity: null,
      lastSeenAt: now - 60_000,
      activeCourierPackage: null,
      courierLastDay: 0,
      completedCourierDays: [],
      log: [],
      toasts: [],
    })

    useGame.getState().tick()

    expect(useGame.getState().activeCourierPackage).toMatchObject({
      day: 11,
      title: 'Find honest work',
      objective: 'Find honest work',
      requirement: { kind: 'job' },
    })
  })
})

describe('education study loop', () => {
  test('buying education enrolls without granting XP', () => {
    useGame.setState({
      money: 500,
      level: 1,
      xp: 0,
      educationProgress: [],
      log: [],
      toasts: [],
    })

    useGame.getState().buy('course')

    const state = useGame.getState()
    expect(state.money).toBe(420)
    expect(state.xp).toBe(0)
    expect(state.level).toBe(1)
    expect(state.educationProgress).toHaveLength(1)
    expect(state.educationProgress[0]).toMatchObject({
      courseId: 'course',
      studiedMinutes: 0,
      completedAt: null,
    })
  })

  test('study blocks complete courses and grant XP once', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: Date.now(), citizenId: 'ada' },
      money: 500,
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      educationProgress: [],
      activity: null,
      lastSeenAt: Date.now(),
      dailyClaimed: ['buy-1', 'study-1'],
      dailyBonusClaimed: true,
      log: [],
      toasts: [],
    })

    useGame.getState().buy('course')
    useGame.getState().startStudy('course')

    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'study', courseId: 'course', studyMinutes: 60 })

    advanceLiveTo(activity!.endsAt)

    const completed = useGame.getState()
    expect(completed.activity).toBeNull()
    expect(completed.educationProgress[0]).toMatchObject({
      courseId: 'course',
      studiedMinutes: 60,
    })
    expect(completed.educationProgress[0].completedAt).toBe(activity!.endsAt)
    expect(completed.xp).toBe(40)
    expect(completed.dailyCounters.studiedToday).toBe(1)

    useGame.getState().tick()
    expect(useGame.getState().xp).toBe(40)
  })

  test('completed education increases completed shift pay', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      level: 1,
      xp: 0,
      educationProgress: [completedCourse(EDUCATION_COURSES.certification, now)],
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    expect(useGame.getState().dailyCounters.earnedToday).toBe(Math.round(15 * 8 * 1.04))
  })

  test('leaving a study block early gives no minutes or XP', () => {
    useGame.setState({
      money: 500,
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      educationProgress: [],
      activity: null,
      log: [],
      toasts: [],
    })

    useGame.getState().buy('course')
    useGame.getState().startStudy('course')
    useGame.getState().leaveActivity()

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.educationProgress[0].studiedMinutes).toBe(0)
    expect(state.xp).toBe(0)
  })
})

describe('community action loop', () => {
  test('community work completes into respect friendship trust and XP once', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: Date.now(), citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      community: freshCommunityStats(Date.now()),
      activity: null,
      lastSeenAt: Date.now(),
      log: [],
      toasts: [],
    })

    useGame.getState().startCommunityAction('help-errand')

    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'community', communityActionId: 'help-errand', communityMinutes: 35 })

    advanceLiveTo(activity!.endsAt)

    const completed = useGame.getState()
    expect(completed.activity).toBeNull()
    expect(completed.community).toMatchObject({
      respect: 2,
      friendship: 2,
      trust: 2,
      actionsThisWeek: 1,
      actionsToday: 1,
    })
    const xpAfterCompletion = completed.xp
    expect(xpAfterCompletion).toBeGreaterThanOrEqual(30)
    expect(completed.dailyCounters.communityToday).toBe(1)
    expect(completed.mysteryBoxCredits.standard).toBe(1)

    useGame.getState().tick()
    expect(useGame.getState().community.actionsThisWeek).toBe(1)
    expect(useGame.getState().xp).toBe(xpAfterCompletion)
  })

  test('blocks a second community action on the same day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      community: {
        ...freshCommunityStats(now),
        respect: 2,
        friendship: 2,
        trust: 2,
        actionsThisWeek: 1,
        actionsToday: 1,
        actionDay: communityDay(now),
      },
      activity: null,
      log: [],
      toasts: [],
    })

    useGame.getState().startCommunityAction('check-neighbor')

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.community.actionsToday).toBe(1)
    expect(state.xp).toBe(0)
    expect(state.toasts.at(-1)).toMatchObject({ tone: 'blocked' })
  })

  test('does not grant duplicate XP from a carried community action after the daily cap', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      community: {
        ...freshCommunityStats(now),
        respect: 2,
        friendship: 2,
        trust: 2,
        actionsThisWeek: 1,
        actionsToday: 1,
        actionDay: communityDay(now),
      },
      activity: {
        kind: 'community',
        startedAt: now - 20 * 60_000,
        endsAt: now,
        title: 'Check on a neighbor',
        communityActionId: 'check-neighbor',
        communityMinutes: 20,
      },
      lastSeenAt: now - 1_000,
      log: [],
      toasts: [],
    })

    useGame.getState().tick()

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.xp).toBe(0)
    expect(state.community).toMatchObject({
      respect: 2,
      friendship: 2,
      trust: 2,
      actionsThisWeek: 1,
      actionsToday: 1,
    })
  })

  test('leaving community work early gives no community progress', () => {
    useGame.setState({
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      community: freshCommunityStats(Date.now()),
      activity: null,
      log: [],
      toasts: [],
    })

    useGame.getState().startCommunityAction('check-neighbor')
    useGame.getState().leaveActivity()

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.community).toMatchObject({
      respect: 0,
      friendship: 0,
      trust: 0,
      actionsThisWeek: 0,
    })
    expect(state.xp).toBe(0)
  })
})

describe('earned mystery box credits', () => {
  test('blocks envelope opens until a daily or community credit is earned', () => {
    useGame.setState({
      money: 500,
      mysteryBoxCredits: { standard: 0, premium: 0, legendary: 0 },
      mysteryBoxesOpened: 0,
      lastBoxReward: null,
      log: [],
      toasts: [],
    })

    useGame.getState().openMysteryBox('standard')

    const state = useGame.getState()
    expect(state.money).toBe(500)
    expect(state.mysteryBoxesOpened).toBe(0)
    expect(state.lastBoxReward).toBeNull()
    expect(state.toasts.at(-1)).toMatchObject({ tone: 'blocked' })
  })

  test('opening an earned envelope consumes credit without spending cash', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useGame.setState({
      money: 500,
      level: 1,
      xp: 0,
      mysteryBoxCredits: { standard: 1, premium: 0, legendary: 0 },
      mysteryBoxesOpened: 0,
      lastBoxReward: null,
      log: [],
      toasts: [],
    })

    useGame.getState().openMysteryBox('standard')

    const state = useGame.getState()
    expect(state.money).toBe(600)
    expect(state.mysteryBoxCredits.standard).toBe(0)
    expect(state.mysteryBoxesOpened).toBe(1)
    expect(state.lastBoxReward).toMatchObject({
      tier: 'standard',
      label: 'Small grant',
      cash: 100,
      xp: 5,
    })
    expect(state.log.at(-1)).toContain('Opened an earned Standard Envelope')
  })

  test('a serious-work milestone shift earns a premium credit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      community: {
        ...freshCommunityStats(now),
        reliableShifts: 4,
        seriousWorkStreak: 4,
        seriousWorkBest: 4,
        seriousWorkLastDay: communityDay(now - 24 * 3_600_000),
      },
      mysteryBoxCredits: { standard: 0, premium: 0, legendary: 0 },
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    const state = useGame.getState()
    expect(state.community.seriousWorkStreak).toBe(5)
    expect(state.mysteryBoxCredits).toMatchObject({ standard: 0, premium: 1, legendary: 0 })
    expect(state.log.some((entry) => entry.includes('Premium Envelope credit'))).toBe(true)
  })

  test('a larger serious-work milestone shift earns a legendary credit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      community: {
        ...freshCommunityStats(now),
        reliableShifts: 19,
        seriousWorkStreak: 19,
        seriousWorkBest: 19,
        seriousWorkLastDay: communityDay(now - 24 * 3_600_000),
      },
      mysteryBoxCredits: { standard: 0, premium: 0, legendary: 0 },
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    const state = useGame.getState()
    expect(state.community.seriousWorkStreak).toBe(20)
    expect(state.mysteryBoxCredits).toMatchObject({ standard: 0, premium: 0, legendary: 1 })
    expect(state.log.some((entry) => entry.includes('Legendary Envelope credit'))).toBe(true)
  })
})

describe('shift reliability loop', () => {
  test('completing a full shift earns bounded respect and reliable shift credit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      shiftsWorked: 0,
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      level: 1,
      xp: 0,
      community: freshCommunityStats(now),
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'shift', title: 'Barista' })

    vi.setSystemTime(activity!.endsAt)
    useGame.getState().tick()

    const state = useGame.getState()
    expect(state.activity).toBeNull()
    expect(state.shiftsWorked).toBe(1)
    expect(state.community).toMatchObject({
      respect: 1,
      trust: 1,
      reliableShifts: 1,
      workRespectToday: 1,
      seriousWorkStreak: 1,
      seriousWorkBest: 1,
    })
  })

  test('serious work streak advances across real work days separately from login streak', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      shiftsWorked: 0,
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      level: 1,
      xp: 0,
      community: freshCommunityStats(now),
      streakLength: 9,
      streakBest: 9,
      streakLastClaimDay: 1_000_000,
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)
    expect(useGame.getState().community.seriousWorkStreak).toBe(1)
    expect(useGame.getState().streakLength).toBe(9)

    const nextDay = now + 24 * 3_600_000
    vi.setSystemTime(nextDay)
    useGame.setState({
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      lastSeenAt: nextDay,
      activity: null,
    })
    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    const state = useGame.getState()
    expect(state.community.seriousWorkStreak).toBe(2)
    expect(state.community.seriousWorkBest).toBe(2)
    expect(state.streakLength).toBe(9)
  })

  test('new day journal surfaces missed serious work as a repairable commitment', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()
    const priorDay = communityDay(now - 2 * 24 * 3_600_000)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now - 5 * 24 * 3_600_000, citizenId: 'ada' },
      jobId: 'barista',
      shiftsWorked: 3,
      money: 100,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      level: 1,
      xp: 0,
      community: {
        ...freshCommunityStats(now),
        respect: 3,
        trust: 3,
        reliableShifts: 3,
        seriousWorkStreak: 3,
        seriousWorkBest: 3,
        seriousWorkLastDay: priorDay,
      },
      dailyCounters: { ...emptyDailyCounters(), day: priorDay + 1 },
      activity: null,
      lastSeenAt: now - 60_000,
      log: [],
      toasts: [],
    })

    useGame.getState().tick()

    const state = useGame.getState()
    expect(state.dailyCounters.day).toBeGreaterThan(priorDay + 1)
    expect(state.log[0]).toContain('Serious work rhythm slipped yesterday')
    expect(state.log[0]).toContain('repairs the streak')
    expect(state.log[0]).not.toMatch(/shame|failed|punish/i)
    expect(state.community).toMatchObject({
      respect: 3,
      trust: 3,
      seriousWorkStreak: 3,
      seriousWorkBest: 3,
    })
  })

  test('leaving a shift early records a humane reputation hit that reliable work can repair', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      jobId: 'barista',
      shiftsWorked: 0,
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      level: 1,
      xp: 0,
      community: {
        ...freshCommunityStats(now),
        respect: 2,
        trust: 2,
        seriousWorkStreak: 3,
        seriousWorkBest: 3,
        seriousWorkLastDay: communityDay(now - 24 * 3_600_000),
      },
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startShift()
    vi.setSystemTime(now + 2 * 3_600_000)
    useGame.getState().leaveActivity()

    const broken = useGame.getState()
    expect(broken.money).toBe(30)
    expect(broken.community).toMatchObject({
      respect: 1,
      trust: 1,
      brokenCommitments: 1,
      commitmentPenaltyDay: communityDay(now + 2 * 3_600_000),
      seriousWorkStreak: 0,
      seriousWorkBest: 3,
    })
    expect(broken.log.at(0)).toContain('Reliability took a hit')
    expect(broken.toasts.at(-1)).toMatchObject({ text: 'Broken commitment: reliability -1', tone: 'blocked' })

    useGame.getState().startShift()
    vi.setSystemTime(now + 3 * 3_600_000)
    useGame.getState().leaveActivity()
    expect(useGame.getState().community).toMatchObject({
      respect: 1,
      trust: 1,
      brokenCommitments: 2,
    })

    const nextDay = now + 24 * 3_600_000
    vi.setSystemTime(nextDay)
    useGame.setState({
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      activity: null,
      lastSeenAt: nextDay,
    })
    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    const repaired = useGame.getState()
    expect(repaired.shiftsWorked).toBe(1)
    expect(repaired.community).toMatchObject({
      respect: 2,
      trust: 2,
      seriousWorkStreak: 1,
      seriousWorkBest: 3,
      brokenCommitments: 2,
    })
  })
})

describe('business interior development', () => {
  test('planning development does not instantly upgrade a business', () => {
    useGame.setState({
      assets: [business()],
      businessDevelopmentProjects: [],
      log: [],
      toasts: [],
    })

    useGame.getState().upgradeBusiness('foodcart-1')

    const state = useGame.getState()
    expect(state.assets[0]).toMatchObject({ level: 1, incomePerDay: 240 })
    expect(state.businessDevelopmentProjects).toHaveLength(1)
    expect(state.businessDevelopmentProjects[0]).toMatchObject({
      businessId: 'foodcart-1',
      levelFrom: 1,
      levelTo: 2,
      incomeAfter: 480,
    })
  })

  test('materials, budget, and real work complete the interior upgrade', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: Date.now(), citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [],
      money: 2_000,
      resources: freshResources({ wood: 100, stone: 100, metal: 100, glass: 100 }),
      needs: { hunger: 80, hydration: 80, energy: 90, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      lastSeenAt: Date.now(),
      log: [],
      toasts: [],
    })

    useGame.getState().upgradeBusiness('foodcart-1')
    let project = useGame.getState().businessDevelopmentProjects[0]
    useGame.getState().depositBusinessDevelopmentResources(project.id)
    project = useGame.getState().businessDevelopmentProjects[0]
    useGame.getState().payBusinessDevelopmentBudget(project.id)

    while (useGame.getState().businessDevelopmentProjects.length > 0) {
      project = useGame.getState().businessDevelopmentProjects[0]
      useGame.getState().startBusinessDevelopmentWork(project.id)
      const activity = useGame.getState().activity
      expect(activity).toMatchObject({ kind: 'business-development', businessDevelopmentProjectId: project.id })
      vi.setSystemTime(activity!.endsAt)
      useGame.getState().tick()
    }

    const state = useGame.getState()
    expect(state.assets[0]).toMatchObject({ level: 2, incomePerDay: 480 })
    expect(state.businessDevelopmentProjects).toEqual([])
  })

  test('blocked interior plan actions keep the business selected', () => {
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [plan],
      money: 0,
      resources: freshResources(),
      needs: { hunger: 80, hydration: 80, energy: 90, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      selectedMapTarget: null,
      panel: null,
      log: [],
      toasts: [],
    })

    useGame.getState().depositBusinessDevelopmentResources(plan.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'asset', id: plan.businessId })
    expect(useGame.getState().panel).toBe('business')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'No matching interior materials to deposit yet.',
      tone: 'blocked',
    })

    useGame.setState({ selectedMapTarget: null, panel: null, toasts: [] })
    useGame.getState().payBusinessDevelopmentBudget(plan.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'asset', id: plan.businessId })
    expect(useGame.getState().panel).toBe('business')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Development budget needs $960.',
      tone: 'blocked',
    })

    useGame.setState({ selectedMapTarget: null, panel: null, toasts: [] })
    useGame.getState().startBusinessDevelopmentWork(plan.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'asset', id: plan.businessId })
    expect(useGame.getState().panel).toBe('business')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Deposit interior materials before work starts.',
      tone: 'blocked',
    })

    useGame.setState({ selectedMapTarget: null, panel: null, toasts: [] })
    useGame.getState().completeBusinessDevelopmentIfReady(plan.id)
    expect(useGame.getState().selectedMapTarget).toEqual({ kind: 'asset', id: plan.businessId })
    expect(useGame.getState().panel).toBe('business')
    expect(useGame.getState().toasts.at(-1)).toMatchObject({
      text: 'Interior development still needs materials, budget, or labor.',
      tone: 'blocked',
    })
  })

  test('hired interior workers advance over real time without occupying the player activity slot', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [],
      money: 2_000,
      resources: freshResources({ wood: 100, stone: 100, metal: 100, glass: 100 }),
      needs: { hunger: 80, hydration: 80, energy: 90, hygiene: 80, fun: 80 },
      health: 100,
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().upgradeBusiness('foodcart-1')
    let project = useGame.getState().businessDevelopmentProjects[0]
    useGame.getState().depositBusinessDevelopmentResources(project.id)
    project = useGame.getState().businessDevelopmentProjects[0]
    useGame.getState().payBusinessDevelopmentBudget(project.id)
    project = useGame.getState().businessDevelopmentProjects[0]

    useGame.getState().hireBusinessDevelopmentWorker(project.id, 'helper', 1)
    let state = useGame.getState()
    expect(state.money).toBe(1_024)
    expect(state.activity).toBeNull()
    expect(state.dailyCounters.workersHiredToday).toBe(1)
    expect(state.businessDevelopmentProjects[0].laborDoneMinutes).toBe(0)
    expect(state.businessDevelopmentProjects[0].workerContracts).toHaveLength(1)
    expect(state.businessDevelopmentProjects[0].workerContracts[0]).toMatchObject({
      source: 'workers-hall',
      workerId: 'helper',
      paidMinutes: 60,
      workedMinutes: 0,
    })

    advanceLiveTo(now + 30 * 60_000)
    state = useGame.getState()
    expect(state.businessDevelopmentProjects[0].laborDoneMinutes).toBe(30)
    expect(state.businessDevelopmentProjects[0].hiredLaborMinutes).toBe(30)
    expect(state.businessDevelopmentProjects[0].workerContracts[0].workedMinutes).toBe(30)
    expect(state.dailyCounters.businessDevelopmentMinutesToday).toBe(30)
    expect(state.activity).toBeNull()

    advanceLiveTo(now + 60 * 60_000)
    state = useGame.getState()
    expect(state.businessDevelopmentProjects[0].laborDoneMinutes).toBe(60)
    expect(state.businessDevelopmentProjects[0].hiredLaborMinutes).toBe(60)
    expect(state.businessDevelopmentProjects[0].workerContracts[0].workedMinutes).toBe(60)
    expect(state.log.some((entry) => entry === 'Local helper finished paid Workers Hall time on Food Cart; 1h 30m interior labor remains.')).toBe(true)
  })

  test('completed education makes owner interior work more efficient', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!
    const deposited = depositBusinessDevelopmentResources(plan, freshResources(plan.required)).project
    const ready = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [ready],
      educationProgress: [completedCourse(EDUCATION_COURSES.certification, now)],
      money: 0,
      needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
      health: 100,
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startBusinessDevelopmentWork(ready.id)
    const activity = useGame.getState().activity
    expect(activity).toMatchObject({ kind: 'business-development', laborMinutes: 63 })

    advanceLiveTo(activity!.endsAt)

    expect(useGame.getState().businessDevelopmentProjects[0].laborDoneMinutes).toBe(63)
  })

  test('completed business interior stays upgraded after duplicate completion attempts', () => {
    const now = Date.now()
    const plan = createBusinessDevelopmentProject(business(), now)!
    const deposited = depositBusinessDevelopmentResources(plan, freshResources(plan.required)).project
    const ready = {
      ...payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project,
      laborDoneMinutes: deposited.laborRequiredMinutes,
    }

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      assets: [business()],
      businessDevelopmentProjects: [ready],
      selectedMapTarget: { kind: 'asset', id: ready.businessId },
      panel: 'business',
      log: [],
      toasts: [],
    })

    useGame.getState().completeBusinessDevelopmentIfReady(ready.id)

    let state = useGame.getState()
    expect(state.businessDevelopmentProjects).toEqual([])
    expect(state.assets.find((asset) => asset.id === ready.businessId)).toMatchObject({
      id: ready.businessId,
      kind: 'business',
      level: ready.levelTo,
      incomePerDay: ready.incomeAfter,
    })
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: ready.businessId })
    expect(state.panel).toBe('business')

    useGame.getState().completeBusinessDevelopmentIfReady(ready.id)

    state = useGame.getState()
    expect(state.businessDevelopmentProjects).toEqual([])
    expect(state.assets.filter((asset) => asset.id === ready.businessId)).toHaveLength(1)
    expect(state.assets.find((asset) => asset.id === ready.businessId)).toMatchObject({
      id: ready.businessId,
      kind: 'business',
      level: ready.levelTo,
      incomePerDay: ready.incomeAfter,
    })
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: ready.businessId })
    expect(state.panel).toBe('business')
    expect(state.toasts.at(-1)).toMatchObject({
      text: 'Interior development still needs materials, budget, or labor.',
      tone: 'blocked',
    })

    useGame.setState({
      assets: [{ ...business(), level: 3, incomePerDay: 960 }],
      businessDevelopmentProjects: [ready],
      selectedMapTarget: { kind: 'asset', id: ready.businessId },
      panel: 'business',
      toasts: [],
    })
    useGame.getState().completeBusinessDevelopmentIfReady(ready.id)

    state = useGame.getState()
    expect(state.businessDevelopmentProjects).toEqual([])
    expect(state.assets.filter((asset) => asset.id === ready.businessId)).toHaveLength(1)
    expect(state.assets.find((asset) => asset.id === ready.businessId)).toMatchObject({
      id: ready.businessId,
      kind: 'business',
      level: 3,
      incomePerDay: 960,
    })
    expect(state.selectedMapTarget).toEqual({ kind: 'asset', id: ready.businessId })
    expect(state.panel).toBe('business')
  })
})
