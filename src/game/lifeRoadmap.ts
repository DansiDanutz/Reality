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
import { SHOP_ITEMS, itemById, jobById, recipeById } from './catalog'
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
import { SLEEP_HOURS, advanceLife, applyEffects } from './engine'
import { addResources, RESOURCE_META, freshResources } from './resources'
import type { Needs, PlacedAsset, ShopCategory, ShopItem } from './types'
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
const FIRST_COURSE_ITEM_ID = 'course'
const ROADMAP_DAY_MS = 24 * 60 * 60 * 1000
const CARE_FOCUS_NEED: Partial<Record<ShopCategory, keyof Needs>> = {
  food: 'hunger',
  groceries: 'hunger',
  drinks: 'hydration',
  leisure: 'fun',
  health: 'energy',
}
const FREE_CARE_EFFECTS: Partial<Record<ShopCategory, Partial<Needs>>> = {
  food: { hunger: 25 },
  groceries: { hunger: 12 },
  drinks: { hydration: 35 },
  health: { energy: 10 },
}

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

function careMarketItem(focus: ShopCategory, money: number): ShopItem | null {
  const need = CARE_FOCUS_NEED[focus]
  if (!need) return null
  return SHOP_ITEMS
    .filter((item) =>
      item.category === focus &&
      !item.durable &&
      !item.placeable &&
      item.price <= money &&
      (item.effects?.[need] ?? 0) > 0
    )
    .sort((a, b) => a.price - b.price || ((b.effects?.[need] ?? 0) - (a.effects?.[need] ?? 0)))[0] ?? null
}

function applyNeedEffects(snapshot: LifeLadderSnapshot, effects: Partial<Needs>, healthDelta = 0): LifeLadderSnapshot {
  return {
    ...snapshot,
    needs: applyEffects(snapshot.needs, effects),
    health: Math.min(100, Math.max(0, snapshot.health + healthDelta)),
  }
}

function applyCarePurchase(snapshot: LifeLadderSnapshot, focus: ShopCategory): LifeLadderSnapshot {
  const item = careMarketItem(focus, snapshot.money)
  if (item?.effects) {
    return {
      ...applyNeedEffects(snapshot, item.effects, focus === 'health' ? 8 : 0),
      money: snapshot.money - item.price,
    }
  }
  const fallback = FREE_CARE_EFFECTS[focus]
  return fallback ? applyNeedEffects(snapshot, fallback, focus === 'health' ? 5 : 0) : snapshot
}

function applyInventoryConsume(snapshot: LifeLadderSnapshot, itemId: string): LifeLadderSnapshot {
  const item = itemById(itemId)
  const owned = snapshot.inventory[itemId] ?? 0
  if (!item?.effects || owned <= 0) return snapshot
  return {
    ...applyNeedEffects(snapshot, item.effects),
    inventory: item.durable ? snapshot.inventory : { ...snapshot.inventory, [itemId]: Math.max(0, owned - 1) },
  }
}

function canCookRecipe(recipe: NonNullable<ReturnType<typeof recipeById>>, inventory: Record<string, number>): boolean {
  return Object.entries(recipe.ingredients).every(([id, qty]) => (inventory[id] ?? 0) >= qty)
}

function applyCookedRecipe(snapshot: LifeLadderSnapshot, recipeId: string): LifeLadderSnapshot {
  const recipe = recipeById(recipeId)
  if (!recipe || !canCookRecipe(recipe, snapshot.inventory)) return snapshot
  const inventory = { ...snapshot.inventory }
  for (const [id, qty] of Object.entries(recipe.ingredients)) {
    inventory[id] = Math.max(0, (inventory[id] ?? 0) - qty)
  }
  return {
    ...applyNeedEffects(snapshot, recipe.effects),
    inventory,
  }
}

function applySleep(snapshot: LifeLadderSnapshot): LifeLadderSnapshot {
  const rested = advanceLife(
    {
      needs: snapshot.needs,
      health: snapshot.health,
      assets: snapshot.assets.map(asPlacedAsset),
    },
    SLEEP_HOURS * 60,
    snapshot.assets.some((asset) => asset.kind === 'home') ? 'sleepingHome' : 'sleepingRough',
  )
  return { ...snapshot, needs: rested.needs, health: rested.health }
}

function projectsWorkday(plan: LifePlan): boolean {
  return plan.primary.value !== 'body'
}

function projectedDailyCashDelta(plan: LifePlan): number {
  const cashflow = plan.millionairePath.cashflow
  return cashflow.passivePerDay +
    (projectsWorkday(plan) ? cashflow.wagesPerDay : 0) -
    cashflow.livingCostPerDay -
    cashflow.upkeepPerDay
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
  const workday = projectsWorkday(plan)
  let next: LifeLadderSnapshot = {
    ...snapshot,
    money: Math.max(0, Math.round(snapshot.money + projectedDailyCashDelta(plan))),
  }

  if (snapshot.jobId && workday) {
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

  if (route.kind === 'market' && route.focus === 'business' && next.assets.some((asset) => asset.kind === 'home') && !next.constructionProjects.some((project) => project.resultKind === 'business') && next.money >= FOODCART_ITEM.price) {
    next = {
      ...next,
      money: next.money - FOODCART_ITEM.price,
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
    const coursePrice = route.kind === 'market' ? itemById(FIRST_COURSE_ITEM_ID)?.price ?? 80 : 0
    if (next.money >= coursePrice) {
      const xp = next.xp + 40
      next = {
        ...next,
        money: next.money - coursePrice,
        xp,
        level: Math.max(next.level, xp >= 40 ? 2 : next.level),
        educationActions: next.educationActions + 1,
      }
    }
  }

  if (route.kind === 'market') {
    next = applyCarePurchase(next, route.focus)
  }

  if (route.kind === 'consume-action') {
    next = applyInventoryConsume(next, route.itemId)
  }

  if (route.kind === 'cook-action') {
    next = applyCookedRecipe(next, route.recipeId)
  }

  if (route.kind === 'survival-action') {
    if (route.action === 'drink-water') {
      const water = itemById('water')
      next = water?.effects && next.money >= water.price
        ? { ...applyNeedEffects(next, water.effects), money: next.money - water.price }
        : applyNeedEffects(next, { hydration: 35 })
    } else {
      next = applySleep(next)
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
