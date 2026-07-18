import { describe, expect, test } from 'vitest'
import { TOPBAR_NAV_ITEMS, topBarNavPanelIds } from './topBarNav'

describe('topBarNavPanelIds', () => {
  test('keeps paid mystery boxes out of the default-visible navigation', () => {
    expect(topBarNavPanelIds()).not.toContain('boxes')
    expect(TOPBAR_NAV_ITEMS.map((item) => item.label)).not.toContain('Mystery Boxes')
  })

  test('keeps daily-life panels in the primary navigation', () => {
    expect(topBarNavPanelIds()).toEqual([
      'shop',
      'work',
      'assets',
      'construction',
      'founder',
      'operator',
      'top',
      'achievements',
      'profile',
      'handbook',
    ])
  })
})
