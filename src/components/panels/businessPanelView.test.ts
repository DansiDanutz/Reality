import { describe, expect, test } from 'vitest'
import {
  businessConstructionRecipe,
  createConstructionProject,
  createConstructionProjectFromRecipe,
} from '../../game/construction'
import type { PlacedAsset } from '../../game/types'
import { activeBusinessConstructionProject, businessPanelView, selectedCompletedBusiness } from './businessPanelView'

function businessProject(itemId: string, name: string, now: number) {
  return createConstructionProjectFromRecipe(
    businessConstructionRecipe({ id: itemId, name, price: 15_000, incomePerDay: 200 }),
    45,
    21,
    now,
  )
}

const businessAsset = (id = 'foodcart-asset', overrides: Partial<PlacedAsset> = {}): PlacedAsset => ({
  id,
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45.7489,
  lng: 21.2087,
  incomePerDay: 240,
  pendingIncome: 0,
  placedAtMinute: 0,
  level: 1,
  ...overrides,
})

const homeAsset = (): PlacedAsset => ({
  id: 'home-asset',
  itemId: 'microstudio',
  kind: 'home',
  name: 'Starter House',
  lat: 45,
  lng: 21,
  incomePerDay: 0,
  pendingIncome: 0,
  placedAtMinute: 0,
})

describe('activeBusinessConstructionProject', () => {
  test('uses the selected unfinished business building first', () => {
    const first = businessProject('foodcart', 'Food Cart', 1_000)
    const selected = businessProject('coffeeshop', 'Coffee Shop', 2_000)

    expect(activeBusinessConstructionProject([first, selected], { kind: 'construction', id: selected.id })).toBe(selected)
  })

  test('falls back to the first business construction when selection is not a business site', () => {
    const home = createConstructionProject('starter-house', 45, 21, 1_000)
    const business = businessProject('foodcart', 'Food Cart', 2_000)

    expect(activeBusinessConstructionProject([home, business], { kind: 'construction', id: home.id })).toBe(business)
  })

  test('does not treat home construction as an unfinished business', () => {
    const home = createConstructionProject('starter-house', 45, 21, 1_000)

    expect(activeBusinessConstructionProject([home], null)).toBeNull()
  })
})

describe('selectedCompletedBusiness', () => {
  test('returns null until a completed business asset exists', () => {
    expect(selectedCompletedBusiness([], null)).toBeNull()
    expect(selectedCompletedBusiness([homeAsset()], { kind: 'asset', id: 'home-asset' })).toBeNull()
  })

  test('prefers the selected completed business over the first business asset', () => {
    const first = businessAsset('foodcart-asset', { name: 'Food Cart' })
    const selected = businessAsset('coffeeshop-asset', { name: 'Coffee Shop' })

    expect(selectedCompletedBusiness([first, selected], { kind: 'asset', id: selected.id })).toBe(selected)
  })
})

describe('businessPanelView', () => {
  test('keeps a selected unfinished business building in build-plan mode even when another business is complete', () => {
    const completed = businessAsset('foodcart-asset')
    const selected = businessProject('coffeeshop', 'Coffee Shop', 2_000)

    expect(businessPanelView([completed], [selected], { kind: 'construction', id: selected.id })).toMatchObject({
      kind: 'construction',
      project: selected,
      title: 'Coffee Shop',
      mapTarget: { kind: 'construction', id: selected.id },
    })
  })

  test('opens the selected completed business interior before falling back to construction', () => {
    const selected = businessAsset('coffeeshop-asset', { itemId: 'coffeeshop', name: 'Coffee Shop' })
    const construction = businessProject('foodcart', 'Food Cart', 1_000)

    expect(businessPanelView([businessAsset('foodcart-asset'), selected], [construction], { kind: 'asset', id: selected.id })).toMatchObject({
      kind: 'interior',
      business: selected,
      mapTarget: { kind: 'asset', id: selected.id },
    })
  })

  test('falls back to the first completed business when no business target is selected', () => {
    const first = businessAsset('foodcart-asset')

    expect(businessPanelView([homeAsset(), first], [], { kind: 'asset', id: 'home-asset' })).toMatchObject({
      kind: 'interior',
      business: first,
    })
  })

  test('shows the first business building when no completed business exists', () => {
    const home = createConstructionProject('starter-house', 45, 21, 1_000)
    const business = businessProject('foodcart', 'Food Cart', 2_000)

    expect(businessPanelView([], [home, business], null)).toMatchObject({
      kind: 'construction',
      project: business,
      mapTarget: { kind: 'construction', id: business.id },
    })
  })

  test('shows the empty business panel when neither a completed business nor business build exists', () => {
    const home = createConstructionProject('starter-house', 45, 21, 1_000)

    expect(businessPanelView([homeAsset()], [home], null)).toEqual({
      kind: 'empty',
      title: 'Business',
      detail: 'No finished business yet. Buy a business, place its foundation, then build it from resources.',
    })
  })
})
