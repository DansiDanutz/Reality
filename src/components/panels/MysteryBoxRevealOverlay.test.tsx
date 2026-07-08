import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { MysteryBoxRevealOverlay } from './MysteryBoxRevealOverlay'

const jackpotReward = {
  tier: 'standard' as const,
  label: 'Jackpot vault',
  cash: 5_000,
  xp: 200,
  rarity: 'jackpot' as const,
  icon: '🏆',
}

describe('MysteryBoxRevealOverlay', () => {
  test('keeps the reward hidden during the opening shake', () => {
    const html = renderToStaticMarkup(
      <MysteryBoxRevealOverlay revealed={false} reward={jackpotReward} />,
    )

    expect(html).toContain('box-reveal-common')
    expect(html).toContain('shaking')
    expect(html).toContain('Opening...')
    expect(html).toContain('Hold on')
    expect(html).not.toContain('box-reveal-jackpot')
    expect(html).not.toContain('JACKPOT!')
    expect(html).not.toContain('Jackpot vault')
    expect(html).not.toContain('+$5,000')
    expect(html).not.toContain('+200 XP')
    expect(html).not.toContain('🏆')
  })

  test('reveals the reward after the anticipation phase', () => {
    const html = renderToStaticMarkup(
      <MysteryBoxRevealOverlay revealed reward={jackpotReward} />,
    )

    expect(html).toContain('box-reveal-jackpot')
    expect(html).not.toContain('shaking')
    expect(html).toContain('JACKPOT!')
    expect(html).toContain('Jackpot vault')
    expect(html).toContain('+$5,000')
    expect(html).toContain('+200 XP')
    expect(html).toContain('🏆')
  })
})
