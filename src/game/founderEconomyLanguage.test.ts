import { describe, expect, test } from 'vitest'
import economy from '../../docs/ECONOMY.md?raw'
import gameDesign from '../../docs/GAME_DESIGN.md?raw'
import marketing from '../../docs/MARKETING.md?raw'
import playerJourney from '../../docs/plan/01-PLAYER-JOURNEY.md?raw'
import roadmap from '../../docs/ROADMAP.md?raw'
import { TUTORIAL_STEPS } from './tutorial'

const PLAYER_FACING_ECONOMY_DOCS = [
  ['docs/ROADMAP.md', roadmap],
  ['docs/MARKETING.md', marketing],
  ['docs/GAME_DESIGN.md', gameDesign],
  ['docs/ECONOMY.md', economy],
  ['docs/plan/01-PLAYER-JOURNEY.md', playerJourney],
] as const

describe('Founder Economy language guardrails', () => {
  test.each(PLAYER_FACING_ECONOMY_DOCS)('%s avoids passive or permanent-seat promises', (_path, text) => {
    expect(text).not.toMatch(/passive income/i)
    expect(text).not.toMatch(/pay you while/i)
    expect(text).not.toMatch(/permanent founder number/i)
  })

  test('the business tutorial frames revenue as local demand', () => {
    const businessStep = TUTORIAL_STEPS.find((step) => step.id === 'business')

    expect(businessStep?.detail).toBe('Market → Businesses. Your first local customers.')
    expect(businessStep?.detail).not.toMatch(/passive income|payout|withdraw/i)
  })
})
