import type { PlacedAsset } from './types'
import {
  EMPTY_RESOURCES,
  RESOURCE_KINDS,
  type ResourceInventory,
  freshResources,
  resourceShortfall,
} from './resources'

export type ConstructionRecipeId = 'starter-house'

export interface ConstructionRecipe {
  id: ConstructionRecipeId
  name: string
  itemId: string
  required: ResourceInventory
  laborRequiredMinutes: number
  permitFee: number
}

export interface ConstructionProject {
  id: string
  recipeId: ConstructionRecipeId
  name: string
  lat: number
  lng: number
  required: ResourceInventory
  deposited: ResourceInventory
  laborRequiredMinutes: number
  laborDoneMinutes: number
  permitFee: number
  permitFeePaid: boolean
  status: 'planned' | 'building' | 'complete'
  placedAt: number
}

export const STARTER_HOUSE_RECIPE: ConstructionRecipe = {
  id: 'starter-house',
  name: 'Starter House',
  itemId: 'microstudio',
  required: { wood: 120, stone: 60, metal: 20, glass: 10 },
  laborRequiredMinutes: 8 * 60,
  permitFee: 500,
}

export const CONSTRUCTION_RECIPES: Record<ConstructionRecipeId, ConstructionRecipe> = {
  'starter-house': STARTER_HOUSE_RECIPE,
}

export function createConstructionProject(
  recipeId: ConstructionRecipeId,
  lat: number,
  lng: number,
  now = Date.now(),
): ConstructionProject {
  const recipe = CONSTRUCTION_RECIPES[recipeId]
  return {
    id: `${recipeId}-${now}`,
    recipeId,
    name: recipe.name,
    lat,
    lng,
    required: freshResources(recipe.required),
    deposited: freshResources(),
    laborRequiredMinutes: recipe.laborRequiredMinutes,
    laborDoneMinutes: 0,
    permitFee: recipe.permitFee,
    permitFeePaid: false,
    status: 'planned',
    placedAt: now,
  }
}

export function depositResources(
  project: ConstructionProject,
  inventory: ResourceInventory,
): { project: ConstructionProject; inventory: ResourceInventory; deposited: ResourceInventory } {
  const currentInventory = freshResources(inventory)
  const currentDeposited = freshResources(project.deposited)
  const deposited = freshResources()
  const nextInventory = freshResources(currentInventory)
  const nextDeposited = freshResources(currentDeposited)

  for (const kind of RESOURCE_KINDS) {
    const need = Math.max(0, project.required[kind] - currentDeposited[kind])
    const move = Math.min(need, currentInventory[kind])
    if (move <= 0) continue
    nextInventory[kind] -= move
    nextDeposited[kind] += move
    deposited[kind] = move
  }

  return {
    project: {
      ...project,
      deposited: nextDeposited,
      status: project.status === 'planned' ? 'building' : project.status,
    },
    inventory: nextInventory,
    deposited,
  }
}

export function payPermit(
  project: ConstructionProject,
  money: number,
): { project: ConstructionProject; money: number; paid: boolean } {
  if (project.permitFeePaid) return { project, money, paid: false }
  if (money < project.permitFee) return { project, money, paid: false }
  return {
    project: { ...project, permitFeePaid: true, status: project.status === 'planned' ? 'building' : project.status },
    money: money - project.permitFee,
    paid: true,
  }
}

export function addConstructionLabor(
  project: ConstructionProject,
  minutes: number,
): ConstructionProject {
  const laborDoneMinutes = Math.min(project.laborRequiredMinutes, project.laborDoneMinutes + Math.max(0, minutes))
  return {
    ...project,
    laborDoneMinutes,
    status: project.status === 'planned' ? 'building' : project.status,
  }
}

export function constructionShortfall(project: ConstructionProject): ResourceInventory {
  return resourceShortfall(project.deposited, project.required)
}

export function constructionProgress(project: ConstructionProject): {
  resourcesComplete: boolean
  laborComplete: boolean
  permitComplete: boolean
  complete: boolean
} {
  const resourcesComplete = RESOURCE_KINDS.every((kind) => project.deposited[kind] >= project.required[kind])
  const laborComplete = project.laborDoneMinutes >= project.laborRequiredMinutes
  const permitComplete = project.permitFeePaid
  return {
    resourcesComplete,
    laborComplete,
    permitComplete,
    complete: resourcesComplete && laborComplete && permitComplete,
  }
}

export function completeConstructionProject(project: ConstructionProject): {
  project: ConstructionProject
  asset: PlacedAsset | null
} {
  if (!constructionProgress(project).complete) return { project, asset: null }
  const completeProject = { ...project, status: 'complete' as const }
  return {
    project: completeProject,
    asset: {
      id: `${project.recipeId}-home-${Date.now()}`,
      itemId: CONSTRUCTION_RECIPES[project.recipeId].itemId,
      kind: 'home',
      name: project.name,
      lat: project.lat,
      lng: project.lng,
      incomePerDay: 0,
      pendingIncome: 0,
      placedAtMinute: 0,
    },
  }
}

export function totalResourceCount(resources: ResourceInventory = EMPTY_RESOURCES): number {
  return RESOURCE_KINDS.reduce((sum, kind) => sum + (resources[kind] ?? 0), 0)
}
