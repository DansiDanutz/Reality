import {
  addBusinessDevelopmentLabor,
  advanceBusinessDevelopmentWorkerContracts,
  businessDevelopmentProgress,
  completeBusinessDevelopmentProject,
  createBusinessDevelopmentProject,
  depositBusinessDevelopmentResources,
  hireBusinessDevelopmentWorker,
  payBusinessDevelopmentBudget,
} from './businessDevelopment'
import { jobById } from './catalog'
import {
  addConstructionLabor,
  advanceConstructionWorkerContracts,
  businessConstructionRecipe,
  completeConstructionProject,
  createConstructionProject,
  createConstructionProjectFromRecipe,
  depositResources,
  hireConstructionWorker,
  payPermit,
} from './construction'
import { communityActionById } from './community'
import { addResources, RESOURCE_META, freshResources } from './resources'
import type { PlacedAsset } from './types'
import {
  planLifeDay,
  type LifeLadderAsset,
  type LifeLadderSnapshot,
  type LifePlan,
  type LifeRoutineBlock,
  type LifePlanTask,
  type LifeValue,
} from './lifeLadder'
import type { MillionaireStage } from './millionairePath'

export interface LifeRoadmapDay {
  lifeDay: number
  primary: LifePlanTask
  agenda: LifePlanTask[]
  routine: LifeRoutineBlock[]
  routineValues: LifeValue[]
  millionaireStage: MillionaireStage
  millionaireGap: number
  daysToMillionaire: number | null
  netWorth: number
}

export interface LifeRoadmap {
  horizonDays: number
  days: LifeRoadmapDay[]
  finalSnapshot: LifeLadderSnapshot
  finalStage: MillionaireStage
  finalNetWorth: number
  valuesCovered: LifeValue[]
}

const DEFAULT_ROADMAP_DAYS = 8
const MAX_ROADMAP_DAYS = 30
const FOODCART_ITEM = { id: 'foodcart', name: 'Food Cart', price: 15_000, incomePerDay: 200 }
const ROADMAP_DAY_MS = 24 * 60 * 60 * 1000

function clampHorizon(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_ROADMAP_DAYS
  return Math.min(MAX_ROADMAP_DAYS, Math.max(1, Math.floor(days)))
}

function roadmapDayStartMs(lifeDay: number): number {
  return Math.max(0, Math.floor(lifeDay)) * ROADMAP_DAY_MS
}

function roadmapDayEndMs(lifeDay: number): number {
  return roadmapDayStartMs(lifeDay) + ROADMAP_DAY_MS
}

function cloneSnapshot(snapshot: LifeLadderSnapshot): LifeLadderSnapshot {
  return {
    ...snapshot,
    needs: { ...snapshot.needs },
    assets: snapshot.assets.map((asset) => ({ ...asset })),
    inventory: { ...snapshot.inventory },
    resources: freshResources(snapshot.resources),
    constructionProjects: snapshot.constructionProjects.map((project) => ({
      ...project,
      required: freshResources(project.required),
      deposited: freshResources(project.deposited),
      workerContracts: [...project.workerContracts],
    })),
    businessDevelopmentProjects: snapshot.businessDevelopmentProjects.map((project) => ({
      ...project,
      required: freshResources(project.required),
      deposited: freshResources(project.deposited),
      workerContracts: [...project.workerContracts],
    })),
    educationProgress: snapshot.educationProgress.map((progress) => ({ ...progress })),
  }
}

function asPlacedAsset(asset: LifeLadderAsset, index: number): PlacedAsset {
  const fallback = asset.kind === 'home'
    ? { itemId: 'microstudio', name: 'Starter House' }
    : { itemId: 'foodcart', name: 'Food Cart' }
  return {
    id: asset.id ?? `${asset.kind}-${index + 1}`,
    itemId: asset.itemId ?? fallback.itemId,
    kind: asset.kind,
    name: asset.name ?? fallback.name,
    lat: asset.lat ?? 0,
    lng: asset.lng ?? 0,
    incomePerDay: asset.incomePerDay,
    pendingIncome: asset.pendingIncome ?? 0,
    placedAtMinute: asset.placedAtMinute ?? 0,
    level: asset.level,
  }
}

function roadmapDay(plan: LifePlan): LifeRoadmapDay {
  return {
    lifeDay: plan.lifeDay,
    primary: plan.primary,
    agenda: plan.agenda,
    routine: plan.routine,
    routineValues: plan.routine.map((block) => block.value),
    millionaireStage: plan.millionairePath.stage,
    millionaireGap: plan.millionairePath.millionaireGap,
    daysToMillionaire: plan.millionairePath.daysToMillionaire,
    netWorth: plan.millionairePath.netWorth,
  }
}

