import { describe, expect, test } from 'vitest'
import { CITIZEN_BALANCE, FOUNDER_BALANCE } from './catalog'
import { cashflowOf, netWorthOf } from './engine'
import { MILLIONAIRE_STAGE_ORDER, communityAdvantageOf, millionairePathOf, millionaireStageProgress, type MillionairePathInput } from './millionairePath'
import type { Needs, PlacedAsset } from './types'

const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }

function business(overrides: Partial<PlacedAsset> = {}): PlacedAsset {
  return {
    id: 'foodcart-1',
    itemId: 'foodcart',
    kind: 'business',
    name: 'Food Cart',
    lat: 0,
    lng: 0,
    incomePerDay: 240,
    pendingIncome: 0,
    placedAtMinute: 0,
    ...overrides,
  }
}

function home(overrides: Partial<PlacedAsset> = {}): PlacedAsset {
  return {
    id: 'home-1',
    itemId: 'studio',
    kind: 'home',
    name: 'Studio',
    lat: 0,
    lng: 0,
    incomePerDay: 0,
    pendingIncome: 0,
    placedAtMinute: 0,
    ...overrides,
  }
}

function snap(overrides: Partial<MillionairePathInput> = {}): MillionairePathInput {
  return {
    money: 500,
    inventory: {},
    assets: [],
    needs: goodNeeds,
    health: 100,
    level: 1,
    jobWage: 15,
    shiftsWorked: 0,
    educationActions: 0,
    communityRespect: 0,
    communityFriendship: 0,
    communityTrust: 0,
    ...overrides,
  }
}

