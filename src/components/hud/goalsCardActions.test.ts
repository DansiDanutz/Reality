import { describe, expect, test } from 'vitest'
import type { LifePlanRoute } from '../../game/lifeLadder'
import type { ResourceNode } from '../../game/resources'
import { dispatchLifePlanRoute, type GoalsCardRouteActions } from './goalsCardActions'

type Call = { name: string; args: unknown[] }

function routeActions(resourceNodes: Pick<ResourceNode, 'id' | 'kind'>[] = []) {
  const calls: Call[] = []
  const record = (name: string) => (...args: unknown[]) => {
    calls.push({ name, args })
  }
  const actions: GoalsCardRouteActions = {
    resourceNodes,
    openMarket: record('openMarket') as GoalsCardRouteActions['openMarket'],
    setPanel: record('setPanel') as GoalsCardRouteActions['setPanel'],
    startGatherResource: record('startGatherResource'),
    depositConstructionResources: record('depositConstructionResources'),
    payConstructionPermit: record('payConstructionPermit'),
    startConstructionWork: record('startConstructionWork'),
    hireConstructionWorker: record('hireConstructionWorker') as GoalsCardRouteActions['hireConstructionWorker'],
    completeConstructionIfReady: record('completeConstructionIfReady'),
    depositBusinessDevelopmentResources: record('depositBusinessDevelopmentResources'),
    payBusinessDevelopmentBudget: record('payBusinessDevelopmentBudget'),
    startBusinessDevelopmentWork: record('startBusinessDevelopmentWork'),
    hireBusinessDevelopmentWorker: record('hireBusinessDevelopmentWorker') as GoalsCardRouteActions['hireBusinessDevelopmentWorker'],
    completeBusinessDevelopmentIfReady: record('completeBusinessDevelopmentIfReady'),
    startShift: record('startShift'),
    startCommunityAction: record('startCommunityAction') as GoalsCardRouteActions['startCommunityAction'],
    startStudy: record('startStudy') as GoalsCardRouteActions['startStudy'],
    consume: record('consume'),
    cook: record('cook'),
    quickDrink: record('quickDrink'),
    startSleep: record('startSleep'),
  }
  return { actions, calls }
}

describe('dispatchLifePlanRoute', () => {
  test('opens market and panel routes from the Today Plan', () => {
    const market = routeActions()
    dispatchLifePlanRoute({ kind: 'market', focus: 'food' }, market.actions)
    expect(market.calls).toEqual([{ name: 'openMarket', args: ['food'] }])

    const panel = routeActions()
    dispatchLifePlanRoute({ kind: 'panel', panel: 'business' }, panel.actions)
    expect(panel.calls).toEqual([{ name: 'setPanel', args: ['business'] }])
  })

  test('starts the matching resource node or falls back to construction', () => {
    const found = routeActions([
      { id: 'stone-yard', kind: 'stone' },
      { id: 'oak-stand', kind: 'wood' },
    ])
    dispatchLifePlanRoute({ kind: 'gather', resourceKind: 'wood' }, found.actions)
    expect(found.calls).toEqual([{ name: 'startGatherResource', args: ['oak-stand'] }])

    const missing = routeActions([{ id: 'stone-yard', kind: 'stone' }])
    dispatchLifePlanRoute({ kind: 'gather', resourceKind: 'glass' }, missing.actions)
    expect(missing.calls).toEqual([{ name: 'setPanel', args: ['construction'] }])
  })

  test.each([
    [{ kind: 'construction-action', projectId: 'house-1', action: 'deposit' }, 'depositConstructionResources', ['house-1']],
    [{ kind: 'construction-action', projectId: 'house-1', action: 'permit' }, 'payConstructionPermit', ['house-1']],
    [{ kind: 'construction-action', projectId: 'house-1', action: 'work' }, 'startConstructionWork', ['house-1']],
    [{ kind: 'construction-action', projectId: 'house-1', action: 'hire-helper', hours: 2 }, 'hireConstructionWorker', ['house-1', 'helper', 2]],
    [{ kind: 'construction-action', projectId: 'house-1', action: 'hire-helper' }, 'hireConstructionWorker', ['house-1', 'helper', 1]],
    [{ kind: 'construction-action', projectId: 'house-1', action: 'complete' }, 'completeConstructionIfReady', ['house-1']],
  ] satisfies [LifePlanRoute, string, unknown[]][])('dispatches construction route %#', (route, name, args) => {
    const { actions, calls } = routeActions()
    dispatchLifePlanRoute(route, actions)
    expect(calls).toEqual([{ name, args }])
  })

  test.each([
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'deposit' }, 'depositBusinessDevelopmentResources', ['cart-1']],
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'budget' }, 'payBusinessDevelopmentBudget', ['cart-1']],
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'work' }, 'startBusinessDevelopmentWork', ['cart-1']],
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'hire-helper', hours: 3 }, 'hireBusinessDevelopmentWorker', ['cart-1', 'helper', 3]],
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'hire-helper' }, 'hireBusinessDevelopmentWorker', ['cart-1', 'helper', 1]],
    [{ kind: 'business-development-action', projectId: 'cart-1', action: 'complete' }, 'completeBusinessDevelopmentIfReady', ['cart-1']],
  ] satisfies [LifePlanRoute, string, unknown[]][])('dispatches business interior route %#', (route, name, args) => {
    const { actions, calls } = routeActions()
    dispatchLifePlanRoute(route, actions)
    expect(calls).toEqual([{ name, args }])
  })

  test.each([
    [{ kind: 'work-action', action: 'shift' }, 'startShift', []],
    [{ kind: 'community-action', actionId: 'help-errand' }, 'startCommunityAction', ['help-errand']],
    [{ kind: 'education-action', courseId: 'course' }, 'startStudy', ['course']],
    [{ kind: 'consume-action', itemId: 'sandwich' }, 'consume', ['sandwich']],
    [{ kind: 'cook-action', recipeId: 'home-meal' }, 'cook', ['home-meal']],
    [{ kind: 'survival-action', action: 'drink-water' }, 'quickDrink', []],
    [{ kind: 'survival-action', action: 'sleep' }, 'startSleep', []],
  ] satisfies [LifePlanRoute, string, unknown[]][])('dispatches daily life route %#', (route, name, args) => {
    const { actions, calls } = routeActions()
    dispatchLifePlanRoute(route, actions)
    expect(calls).toEqual([{ name, args }])
  })

  test('keeps no-op routes inert so disabled future tasks are safe', () => {
    const { actions, calls } = routeActions()
    dispatchLifePlanRoute({ kind: 'none' }, actions)
    expect(calls).toEqual([])
  })
})
