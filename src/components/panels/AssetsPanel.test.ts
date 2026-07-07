import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject } from '../../game/businessDevelopment'
import { freshResources } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import { businessInteriorAssetView } from './assetsPanelView'

const business = (): PlacedAsset => ({
  id: 'foodcart-1',
  itemId: 'foodcart',
  kind: 'business',
  name: 'Food Cart',
  lat: 45,
  lng: 21,
  incomePerDay: 240,
  pendingIncome: 32,
  placedAtMinute: 0,
  level: 1,
})

describe('businessInteriorAssetView', () => {
  test('summarizes an active business interior as owned asset work', () => {
    const project = createBusinessDevelopmentProject(business(), 1_700_000_000_000)
    if (!project) throw new Error('business development fixture failed')

    const view = businessInteriorAssetView(project)

    expect(view.title).toBe('Food Cart interior')
    expect(view.levelText).toBe('L1 to L2')
    expect(view.incomeText).toBe('+$240/day when finished')
    expect(view.materialText).toContain('missing')
    expect(view.budgetText).toBe('$960 budget')
    expect(view.laborText).toBe('2h 30m labor left')
    expect(view.percentText).toBe('0% ready')
  })

  test('marks completed materials, budget, and labor clearly', () => {
    const project = createBusinessDevelopmentProject(business(), 1_700_000_000_000)
    if (!project) throw new Error('business development fixture failed')

    const view = businessInteriorAssetView({
      ...project,
      deposited: freshResources(project.required),
      budgetPaid: true,
      laborDoneMinutes: 75,
    })

    expect(view.materialText).toBe('materials ready')
    expect(view.budgetText).toBe('budget paid')
    expect(view.laborText).toBe('1h 15m labor left')
    expect(view.progress.resourcesComplete).toBe(true)
    expect(view.progress.budgetComplete).toBe(true)
    expect(view.progress.laborComplete).toBe(false)
  })
})