describe('millionairePathOf', () => {
  test('uses existing net worth and cashflow formulas as the source of truth', () => {
    const input = snap({
      money: 1_000,
      inventory: { noodles: 2 },
      assets: [business({ pendingIncome: 50 })],
      shiftsWorked: 5,
    })

    const path = millionairePathOf(input)

    expect(path.netWorth).toBe(netWorthOf(input.money, input.inventory, input.assets))
    expect(path.cashflow).toEqual(cashflowOf({
      assets: input.assets,
      hasHome: false,
      wage: input.jobWage,
      shiftsWorked: input.shiftsWorked,
      wageBonus: 0,
    }))
    expect(path.millionaireGap).toBe(1_000_000 - path.netWorth)
  })

  test('body recovery outranks money advice when needs are unsafe', () => {
    const path = millionairePathOf(snap({
      needs: { ...goodNeeds, hydration: 20 },
      assets: [home(), business()],
      money: 50_000,
      level: 5,
    }))

    expect(path.nextAction).toBe('recover-body')
    expect(path.nextActionDetail).toContain('Eat, drink, and sleep')
  })

  test('shows founder cash reaches the same target faster than a non-founder with the same job', () => {
    const founder = millionairePathOf(snap({ money: FOUNDER_BALANCE }))
    const citizen = millionairePathOf(snap({ money: CITIZEN_BALANCE }))

    expect(founder.stage).toBe('stable')
    expect(citizen.stage).toBe('stable')
    expect(founder.daysToMillionaire).not.toBeNull()
    expect(citizen.daysToMillionaire).not.toBeNull()
    expect(founder.daysToMillionaire!).toBeLessThan(citizen.daysToMillionaire!)
  })

  test('home ownership lowers living cost and changes the next capital action', () => {
    const withoutHome = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
    }))
    const withHome = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      assets: [home()],
    }))

    expect(withoutHome.nextAction).toBe('build-home')
    expect(withHome.nextAction).toBe('buy-business')
    expect(withHome.cashflow.livingCostPerDay).toBeLessThan(withoutHome.cashflow.livingCostPerDay)
  })

  test('friendship and trust create practical opportunity without changing cashflow truth', () => {
    const alone = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 8,
    }))
    const backed = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 8,
      communityRespect: 8,
      communityFriendship: 12,
      communityTrust: 8,
    }))

    expect(backed.stage).toBe('reliable')
    expect(backed.cashflow).toEqual(alone.cashflow)
    expect(backed.communityAdvantage).toMatchObject({
      tier: 'backed',
      dailyOpportunityValue: 45,
      weeklyHelperMinutes: 180,
    })
    expect(backed.daysToMillionaire!).toBeLessThan(alone.daysToMillionaire!)
    expect(backed.nextActionDetail).toContain('Community backing adds about $45/day')
  })

  test('friendship alone can move the life path into reliable respect', () => {
    const path = millionairePathOf(snap({
      communityFriendship: 6,
    }))

    expect(path.stage).toBe('reliable')
    expect(path.communityAdvantage.tier).toBe('known')
  })

  test('community advantage tiers combine reliable work and neighbor relationships', () => {
    expect(communityAdvantageOf({
      communityRespect: 0,
      communityFriendship: 0,
      communityTrust: 0,
      shiftsWorked: 0,
    })).toMatchObject({ tier: 'alone', dailyOpportunityValue: 0 })
    expect(communityAdvantageOf({
      communityRespect: 2,
      communityFriendship: 2,
      communityTrust: 1,
      shiftsWorked: 1,
    })).toMatchObject({ tier: 'known', dailyOpportunityValue: 8 })
    expect(communityAdvantageOf({
      communityRespect: 5,
      communityFriendship: 5,
      communityTrust: 4,
      shiftsWorked: 4,
    })).toMatchObject({ tier: 'trusted', dailyOpportunityValue: 22 })
  })

  test('broken commitments reduce practical backing until reliable work repairs the score', () => {
    const trusted = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 5,
      communityRespect: 5,
      communityFriendship: 5,
      communityTrust: 4,
    }))
    const unreliable = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 5,
      communityRespect: 5,
      communityFriendship: 5,
      communityTrust: 4,
      brokenCommitments: 2,
    }))
    const repaired = millionairePathOf(snap({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 13,
      communityRespect: 5,
      communityFriendship: 5,
      communityTrust: 4,
      brokenCommitments: 2,
    }))

    expect(trusted.communityAdvantage).toMatchObject({ score: 28, tier: 'trusted', dailyOpportunityValue: 22 })
    expect(unreliable.communityAdvantage).toMatchObject({ score: 20, tier: 'known', dailyOpportunityValue: 8 })
    expect(repaired.communityAdvantage).toMatchObject({ score: 28, tier: 'trusted', dailyOpportunityValue: 22 })
    expect(unreliable.daysToMillionaire!).toBeGreaterThan(trusted.daysToMillionaire!)
    expect(repaired.daysToMillionaire).toBe(trusted.daysToMillionaire)
  })

  test('business ownership advances stages and uses passive cashflow in the forecast', () => {
    const owner = millionairePathOf(snap({
      assets: [home(), business({ incomePerDay: 20 })],
      money: 20_000,
      level: 3,
      educationActions: 1,
      shiftsWorked: 5,
      communityRespect: 5,
      communityTrust: 5,
    }))
    const employer = millionairePathOf(snap({
      assets: [home(), business(), business({ id: 'laundry-1', itemId: 'laundromat', name: 'Laundromat', incomePerDay: 650 })],
      money: 20_000,
      level: 3,
      educationActions: 1,
      shiftsWorked: 5,
      communityRespect: 5,
      communityTrust: 5,
    }))

    expect(owner.stage).toBe('owner')
    expect(owner.nextAction).toBe('upgrade-business')
    expect(employer.stage).toBe('employer')
    expect(employer.nextAction).toBe('reinvest')
    expect(employer.cashflow.passivePerDay).toBeGreaterThan(owner.cashflow.passivePerDay)
    expect(employer.daysToMillionaire!).toBeLessThan(owner.daysToMillionaire!)
  })

  test('millionaire net worth reaches the existing continent reach rule', () => {
    const path = millionairePathOf(snap({
      money: 1_000_000,
      level: 1,
      assets: [],
    }))

    expect(path.stage).toBe('millionaire')
    expect(path.millionaireGap).toBe(0)
    expect(path.daysToMillionaire).toBe(0)
    expect(path.nextAction).toBe('millionaire')
    expect(path.reach.label).toBe('your continent')
  })

  test('stage progress exposes the full path ladder in order', () => {
    expect(MILLIONAIRE_STAGE_ORDER).toEqual([
      'survival',
      'stable',
      'skilled',
      'reliable',
      'owner',
      'employer',
      'millionaire',
    ])

    expect(millionaireStageProgress('survival')).toMatchObject({
      current: 1,
      total: 7,
      label: 'Survival',
      nextLabel: 'Stable cash',
    })
    expect(millionaireStageProgress('millionaire')).toMatchObject({
      current: 7,
      total: 7,
      percent: 100,
      nextLabel: null,
    })
  })
})
