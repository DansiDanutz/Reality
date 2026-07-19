import type { LifePlanRoute } from './lifeLadder'

export type FirstSessionStep = 'orient' | 'care' | 'earn' | 'gather' | 'build' | 'recap'

export interface FirstSessionSnapshot {
  targetsSeen: boolean
  timesEaten: number
  jobId: string | null
  shiftsWorked: number
  activeCourierPackage: { day: number } | null
  courierOpenedDays: readonly number[]
  resources: { wood: number; stone: number; metal: number; glass: number }
  resourceNodes: readonly { kind: 'wood' | 'stone' | 'metal' | 'glass' }[]
  constructionProjects: readonly unknown[]
  assets: readonly { kind: string }[]
}

export interface FirstSessionGuide {
  step: FirstSessionStep
  index: number
  total: number
  title: string
  detail: string
  cta: string
  route: LifePlanRoute | { kind: 'journey' } | null
  complete: boolean
}

const TOTAL_STEPS = 6

/** Progress is derived from persisted gameplay outcomes so legacy saves stay compatible. */
export function firstSessionGuideOf(snapshot: FirstSessionSnapshot): FirstSessionGuide {
  if (!snapshot.targetsSeen) return guide('orient', 1, 'Start with the map', 'Dismiss the overview, then Today will show the one action that matters now.', 'Begin orientation', null)
  const timesEaten = Number.isFinite(snapshot.timesEaten) ? snapshot.timesEaten : 0
  if (timesEaten < 1) return guide('care', 2, 'Keep your citizen going', 'Buy one inexpensive food item, use it, and watch the Food need rise.', 'Open Market for food', { kind: 'market', focus: 'food' })
  if (!snapshot.jobId) return guide('earn', 3, 'Find your first income', 'Choose a starter job. Work shows the wage, shift length, and energy commitment before you start.', 'Open Work', { kind: 'panel', panel: 'work' })
  if (snapshot.shiftsWorked < 1) return guide('earn', 3, 'Clock in once', 'A first shift turns time into wages. Review the hours and energy cost, then start when ready.', 'Start first shift', { kind: 'work-action', action: 'shift' })
  const packageOpened = snapshot.activeCourierPackage && Array.isArray(snapshot.courierOpenedDays)
    ? snapshot.courierOpenedDays.includes(snapshot.activeCourierPackage.day)
    : false
  if (snapshot.activeCourierPackage && !packageOpened) return guide('gather', 4, 'Open today’s courier package', 'It introduces the next small task and shows exactly what it will cost and unlock.', 'Open courier package', null)
  const hasResource = snapshot.resources && Object.values(snapshot.resources).some((amount) => Number.isFinite(amount) && amount > 0)
  if (!hasResource && Array.isArray(snapshot.resourceNodes) && snapshot.resourceNodes.length > 0) {
    const node = snapshot.resourceNodes[0]
    return guide('gather', 4, 'Bring back your first resource', 'Choose a nearby node. The map states its yield, energy cost, and cooldown before you gather.', `Gather ${node.kind}`, { kind: 'gather', resourceKind: node.kind })
  }
  const hasHome = snapshot.assets.some((asset) => asset.kind === 'home')
  if ((!Array.isArray(snapshot.constructionProjects) || snapshot.constructionProjects.length === 0) && !hasHome) return guide('build', 5, 'Put a roof on your life', 'Open Build to place the starter site. If a requirement is missing, the panel gives you the exact route to fix it.', 'Open Build', { kind: 'panel', panel: 'construction' })
  return guide('recap', 6, 'Your first loop is underway', 'You have cared for your citizen, earned time, gathered value, and started ownership. Keep following Today or explore your Journey.', 'Open Journey', { kind: 'journey' }, true)
}

function guide(step: FirstSessionStep, index: number, title: string, detail: string, cta: string, route: LifePlanRoute | { kind: 'journey' } | null, complete = false): FirstSessionGuide {
  return { step, index, total: TOTAL_STEPS, title, detail, cta, route, complete }
}
