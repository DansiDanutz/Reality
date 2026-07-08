import { describe, expect, test } from 'vitest'
import { HEALTH_GUIDE_SECTIONS } from './HealthGuideContent'

describe('HealthGuide copy', () => {
  test('frames beta low-HP consequences as hospitalization, not active permanent death', () => {
    const hp = HEALTH_GUIDE_SECTIONS.find((section) => section.title === 'Health (HP)')!

    expect(hp.inGame).toContain('Below 20 HP you cannot work')
    expect(hp.inGame).toContain('hospitalization')
    expect(hp.inGame).toContain('medical bills/debt')
    expect(hp.inGame).toContain('recovery time')
    expect(hp.inGame).toContain('permanent death stays disabled')
    expect(hp.inGame.toLowerCase()).not.toMatch(/\byou die\b|\bdies\b|\bdead\b/)
  })
})
