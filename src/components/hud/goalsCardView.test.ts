import { describe, expect, test } from 'vitest'
import { millionairePathOf, type MillionairePathInput } from '../../game/millionairePath'
import type { Needs } from '../../game/types'
import { millionaireEtaSummary } from './goalsCardView'

const goodNeeds: Needs = { hunger: 80, hydration: 80, energy: 80, hygiene: 80, fun: 80 }

function path(overrides: Partial<MillionairePathInput> = {}) {
  return millionairePathOf({
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
  })
}

describe('millionaireEtaSummary', () => {
  test('keeps the path forecast clean before community backing exists', () => {
    const summary = millionaireEtaSummary(path())

    expect(summary).toContain('Path to $1M')
    expect(summary).toContain('at current pace')
    expect(summary).not.toContain('+/day')
  })

  test('surfaces practical community advantage in the daily forecast', () => {
    const summary = millionaireEtaSummary(path({
      money: 50_000,
      level: 2,
      educationActions: 1,
      shiftsWorked: 8,
      communityRespect: 8,
      communityFriendship: 12,
      communityTrust: 8,
    }))

    expect(summary).toContain('Community backed +$45/day')
  })

  test('keeps the millionaire completion line simple', () => {
    expect(millionaireEtaSummary(path({ money: 1_000_000 }))).toBe('Path to $1M: reached · keep reinvesting')
  })
})
