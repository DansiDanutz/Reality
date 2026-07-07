import { afterEach, describe, expect, test, vi } from 'vitest'
import { freshCommunityStats } from '../game/community'
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

    vi.setSystemTime(activity!.endsAt)
    useGame.getState().tick()

    const completed = useGame.getState()
    expect(completed.activity).toBeNull()
    expect(completed.educationProgress[0]).toMatchObject({
      courseId: 'course',
      studiedMinutes: 60,
    })
    expect(completed.educationProgress[0].completedAt).toBe(activity!.endsAt)
    expect(completed.xp).toBe(40)

    useGame.getState().tick()
    expect(useGame.getState().xp).toBe(40)
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

    vi.setSystemTime(activity!.endsAt)
    useGame.getState().tick()

    const completed = useGame.getState()
    expect(completed.activity).toBeNull()
    expect(completed.community).toMatchObject({
      respect: 2,
      friendship: 2,
      trust: 2,
      actionsThisWeek: 1,
    })
    expect(completed.xp).toBe(30)

    useGame.getState().tick()
    expect(useGame.getState().community.actionsThisWeek).toBe(1)
    expect(useGame.getState().xp).toBe(30)
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
})
