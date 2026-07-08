import { describe, expect, test, vi } from 'vitest'
import { createBusinessDevelopmentProject, depositBusinessDevelopmentResources, payBusinessDevelopmentBudget } from '../../game/businessDevelopment'
import { createConstructionProject } from '../../game/construction'
import { freshResources } from '../../game/resources'
import type { PanelId } from '../../store/gameStore'
import { openWorkersHallFromMap } from './workersHallMapAction'

describe('openWorkersHallFromMap', () => {
  test('selects a hire-ready construction site and opens construction', () => {
    const project = createConstructionProject('starter-house', 1, 1, 1)
    const ready = {
      ...project,
      deposited: freshResources(project.required),
      permitFeePaid: true,
    }
    const selectMapTarget = vi.fn()
    const setPanel = vi.fn()

    openWorkersHallFromMap({
      constructionProjects: [ready],
      businessDevelopmentProjects: [],
      selectMapTarget,
      setPanel,
    })

    expect(selectMapTarget).toHaveBeenCalledWith({ kind: 'construction', id: ready.id })
    expect(setPanel).toHaveBeenCalledWith('construction' satisfies PanelId)
  })

  test('selects a hire-ready business interior when construction is blocked', () => {
    const blocked = createConstructionProject('starter-house', 1, 1, 1)
    const asset = {
      id: 'foodcart-1',
      itemId: 'foodcart',
      kind: 'business' as const,
      name: 'Food Cart',
      lat: 45,
      lng: 21,
      incomePerDay: 200,
      pendingIncome: 0,
      placedAtMinute: 1,
      level: 1,
    }
    const project = createBusinessDevelopmentProject(asset, 1_000)
    if (!project) throw new Error('business fixture failed')
    const deposited = depositBusinessDevelopmentResources(project, freshResources(project.required)).project
    const ready = payBusinessDevelopmentBudget(deposited, deposited.budgetCost).project
    const selectMapTarget = vi.fn()
    const setPanel = vi.fn()

    openWorkersHallFromMap({
      constructionProjects: [blocked],
      businessDevelopmentProjects: [ready],
      selectMapTarget,
      setPanel,
    })

    expect(selectMapTarget).toHaveBeenCalledWith({ kind: 'asset', id: ready.businessId })
    expect(setPanel).toHaveBeenCalledWith('business' satisfies PanelId)
  })

  test('clears stale map targets when the hall has no current worker target', () => {
    const selectMapTarget = vi.fn()
    const setPanel = vi.fn()

    openWorkersHallFromMap({
      constructionProjects: [],
      businessDevelopmentProjects: [],
      selectMapTarget,
      setPanel,
    })

    expect(selectMapTarget).toHaveBeenCalledWith(null)
    expect(setPanel).toHaveBeenCalledWith('construction' satisfies PanelId)
  })
})
