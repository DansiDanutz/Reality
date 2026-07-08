import { describe, expect, test } from 'vitest'
import type { PlacedAsset } from '../../game/types'
import { housePanelView, selectedCompletedHome } from './housePanelView'

const home = (id = 'home-1', overrides: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id,
  itemId: 'microstudio',
  kind: 'home',
  name: 'Starter House',
  lat: 45.7489,
  lng: 21.2087,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
  ...overrides,
})

const business = (): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 240,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
})

describe('selectedCompletedHome', () => {
  test('returns null until a completed home asset exists', () => {
    expect(selectedCompletedHome([], null)).toBeNull()
    expect(selectedCompletedHome([business()], { kind: 'asset', id: 'foodcart-1' })).toBeNull()
  })

  test('prefers the selected completed home over the first owned home', () => {
    const first = home('home-1', { name: 'Starter House' })
    const selected = home('home-2', { name: 'Town House' })

    expect(selectedCompletedHome([first, selected], { kind: 'asset', id: selected.id })).toBe(selected)
  })

  test('falls back to the first completed home when the selected target is not a home asset', () => {
    const first = home('home-1')

    expect(selectedCompletedHome([business(), first], { kind: 'asset', id: 'foodcart-1' })).toBe(first)
    expect(selectedCompletedHome([first], { kind: 'construction', id: 'starter-house-build' })).toBe(first)
  })
})

describe('housePanelView', () => {
  test('keeps the house panel in build-plan mode before completion', () => {
    expect(housePanelView([], { kind: 'construction', id: 'starter-house-build' })).toEqual({
      kind: 'empty',
      title: 'House',
      detail: 'No finished home yet. Place a foundation, gather the ingredients, and finish the build first.',
      action: { label: 'Open build plan', panel: 'construction' },
    })
  })

  test('describes the completed home interior and permanent benefits', () => {
    const view = housePanelView([home()], null)

    expect(view).toMatchObject({
      kind: 'interior',
      description: "Small door, big deal: it's yours.",
      marketValueText: '$45,000',
      mapPositionText: '45.75°, 21.21°',
      dailyIncomeText: '$0/day',
      mapTarget: { kind: 'asset', id: 'home-1' },
    })
    expect(view.kind === 'interior' ? view.benefits : []).toEqual([
      { id: 'sleep', title: 'Bedroom', detail: 'Sleep at home for the full rest benefit.' },
      { id: 'kitchen', title: 'Kitchen', detail: 'Cook groceries into better meals.' },
      { id: 'storage', title: 'Storage', detail: 'Your assets and future upgrades live here.' },
    ])
  })
})
