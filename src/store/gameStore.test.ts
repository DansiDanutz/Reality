import { afterEach, describe, expect, test, vi } from 'vitest'
import { createBusinessDevelopmentProject, depositBusinessDevelopmentResources, payBusinessDevelopmentBudget } from '../game/businessDevelopment'
import { communityDay, freshCommunityStats } from '../game/community'
import { STARTER_HOUSE_RECIPE, createConstructionProject } from '../game/construction'
import { EDUCATION_COURSES, createEducationProgress, type EducationCourse } from '../game/education'
import { freshResources } from '../game/resources'
import type { PlacedAsset, ShopItem } from '../game/types'
import { useGame } from './gameStore'

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

describe('sleep daily counter', () => {
  test('starting sleep counts once for daily tasks even if the player leaves early', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()

    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      activity: null,
      dailyCounters: {
        day: 0,
        mealsToday: 0,
        shiftsToday: 0,
        earnedToday: 0,
        sleptToday: 0,
        boughtToday: 0,
        studiedToday: 0,
        gatheredToday: 0,
        constructionMinutesToday: 0,
        communityToday: 0,
        businessDevelopmentMinutesToday: 0,
      },
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
      dailyCounters: {
        day: 0,
        mealsToday: 0,
        shiftsToday: 0,
        earnedToday: 0,
        sleptToday: 0,
        boughtToday: 0,
        studiedToday: 0,
        gatheredToday: 0,
        constructionMinutesToday: 0,
        communityToday: 0,
        businessDevelopmentMinutesToday: 0,
      },
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
    expect(hired.constructionProjects[0].laborDoneMinutes).toBe(0)
    expect(hired.constructionProjects[0].workerContracts).toHaveLength(1)
    expect(hired.constructionProjects[0].workerContracts[0]).toMatchObject({
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
    expect(state.businessDevelopmentProjects[0].laborDoneMinutes).toBe(0)
    expect(state.businessDevelopmentProjects[0].workerContracts).toHaveLength(1)
    expect(state.businessDevelopmentProjects[0].workerContracts[0]).toMatchObject({
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
})
