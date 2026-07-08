import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject } from '../../game/businessDevelopment'
import {
  businessConstructionRecipe,
  createConstructionProject,
  createConstructionProjectFromRecipe,
} from '../../game/construction'
import { freshResources } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import {
  businessInteriorAssetNavigation,
  businessInteriorAssetView,
  completedAssetNavigation,
  constructionAssetNavigation,
  constructionAssetView,
} from './assetsPanelView'

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

  test('summarizes active Workers Hall interior contracts with ETA', () => {
    const project = createBusinessDevelopmentProject(business(), 1_700_000_000_000)
    if (!project) throw new Error('business development fixture failed')

    const view = businessInteriorAssetView({
      ...project,
      workerContracts: [{
        id: 'foodcart-1:helper:1',
        source: 'workers-hall' as const,
        workerId: 'helper',
        workerName: 'Local helper',
        hiredAt: 1_700_000_000_000,
        paidUntil: 1_700_003_600_000,
        paidMinutes: 60,
        workedMinutes: 15,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    }, 1_700_000_900_000)

    expect(view.workerText).toBe('1 worker active')
    expect(view.workerEtaText).toBe('1 worker active · Workers Hall: Local helper ends in 45m')
    expect(view.workerViews[0]).toMatchObject({
      sourceLabel: 'Workers Hall',
      paidText: '1h paid',
      costText: '$16',
      etaText: 'ends in 45m',
    })
  })
})

describe('asset menu navigation', () => {
  test('routes active construction rows to the build plan and map target', () => {
    const project = createConstructionProject('starter-house', 45, 21, 1_700_000_000_000)

    expect(constructionAssetNavigation(project)).toEqual({
      primary: { label: 'Build plan', target: { kind: 'construction', id: project.id }, panel: 'construction' },
      map: { label: 'Show map', target: { kind: 'construction', id: project.id }, panel: null },
    })
  })

  test('routes active business interiors to the business plan and map target', () => {
    const project = createBusinessDevelopmentProject(business(), 1_700_000_000_000)
    if (!project) throw new Error('business development fixture failed')

    expect(businessInteriorAssetNavigation(project)).toEqual({
      primary: { label: 'Open plan', target: { kind: 'asset', id: 'foodcart-1' }, panel: 'business' },
      map: { label: 'Show map', target: { kind: 'asset', id: 'foodcart-1' }, panel: null },
    })
  })

  test('routes completed assets inside first and still exposes the map target', () => {
    const home: PlacedAsset = {
      id: 'home-1',
      itemId: 'microstudio',
      kind: 'home',
      name: 'Starter House',
      lat: 45,
      lng: 21,
      incomePerDay: 0,
      pendingIncome: 0,
      placedAtMinute: 0,
    }

    expect(completedAssetNavigation(home)).toEqual({
      primary: { label: 'Enter house', target: { kind: 'asset', id: 'home-1' }, panel: 'home' },
      map: { label: 'Show map', target: { kind: 'asset', id: 'home-1' }, panel: null },
    })
    expect(completedAssetNavigation(business())).toEqual({
      primary: { label: 'Open business', target: { kind: 'asset', id: 'foodcart-1' }, panel: 'business' },
      map: { label: 'Show map', target: { kind: 'asset', id: 'foodcart-1' }, panel: null },
    })
  })
})

describe('constructionAssetView', () => {
  test('summarizes an active construction project as owned asset work', () => {
    const project = createConstructionProject('starter-house', 45, 21, 1_700_000_000_000)

    const view = constructionAssetView(project)

    expect(view.materialText).toContain('missing')
    expect(view.permitText).toBe('$500 permit')
    expect(view.laborText).toBe('8h labor left')
    expect(view.percentText).toBe('0% built')
    expect(view.icon).toBe('⌂')
    expect(view.kindText).toBe('home shell')
    expect(view.completionText).toBe('enter home')
  })

  test('labels business construction as a business shell before it opens', () => {
    const project = createConstructionProjectFromRecipe(
      businessConstructionRecipe({ id: 'foodcart', name: 'Food Cart', price: 15_000, incomePerDay: 240 }),
      45,
      21,
      1_700_000_000_000,
    )

    const view = constructionAssetView(project)

    expect(view.icon).toBe('◆')
    expect(view.kindText).toBe('business shell')
    expect(view.completionText).toBe('open business')
  })

  test('marks construction materials, permit, labor, and hired workers clearly', () => {
    const project = createConstructionProject('starter-house', 45, 21, 1_700_000_000_000)

    const view = constructionAssetView({
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
      laborDoneMinutes: project.laborRequiredMinutes - 45,
      workerContracts: [{
        id: 'starter-house:helper:1',
        source: 'workers-hall' as const,
        workerId: 'helper',
        workerName: 'Local helper',
        hiredAt: 1_700_000_000_000,
        paidUntil: 1_700_003_600_000,
        paidMinutes: 60,
        workedMinutes: 15,
        laborMultiplier: 1,
        ratePerHour: 16,
        cost: 16,
      }],
    }, 1_700_000_900_000)

    expect(view.materialText).toBe('materials ready')
    expect(view.permitText).toBe('permit paid')
    expect(view.laborText).toBe('45m labor left')
    expect(view.workerText).toBe('1 worker active')
    expect(view.workerEtaText).toBe('1 worker active · Workers Hall: Local helper ends in 45m')
    expect(view.workerViews[0]).toMatchObject({
      sourceLabel: 'Workers Hall',
      progressText: '15m worked of 1h',
      costText: '$16',
      etaText: 'ends in 45m',
    })
    expect(view.progress.resourcesComplete).toBe(true)
    expect(view.progress.permitComplete).toBe(true)
    expect(view.progress.laborComplete).toBe(false)
  })
})
