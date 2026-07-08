import type { LifePlanRoute } from '../../game/lifeLadder'
import type { ResourceNode } from '../../game/resources'

export interface GoalsCardRouteActions {
  resourceNodes: readonly Pick<ResourceNode, 'id' | 'kind'>[]
  openMarket: (focus: Extract<LifePlanRoute, { kind: 'market' }>['focus']) => void
  selectMapTarget: (target: NonNullable<Extract<LifePlanRoute, { kind: 'panel' }>['target']>) => void
  setPanel: (panel: Extract<LifePlanRoute, { kind: 'panel' }>['panel']) => void
  startGatherResource: (nodeId: string) => void
  depositConstructionResources: (projectId: string) => void
  payConstructionPermit: (projectId: string) => void
  startConstructionWork: (projectId: string) => void
  hireConstructionWorker: (projectId: string, workerId: 'helper', hours?: number) => void
  completeConstructionIfReady: (projectId: string) => void
  depositBusinessDevelopmentResources: (projectId: string) => void
  payBusinessDevelopmentBudget: (projectId: string) => void
  startBusinessDevelopmentWork: (projectId: string) => void
  hireBusinessDevelopmentWorker: (projectId: string, workerId: 'helper', hours?: number) => void
  completeBusinessDevelopmentIfReady: (projectId: string) => void
  startShift: () => void
  startCommunityAction: (actionId: Extract<LifePlanRoute, { kind: 'community-action' }>['actionId']) => void
  startStudy: (courseId: Extract<LifePlanRoute, { kind: 'education-action' }>['courseId']) => void
  consume: (itemId: string) => void
  cook: (recipeId: string) => void
  quickDrink: () => void
  startSleep: () => void
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Today Plan route action: ${JSON.stringify(value)}`)
}

export function dispatchLifePlanRoute(route: LifePlanRoute, actions: GoalsCardRouteActions): void {
  if (route.kind === 'none') return
  if (route.kind === 'market') {
    actions.openMarket(route.focus)
    return
  }
  if (route.kind === 'gather') {
    const node = actions.resourceNodes.find((candidate) => candidate.kind === route.resourceKind)
    if (node) {
      actions.startGatherResource(node.id)
      return
    }
    actions.setPanel('construction')
    return
  }
  if (route.kind === 'construction-action') {
    if (route.action === 'deposit') actions.depositConstructionResources(route.projectId)
    else if (route.action === 'permit') actions.payConstructionPermit(route.projectId)
    else if (route.action === 'work') actions.startConstructionWork(route.projectId)
    else if (route.action === 'hire-helper') actions.hireConstructionWorker(route.projectId, 'helper', route.hours ?? 1)
    else if (route.action === 'complete') actions.completeConstructionIfReady(route.projectId)
    else assertNever(route.action)
    return
  }
  if (route.kind === 'business-development-action') {
    if (route.action === 'deposit') actions.depositBusinessDevelopmentResources(route.projectId)
    else if (route.action === 'budget') actions.payBusinessDevelopmentBudget(route.projectId)
    else if (route.action === 'work') actions.startBusinessDevelopmentWork(route.projectId)
    else if (route.action === 'hire-helper') actions.hireBusinessDevelopmentWorker(route.projectId, 'helper', route.hours ?? 1)
    else if (route.action === 'complete') actions.completeBusinessDevelopmentIfReady(route.projectId)
    else assertNever(route.action)
    return
  }
  if (route.kind === 'work-action') {
    actions.startShift()
    return
  }
  if (route.kind === 'community-action') {
    actions.startCommunityAction(route.actionId)
    return
  }
  if (route.kind === 'education-action') {
    actions.startStudy(route.courseId)
    return
  }
  if (route.kind === 'consume-action') {
    actions.consume(route.itemId)
    return
  }
  if (route.kind === 'cook-action') {
    actions.cook(route.recipeId)
    return
  }
  if (route.kind === 'survival-action') {
    if (route.action === 'drink-water') actions.quickDrink()
    else actions.startSleep()
    return
  }
  if (route.target) actions.selectMapTarget(route.target)
  actions.setPanel(route.panel)
}
