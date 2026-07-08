import { describe, expect, test } from 'vitest'
import {
  canStartCommunityAction,
  communityActionById,
  communityDay,
  communityWeek,
  completeCommunityAction,
  completeReliableShift,
  freshCommunityStats,
  missedSeriousWorkYesterday,
  normalizeCommunityStats,
  recordBrokenCommitment,
  resetCommunityActionDayIfNeeded,
  resetCommunityWeekIfNeeded,
} from './community'

describe('community actions', () => {
  test('normalizes old or partial community stats safely', () => {
    expect(normalizeCommunityStats({ respect: 1.8, friendship: -4, trust: 2, actionsThisWeek: 3.2, week: 4.9 }, 1_000)).toEqual({
      respect: 1,
      friendship: 0,
      trust: 2,
      actionsThisWeek: 3,
      actionCountsThisWeek: {},
      week: 4,
      actionsToday: 0,
      actionDay: 0,
      reliableShifts: 0,
      workRespectDay: 0,
      workRespectToday: 0,
      seriousWorkStreak: 0,
      seriousWorkBest: 0,
      seriousWorkLastDay: 0,
      brokenCommitments: 0,
      commitmentPenaltyDay: 0,
      helperMinutesUsedThisWeek: 0,
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
      actionCountsThisWeek: { 'help-errand': 1 },
      actionsToday: 1,
      actionDay: communityDay(1_000),
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
      actionCountsThisWeek: { 'help-errand': 4 },
      week: start,
    }, 8 * 24 * 3_600_000)

    expect(stats.respect).toBe(5)
    expect(stats.actionsThisWeek).toBe(0)
    expect(stats.actionCountsThisWeek).toEqual({})
    expect(stats.week).toBeGreaterThan(start)
  })

  test('daily community actions reset without losing weekly or lifetime values', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const stats = resetCommunityActionDayIfNeeded({
      ...freshCommunityStats(today),
      respect: 5,
      friendship: 4,
      trust: 3,
      actionsThisWeek: 2,
      actionCountsThisWeek: { 'help-errand': 2 },
      actionsToday: 1,
      actionDay: communityDay(today),
    }, today + 24 * 3_600_000)

    expect(stats.respect).toBe(5)
    expect(stats.actionsThisWeek).toBe(2)
    expect(stats.actionCountsThisWeek).toEqual({ 'help-errand': 2 })
    expect(stats.actionsToday).toBe(0)
    expect(stats.actionDay).toBeGreaterThan(communityDay(today))
  })

  test('community rewards are capped to one completed action per day', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const help = communityActionById('help-errand')!
    const neighbor = communityActionById('check-neighbor')!
    const first = completeCommunityAction(freshCommunityStats(today), help, today)
    const secondSameDay = completeCommunityAction(first, neighbor, today + 2 * 3_600_000)

    expect(canStartCommunityAction(first, today + 2 * 3_600_000)).toBe(false)
    expect(secondSameDay).toEqual(first)

    const nextDay = completeCommunityAction(secondSameDay, neighbor, today + 24 * 3_600_000)
    expect(nextDay).toMatchObject({
      respect: 3,
      friendship: 5,
      trust: 3,
      actionsThisWeek: 2,
      actionCountsThisWeek: { 'help-errand': 1, 'check-neighbor': 1 },
      actionsToday: 1,
    })
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
      seriousWorkStreak: 1,
      seriousWorkBest: 1,
      seriousWorkLastDay: communityDay(today),
    })

    const secondSameDay = completeReliableShift(first, today + 2 * 3_600_000)
    expect(secondSameDay.respect).toBe(1)
    expect(secondSameDay.trust).toBe(1)
    expect(secondSameDay.reliableShifts).toBe(2)
    expect(secondSameDay.workRespectToday).toBe(1)
    expect(secondSameDay.seriousWorkStreak).toBe(1)
    expect(secondSameDay.seriousWorkBest).toBe(1)

    const nextDay = completeReliableShift(secondSameDay, today + 24 * 3_600_000)
    expect(nextDay.respect).toBe(2)
    expect(nextDay.trust).toBe(2)
    expect(nextDay.reliableShifts).toBe(3)
    expect(nextDay.workRespectToday).toBe(1)
    expect(nextDay.seriousWorkStreak).toBe(2)
    expect(nextDay.seriousWorkBest).toBe(2)
  })

  test('serious work streak resets after missed work days without losing the best', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const first = completeReliableShift(freshCommunityStats(today), today)
    const second = completeReliableShift(first, today + 24 * 3_600_000)
    const afterGap = completeReliableShift(second, today + 4 * 24 * 3_600_000)

    expect(second.seriousWorkStreak).toBe(2)
    expect(second.seriousWorkBest).toBe(2)
    expect(afterGap.seriousWorkStreak).toBe(1)
    expect(afterGap.seriousWorkBest).toBe(2)
    expect(afterGap.seriousWorkLastDay).toBe(communityDay(today + 4 * 24 * 3_600_000))
  })

  test('detects a missed serious work day only after reliability exists', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const first = completeReliableShift(freshCommunityStats(today), today)

    expect(missedSeriousWorkYesterday(freshCommunityStats(today), today + 3 * 24 * 3_600_000)).toBe(false)
    expect(missedSeriousWorkYesterday(first, today + 24 * 3_600_000)).toBe(false)
    expect(missedSeriousWorkYesterday(first, today + 2 * 24 * 3_600_000)).toBe(true)
  })

  test('broken commitments lose at most one respect and trust per day', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const trusted = {
      ...freshCommunityStats(today),
      respect: 3,
      trust: 2,
      seriousWorkStreak: 4,
      seriousWorkBest: 4,
    }
    const first = recordBrokenCommitment(trusted, today)
    const secondSameDay = recordBrokenCommitment(first, today + 2 * 3_600_000)

    expect(first).toMatchObject({
      respect: 2,
      trust: 1,
      brokenCommitments: 1,
      commitmentPenaltyDay: communityDay(today),
      seriousWorkStreak: 0,
      seriousWorkBest: 4,
    })
    expect(secondSameDay).toMatchObject({
      respect: 2,
      trust: 1,
      brokenCommitments: 2,
      commitmentPenaltyDay: communityDay(today),
      seriousWorkStreak: 0,
      seriousWorkBest: 4,
    })
  })
})
