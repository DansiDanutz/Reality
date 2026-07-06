import { describe, expect, test } from 'vitest'
import {
  founderCovenantSignalText,
  founderCovenantStatusLabel,
  founderCovenantTone,
} from './founderAreaPanelView'

describe('FounderAreaPanel covenant presenters', () => {
  test('labels covenant status with operational tones', () => {
    expect(founderCovenantStatusLabel('active')).toBe('Active')
    expect(founderCovenantStatusLabel('watch')).toBe('Watch')
    expect(founderCovenantStatusLabel('manual_review')).toBe('Manual review')
    expect(founderCovenantTone('active')).toBe('stable')
    expect(founderCovenantTone('watch')).toBe('warning')
    expect(founderCovenantTone('manual_review')).toBe('critical')
  })

  test('summarizes covenant review signals without replacement actions', () => {
    expect(founderCovenantSignalText({
      kind: 'understaffed_businesses',
      severity: 'warning',
      message: 'Founder-owned businesses need workers before the area can run reliably.',
      businessIds: ['water1', 'food1'],
    })).toBe('Understaffed: water1, food1')

    expect(founderCovenantSignalText({
      kind: 'essential_shortage',
      severity: 'warning',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: ['water', 'housing'],
    })).toBe('Shortage: water, housing')

    expect(founderCovenantSignalText({
      kind: 'founder_debt',
      severity: 'info',
      message: 'Founder has unpaid debt that should be reviewed before profit or succession decisions.',
      amount: 120,
    })).toBe('Founder debt: $120')
  })
})
