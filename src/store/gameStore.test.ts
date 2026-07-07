import { afterEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import type { ShopItem } from '../game/types'

const pendingHome: ShopItem = {
  id: 'microstudio',
  name: 'Micro Studio',
  category: 'home',
  price: 45_000,
  description: 'Tiny but yours.',
  placeable: true,
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