function updateConstructionProject(
  snapshot: LifeLadderSnapshot,
  projectId: string,
  updater: (project: LifeLadderSnapshot['constructionProjects'][number], current: LifeLadderSnapshot) => LifeLadderSnapshot['constructionProjects'][number] | null,
): LifeLadderSnapshot {
  let next = snapshot
  const projects = snapshot.constructionProjects.flatMap((project) => {
    if (project.id !== projectId) return [project]
    const updated = updater(project, next)
    if (!updated) return []
    return [updated]
  })
  return { ...next, constructionProjects: projects }
}

function updateBusinessDevelopmentProject(
  snapshot: LifeLadderSnapshot,
  projectId: string,
  updater: (project: LifeLadderSnapshot['businessDevelopmentProjects'][number], current: LifeLadderSnapshot) => LifeLadderSnapshot['businessDevelopmentProjects'][number] | null,
): LifeLadderSnapshot {
  let next = snapshot
  const projects = snapshot.businessDevelopmentProjects.flatMap((project) => {
    if (project.id !== projectId) return [project]
    const updated = updater(project, next)
    if (!updated) return []
    return [updated]
  })
  return { ...next, businessDevelopmentProjects: projects }
}

function applyConstructionCompletion(snapshot: LifeLadderSnapshot, projectId: string): LifeLadderSnapshot {
  let completedAsset: LifeLadderAsset | null = null
  const projects = snapshot.constructionProjects.flatMap((project) => {
    if (project.id !== projectId) return [project]
    const complete = completeConstructionProject(project)
    if (!complete.asset) return [project]
    completedAsset = {
      ...complete.asset,
      id: `${project.id}:asset`,
      placedAtMinute: snapshot.lifeDay * 24 * 60,
    }
    return []
  })
  return completedAsset
    ? { ...snapshot, constructionProjects: projects, assets: [...snapshot.assets, completedAsset] }
    : { ...snapshot, constructionProjects: projects }
}

function advanceRoadmapWorkerContracts(snapshot: LifeLadderSnapshot, now: number): LifeLadderSnapshot {
  return {
    ...snapshot,
    constructionProjects: snapshot.constructionProjects.map((project) =>
      advanceConstructionWorkerContracts(project, now).project
    ),
    businessDevelopmentProjects: snapshot.businessDevelopmentProjects.map((project) =>
      advanceBusinessDevelopmentWorkerContracts(project, now).project
    ),
  }
}

function applyReadyConstructionCompletions(snapshot: LifeLadderSnapshot): LifeLadderSnapshot {
  return snapshot.constructionProjects.reduce(
    (next, project) => applyConstructionCompletion(next, project.id),
    snapshot,
  )
}

function applyReadyBusinessCompletions(snapshot: LifeLadderSnapshot): LifeLadderSnapshot {
  return snapshot.businessDevelopmentProjects.reduce(
    (next, project) => applyBusinessCompletion(next, project.id),
    snapshot,
  )
}

function applyBusinessCompletion(snapshot: LifeLadderSnapshot, projectId: string): LifeLadderSnapshot {
  let completed = false
  const projects = snapshot.businessDevelopmentProjects.filter((project) => {
    if (project.id !== projectId) return true
    completed = businessDevelopmentProgress(project).complete
    return !completed
  })
  if (!completed) return { ...snapshot, businessDevelopmentProjects: projects }
  return {
    ...snapshot,
    businessDevelopmentProjects: projects,
    assets: snapshot.assets.map((asset, index) => {
      const placed = asPlacedAsset(asset, index)
      const project = snapshot.businessDevelopmentProjects.find((candidate) => candidate.id === projectId)
      const upgraded = project ? completeBusinessDevelopmentProject(project, placed) : null
      return upgraded ?? asset
    }),
  }
}

