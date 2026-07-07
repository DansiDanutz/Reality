import { describe, expect, test } from 'vitest'
import {
  communityActionById,
  communityDay,
  communityWeek,
  completeCommunityAction,
  completeReliableShift,
  freshCommunityStats,
  normalizeCommunityStats,
  resetCommunityWeekIfNeeded,
} from './community'

describe('community actions', () => {
  test('normalizes old or partial community stats safely', () => {
    expect(normalizeCommunityStats({ respect: 1.8, friendship: -4, trust: 2, actionsThisWeek: 3.2, week: 4.9 }, 1_000)).toEqual({
      respect: 1,
      friendship: 0,
      trust: 2,
      actionsThisWeek: 3,
      week: 4,
      reliableShifts: 0,
      workRespectDay: 0,
      workRespectToday: 0,
    })
  })

  test('completion adds respect, friendship, trust, and weekly action count', () => {
    const action = communityActionById('help-errand')!
    const stats = completeCommunityAction(freshCommunityStats(1_000), action, 1_000)

    expect(stats).toMatchObject({
      respect: 2,
      friendship: 2,
      trust: 2,
      actionsThisWeek: 1,
    })
  })

  test('weekly community counter resets without losing lifetime values', () => {
    const start = communityWeek(1_000)
    const stats = resetCommunityWeekIfNeeded({
      ...freshCommunityStats(1_000),
      respect: 5,
      friendship: 4,
      trust: 3,
      actionsThisWeek: 6,
      week: start,
    }, 8 * 24 * 3_600_000)

    expect(stats.respect).toBe(5)
    expect(stats.actionsThisWeek).toBe(0)
    expect(stats.week).toBeGreaterThan(start)
  })

  test('reliable shifts earn capped daily respect and uncapped reliability count', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const first = completeReliableShift(freshCommunityStats(today), today)

    expect(first).toMatchObject({
      respect: 1,
      trust: 1,
      reliableShifts: 1,
      workRespectDay: communityDay(today),
      workRespectToday: 1,
    })

    const secondSameDay = completeReliableShift(first, today + 2 * 3_600_000)
    expect(secondSameDay.respect).toBe(1)
    expect(secondSameDay.trust).toBe(1)
    expect(secondSameDay.reliableShifts).toBe(2)
    expect(secondSameDay.workRespectToday).toBe(1)

    const nextDay = completeReliableShift(secondSameDay, today + 24 * 3_600_000)
    expect(nextDay.respect).toBe(2)
    expect(nextDay.trust).toBe(2)
    expect(nextDay.reliableShifts).toBe(3)
    expect(nextDay.workRespectToday).toBe(1)
  })
})
