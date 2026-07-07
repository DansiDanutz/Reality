import { describe, expect, test } from 'vitest'
import {
  communityActionById,
  communityWeek,
  completeCommunityAction,
  freshCommunityStats,
  normalizeCommunityStats,
  resetCommunityWeekIfNeeded,
} from './community'

describe('community actions', () => {
  test('normalizes old or partial community stats safely', () => {
    expect(normalizeCommunityStats({ respect: 1.8, friendship: -4, trust: 2, actionsThisWeek: 3.2, week: 4.9 })).toEqual({
      respect: 1,
      friendship: 0,
      trust: 2,
      actionsThisWeek: 3,
      week: 4,
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
})