function applyRoute(snapshot: LifeLadderSnapshot, plan: LifePlan): LifeLadderSnapshot {
  const route = plan.primary.route
  let next: LifeLadderSnapshot = {
    ...snapshot,
    money: Math.max(0, Math.round(snapshot.money + plan.millionairePath.cashflow.netPerDay)),
  }

  if (snapshot.jobId) {
    next = {
      ...next,
      shiftsWorked: next.shiftsWorked + 1,
      communityRespect: next.communityRespect + 1,
      communityTrust: next.communityTrust + 1,
    }
  }

  if (route.kind === 'panel' && route.panel === 'work' && !next.jobId) {
    next = { ...next, jobId: jobById('barista')?.id ?? 'barista' }
  }

  if (route.kind === 'panel' && route.panel === 'construction' && !next.assets.some((asset) => asset.kind === 'home') && next.constructionProjects.length === 0) {
    next = {
      ...next,
      constructionProjects: [...next.constructionProjects, createConstructionProject('starter-house', 0, 0, next.lifeDay)],
    }
  }

  if (route.kind === 'market' && route.focus === 'business' && next.assets.some((asset) => asset.kind === 'home') && !next.constructionProjects.some((project) => project.resultKind === 'business')) {
    next = {
      ...next,
      constructionProjects: [
        ...next.constructionProjects,
        createConstructionProjectFromRecipe(businessConstructionRecipe(FOODCART_ITEM), 0, 0, next.lifeDay),
      ],
    }
  }

  if (route.kind === 'panel' && route.panel === 'business' && next.businessDevelopmentProjects.length === 0) {
    const business = next.assets.find((asset) => asset.kind === 'business')
    const project = business ? createBusinessDevelopmentProject(asPlacedAsset(business, 0), next.lifeDay) : null
    if (project) next = { ...next, businessDevelopmentProjects: [project] }
  }

  if (route.kind === 'gather') {
    next = {
      ...next,
      resources: addResources(next.resources, route.resourceKind, RESOURCE_META[route.resourceKind].yieldAmount),
    }
  }

  if (route.kind === 'education-action' || (route.kind === 'market' && route.focus === 'education')) {
    const xp = next.xp + 40
    next = {
      ...next,
      xp,
      level: Math.max(next.level, xp >= 40 ? 2 : next.level),
      educationActions: next.educationActions + 1,
    }
  }

  if (route.kind === 'community-action') {
    const action = communityActionById(route.actionId)
    if (action) {
      next = {
        ...next,
        communityRespect: next.communityRespect + action.rewards.respect,
        communityFriendship: next.communityFriendship + action.rewards.friendship,
        communityTrust: next.communityTrust + action.rewards.trust,
        communityActionsThisWeek: next.communityActionsThisWeek + 1,
        communityActionsToday: 1,
      }
    }
  }

  if (route.kind === 'construction-action') {
    if (route.action === 'deposit') {
      next = updateConstructionProject(next, route.projectId, (project, current) => {
        const deposited = depositResources(project, current.resources)
        next = { ...current, resources: deposited.inventory }
        return deposited.project
      })
    } else if (route.action === 'permit') {
      next = updateConstructionProject(next, route.projectId, (project, current) => {
        const paid = payPermit(project, current.money)
        next = { ...current, money: paid.money }
        return paid.project
      })
    } else if (route.action === 'work') {
      next = updateConstructionProject(next, route.projectId, (project) => addConstructionLabor(project, 60))
    } else if (route.action === 'hire-helper') {
      next = updateConstructionProject(next, route.projectId, (project, current) => {
        const now = roadmapDayStartMs(current.lifeDay)
        const hired = hireConstructionWorker(project, 'helper', current.money, route.hours ?? 1, now)
        next = { ...current, money: hired.money }
        return hired.project
      })
    }
    next = applyConstructionCompletion(next, route.projectId)
  }

  if (route.kind === 'business-development-action') {
    if (route.action === 'deposit') {
      next = updateBusinessDevelopmentProject(next, route.projectId, (project, current) => {
        const deposited = depositBusinessDevelopmentResources(project, current.resources)
        next = { ...current, resources: deposited.inventory }
        return deposited.project
      })
    } else if (route.action === 'budget') {
      next = updateBusinessDevelopmentProject(next, route.projectId, (project, current) => {
        const paid = payBusinessDevelopmentBudget(project, current.money)
        next = { ...current, money: paid.money }
        return paid.project
      })
    } else if (route.action === 'work') {
      next = updateBusinessDevelopmentProject(next, route.projectId, (project) => addBusinessDevelopmentLabor(project, 60))
    } else if (route.action === 'hire-helper') {
      next = updateBusinessDevelopmentProject(next, route.projectId, (project, current) => {
        const now = roadmapDayStartMs(current.lifeDay)
        const hired = hireBusinessDevelopmentWorker(project, 'helper', current.money, route.hours ?? 1, now)
        next = { ...current, money: hired.money }
        return hired.project
      })
    }
    next = applyBusinessCompletion(next, route.projectId)
  }

  next = advanceRoadmapWorkerContracts(next, roadmapDayEndMs(snapshot.lifeDay))
  next = applyReadyConstructionCompletions(next)
  next = applyReadyBusinessCompletions(next)

  return {
    ...next,
    lifeDay: next.lifeDay + 1,
    activityKind: null,
    communityActionsToday: 0,
    communityActionsThisWeek: (next.lifeDay + 1) % 7 === 1 ? 0 : next.communityActionsThisWeek,
  }
}

export function planLifeRoadmap(snapshot: LifeLadderSnapshot, days = DEFAULT_ROADMAP_DAYS): LifeRoadmap {
  const horizonDays = clampHorizon(days)
  let current = cloneSnapshot(snapshot)
  const roadmapDays: LifeRoadmapDay[] = []

  for (let index = 0; index < horizonDays; index += 1) {
    const plan = planLifeDay(current)
    roadmapDays.push(roadmapDay(plan))
    current = applyRoute(current, plan)
  }

  const finalPlan = planLifeDay(current)
  return {
    horizonDays,
    days: roadmapDays,
    finalSnapshot: current,
    finalStage: finalPlan.millionairePath.stage,
    finalNetWorth: finalPlan.millionairePath.netWorth,
    valuesCovered: Array.from(new Set(roadmapDays.flatMap((day) => [day.primary.value, ...day.routineValues]))),
  }
}
