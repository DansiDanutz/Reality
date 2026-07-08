import { describe, expect, test } from 'vitest'
import {
  businessConstructionRecipe,
  createConstructionProject,
  createConstructionProjectFromRecipe,
} from '../../game/construction'
import { activeBusinessConstructionProject } from './businessPanelView'

function businessProject(itemId: string, name: string, now: number) {
  return createConstructionProjectFromRecipe(
    businessConstructionRecipe({ id: itemId, name, price: 15_000, incomePerDay: 200 }),
    45,
    21,
    now,
  )
}

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
