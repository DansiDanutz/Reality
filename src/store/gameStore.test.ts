import { afterEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { freshResources } from '../game/resources'
import type { PlacedAsset, ShopItem } from '../game/types'

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
