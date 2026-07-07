import { describe, expect, test } from 'vitest'
import { createBusinessDevelopmentProject, depositBusinessDevelopmentResources, payBusinessDevelopmentBudget } from '../../game/businessDevelopment'
import { createConstructionProject } from '../../game/construction'
import { businessDevelopmentDayForecast, constructionDayForecast } from '../../game/lifeLadder'
import { freshResources } from '../../game/resources'
import type { PlacedAsset } from '../../game/types'
import {
  businessDevelopmentForecastCards,
  constructionFinalStageView,
  constructionForecastCards,
} from './constructionPanelView'

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

describe('constructionFinalStageView', () => {
  test('marks an owned starter home as ready to enter', () => {
    expect(constructionFinalStageView('home', false, true)).toEqual({
      className: 'chip gold',
      label: 'inside',
    })
  })

  test('marks a completed active business build as ready to open', () => {
    expect(constructionFinalStageView('business', true, false)).toEqual({
      className: 'chip gold',
      label: 'open',
    })
  })

  test('keeps an unfinished active business build pending', () => {
    expect(constructionFinalStageView('business', false, true)).toEqual({
      className: 'chip',
      label: 'open',
    })
  })
})

describe('constructionForecastCards', () => {
  test('summarizes starter house trips, permit, labor days, and helper plan', () => {
    const cards = constructionForecastCards(constructionDayForecast())

    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Materials',
      value: '1h 39m',
      detail: 'Wood 5 trips · Stone 4 trips · Metal 3 trips · Glass 2 trips',
    }))
    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Permit',
      value: '$500',
      detail: 'Save $600 above the cash floor.',
    }))
    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Labor',
      value: '8h',
      detail: '8d at 1h/day or 4d at 2h/day.',
    }))
    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Workers',
      value: '3d helper plan',
    }))
  })

  test('shows active paid worker time instead of the helper plan', () => {
    const project = {
      ...createConstructionProject('starter-house', 1, 1, 1),
      deposited: freshResources({ wood: 120, stone: 60, metal: 20, glass: 10 }),
      permitFeePaid: true,
      laborDoneMinutes: 120,
      workerContracts: [{
        id: 'worker-1',
        workerId: 'builder' as const,
        workerName: 'Skilled builder',
        hiredAt: 1,
        paidUntil: 3_600_001,
        paidMinutes: 60,
        workedMinutes: 20,
        laborMultiplier: 1.5,
        ratePerHour: 28,
        cost: 28,
      }],
    }
    const cards = constructionForecastCards(constructionDayForecast(project, freshResources(), 500))

    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Workers',
      value: '1 active',
      detail: '40m paid time can add 1h labor.',
      tone: 'gold',
    }))
  })
})

describe('businessDevelopmentForecastCards', () => {
  test('summarizes interior materials, budget, labor, and helper plan', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const cards = businessDevelopmentForecastCards(businessDevelopmentDayForecast(project, freshResources(), 500))

    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Materials',
      value: '58m',
      detail: 'Wood 1 trip · Stone 1 trip · Metal 3 trips · Glass 2 trips',
    }))
    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Budget',
      value: '$960',
      detail: 'Save $560 above the cash floor.',
    }))
    expect(cards).toContainEqual(expect.objectContaining({
      label: 'Labor',
      value: '2h 30m',
      detail: '3d at 1h/day or 2d at 2h/day.',
    }))
  })

  test('marks funded and gathered interior steps as ready', () => {
    const project = createBusinessDevelopmentProject(business(), 1_000)!
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const paid = payBusinessDevelopmentBudget(deposited, project.budgetCost).project
    const cards = businessDevelopmentForecastCards(businessDevelopmentDayForecast(paid, freshResources(), 500))

    expect(cards).toContainEqual(expect.objectContaining({ label: 'Materials', value: 'ready', tone: 'ok' }))
    expect(cards).toContainEqual(expect.objectContaining({ label: 'Budget', value: 'paid', tone: 'ok' }))
  })
})
