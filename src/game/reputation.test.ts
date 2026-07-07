import { describe, expect, test } from 'vitest'
import { SHOP_ITEMS } from './catalog'
import {
  communityDay,
  completeReliableShift,
  freshCommunityStats,
  missedSeriousWorkYesterday,
} from './community'
import { communityAdvantageOf, millionairePathOf, type MillionairePathInput } from './millionairePath'
import { rewardForStreakDay } from './streak'
import type { Needs } from './types'

const DAY_MS = 24 * 3_600_000
const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }

function snap(overrides: Partial<MillionairePathInput> = {}): MillionairePathInput {
  return {
    money: 0,
    inventory: {},
    assets: [],
    needs: goodNeeds,
    health: 100,
    level: 1,
    jobWage: 0,
    shiftsWorked: 0,
    educationActions: 0,
    communityRespect: 0,
    communityFriendship: 0,
    communityTrust: 0,
    ...overrides,
  }
}

describe('reputation contract', () => {
  test('completed shifts build respect, trust, and reliability with a daily respect cap', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const first = completeReliableShift(freshCommunityStats(today), today)
    const secondSameDay = completeReliableShift(first, today + 2 * 3_600_000)
    const nextDay = completeReliableShift(secondSameDay, today + DAY_MS)

    expect(first).toMatchObject({
      respect: 1,
      trust: 1,
      reliableShifts: 1,
      workRespectToday: 1,
      seriousWorkStreak: 1,
      seriousWorkBest: 1,
      seriousWorkLastDay: communityDay(today),
    })
    expect(secondSameDay).toMatchObject({
      respect: 1,
      trust: 1,
      reliableShifts: 2,
      workRespectToday: 1,
      seriousWorkStreak: 1,
    })
    expect(nextDay).toMatchObject({
      respect: 2,
      trust: 2,
      reliableShifts: 3,
      workRespectToday: 1,
      seriousWorkStreak: 2,
      seriousWorkBest: 2,
    })
  })

  test('a missed serious-work day is recoverable without erasing the best streak', () => {
    const today = Date.UTC(2026, 6, 7, 12)
    const day2 = today + DAY_MS
    const day5 = today + 4 * DAY_MS
    const first = completeReliableShift(freshCommunityStats(today), today)
    const second = completeReliableShift(first, day2)

    expect(second.seriousWorkStreak).toBe(2)
    expect(missedSeriousWorkYesterday(second, day5)).toBe(true)

    const recovered = completeReliableShift(second, day5)
    expect(recovered).toMatchObject({
      respect: 3,
      trust: 3,
      reliableShifts: 3,
      seriousWorkStreak: 1,
      seriousWorkBest: 2,
      seriousWorkLastDay: communityDay(day5),
    })
    expect(missedSeriousWorkYesterday(recovered, day5 + DAY_MS)).toBe(false)
  })

  test('login streak rewards stay separate from earned reputation', () => {
    expect(Object.keys(rewardForStreakDay(30)).sort()).toEqual(['cash', 'xp'])

    const worked = completeReliableShift(freshCommunityStats(), Date.UTC(2026, 6, 7, 12))
    expect(worked.respect).toBe(1)
    expect(worked.seriousWorkStreak).toBe(1)
  })

  test('respect and community backing unlock path advantages only at explicit thresholds', () => {
    expect(communityAdvantageOf({
      communityRespect: 2,
      communityFriendship: 1,
      communityTrust: 0,
      shiftsWorked: 0,
    })).toMatchObject({ tier: 'alone', dailyOpportunityValue: 0 })
    expect(communityAdvantageOf({
      communityRespect: 3,
      communityFriendship: 0,
      communityTrust: 0,
      shiftsWorked: 0,
    })).toMatchObject({ tier: 'known', dailyOpportunityValue: 8 })

    expect(millionairePathOf(snap({ communityRespect: 4 })).stage).toBe('survival')
    expect(millionairePathOf(snap({ communityRespect: 5 })).stage).toBe('reliable')
  })

  test('reputation is not directly purchasable from the shop catalog', () => {
    const reputationKeys = ['respect', 'friendship', 'trust']
    const purchasableReputation = SHOP_ITEMS.filter((item) => {
      const raw = item as unknown as Record<string, unknown>
      const effects = (item.effects ?? {}) as Record<string, unknown>
      return reputationKeys.some((key) => raw[key] !== undefined || effects[key] !== undefined)
    })

    expect(purchasableReputation).toEqual([])
  })
})
