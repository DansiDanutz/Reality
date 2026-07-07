import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { communityDay, freshCommunityStats } from '../game/community'
import { courierPackageForDay } from '../game/courierPackages'
import { EDUCATION_COURSES, createEducationProgress } from '../game/education'
import { freshResources } from '../game/resources'
import { useGame } from './gameStore'

const AID = '12345678-1234-4234-9234-123456789abc'
const fetchSpy = vi.fn((_input: string, _init?: RequestInit) => Promise.resolve({ ok: true }))
let storage: Map<string, string>

function installAnalyticsBrowser() {
  storage = new Map()
  fetchSpy.mockClear()
  vi.stubGlobal('window', {})
  vi.stubGlobal('navigator', { doNotTrack: '0' })
  vi.stubGlobal('crypto', { randomUUID: () => AID })
  vi.stubGlobal('fetch', fetchSpy)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
}

function trackedEvents(): string[] {
  return fetchSpy.mock.calls.flatMap(([, init]) =>
    init?.body ? [JSON.parse(String(init.body)).event] : []
  )
}

afterEach(() => {
  vi.useRealTimers()
  useGame.getState().reset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  installAnalyticsBrowser()
  useGame.getState().reset()
})

describe('Life Ladder analytics milestones', () => {
  test('tracks courier package open and completion as Today Plan progress', () => {
    const pkg = courierPackageForDay(1)!
    useGame.setState({
      activeCourierPackage: pkg,
      courierOpenedDays: [],
      completedCourierDays: [],
      money: 0,
      level: 1,
      xp: 0,
      timesEaten: 0,
      sawStreetMode: false,
      resources: freshResources(),
      constructionProjects: [],
      assets: [],
      jobId: null,
      shiftsWorked: 0,
      educationProgress: [],
      community: freshCommunityStats(),
      log: [],
      toasts: [],
    })

    useGame.getState().openCourierPackage()
    useGame.getState().completeCourierPackage()

    expect(trackedEvents()).toEqual(expect.arrayContaining([
      'courier_package_opened',
      'courier_package_completed',
      'today_plan_completed',
    ]))
  })

  test('tracks real study start and course completion', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    const course = EDUCATION_COURSES.course
    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      activity: null,
      lastSeenAt: now,
      educationProgress: [createEducationProgress(course, now)],
      log: [],
      toasts: [],
    })

    useGame.getState().startStudy(course.id)
    const activity = useGame.getState().activity
    vi.setSystemTime(activity!.endsAt)
    useGame.getState().tick()

    expect(trackedEvents()).toEqual(expect.arrayContaining([
      'education_started',
      'education_completed',
    ]))
  })

  test('tracks community help as friendship and respect progress', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      xp: 0,
      community: freshCommunityStats(now),
      activity: null,
      lastSeenAt: now,
      log: [],
      toasts: [],
    })

    useGame.getState().startCommunityAction('help-errand')
    vi.setSystemTime(useGame.getState().activity!.endsAt)
    useGame.getState().tick()

    expect(trackedEvents()).toEqual(expect.arrayContaining([
      'community_action_completed',
      'respect_gained',
      'friendship_gained',
    ]))
  })

  test('tracks a humane respect loss after a broken work commitment', () => {
    const now = Date.UTC(2026, 6, 7, 12)
    vi.useFakeTimers()
    vi.setSystemTime(now)
    useGame.setState({
      money: 0,
      community: {
        ...freshCommunityStats(now),
        respect: 2,
        trust: 2,
        seriousWorkStreak: 2,
        seriousWorkBest: 2,
        seriousWorkLastDay: communityDay(now - 24 * 3_600_000),
      },
      activity: {
        kind: 'shift',
        startedAt: now,
        endsAt: now + 8 * 3_600_000,
        wage: 15,
        title: 'Barista',
      },
      log: [],
      toasts: [],
    })

    useGame.getState().leaveActivity()

    expect(trackedEvents()).toContain('respect_lost')
  })

  test('tracks millionaire path milestones alongside Life Ladder stage progress', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00Z'))
    const now = Date.now()
    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 1, createdAt: now, citizenId: 'ada' },
      money: 500,
      needs: { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 },
      health: 100,
      level: 1,
      jobId: 'barista',
      shiftsWorked: 5,
      community: freshCommunityStats(now),
      activity: null,
      lastSeenAt: now - 1_000,
    })

    useGame.getState().tick()

    expect(trackedEvents()).toEqual(expect.arrayContaining([
      'life_ladder_stage_progress',
      'millionaire_path_milestone',
    ]))
  })
})
