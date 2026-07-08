import { describe, expect, test } from 'vitest'
import { citizenGrantLog, founderSeatGrantedLog } from './founderSeatMessages'

describe('founder seat registration messages', () => {
  test('describes founder seats as covenant-governed operating seats', () => {
    const message = founderSeatGrantedLog(12)

    expect(message).toBe('Founder #0012 - operating seat active under the Founder Covenant. $200,000 game-only credits deposited.')
    expect(message).not.toMatch(/forever|payout|withdraw/i)
  })

  test('describes non-founder grants without implying founder ownership', () => {
    expect(citizenGrantLog()).toBe('All 2,000 founder seats are claimed. Citizen grant: $2,500 game-only credits.')
  })
})
