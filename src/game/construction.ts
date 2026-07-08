import {
  RESOURCE_KINDS,
  emptyResourceInventory,
  hasEnoughResources,
  missingResources,
  resourceInventory,
  subtractResourceInventories,
  totalResourceUnits,
  type ResourceInventory,
  type ResourceKind,
} from './resources'

export type ConstructionRecipeId = 'starter-house'
export type ConstructionProjectStatus = 'planned' | 'building' | 'complete'
export type ConstructionProjectError =
  | 'invalid_project'
  | 'project_complete'
  | 'no_resources'
  | 'permit_already_paid'
  | 'insufficient_funds'
  | 'invalid_labor'

export interface ConstructionRecipe {
  id: ConstructionRecipeId
  name: string
  required: ResourceInventory
  laborRequiredMinutes: number
  permitFee: number
  permitReceiverId: string
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
  permitFeePaid: boolean
  permitFee: number
  permitReceiverId: string
  status: ConstructionProjectStatus
}

export interface ConstructionPermitPayment {
  fromId: string
  toId: string
  amount: number
  memo: string
}

export interface ConstructionProgress {
  status: ConstructionProjectStatus
  missing: ResourceInventory
  resourcesComplete: boolean
  laborComplete: boolean
  permitComplete: boolean
  complete: boolean
  resourceUnitsRequired: number
  resourceUnitsDeposited: number
  resourcePercent: number
  laborPercent: number
  overallPercent: number
}

export type CreateConstructionProjectInput = {
  id: string
  lat: number
  lng: number
  name?: string
  recipe?: ConstructionRecipe
}

export type DepositConstructionResourcesResult =
  | {
    ok: true
    project: ConstructionProject
    consumed: ResourceInventory
    remainingInventory: ResourceInventory
    progress: ConstructionProgress
  }
  | {
    ok: false
    error: Extract<ConstructionProjectError, 'project_complete' | 'no_resources'>
    project: ConstructionProject
    consumed: ResourceInventory
    remainingInventory: ResourceInventory
    progress: ConstructionProgress
  }

export type PayConstructionPermitResult =
  | {
    ok: true
    project: ConstructionProject
    payment: ConstructionPermitPayment
    remainingCash: number
    progress: ConstructionProgress
  }
  | {
    ok: false
    error: Extract<ConstructionProjectError, 'invalid_project' | 'project_complete' | 'permit_already_paid' | 'insufficient_funds'>
    project: ConstructionProject
    remainingCash: number
    progress: ConstructionProgress
  }

export type WorkConstructionLaborResult =
  | {
    ok: true
    project: ConstructionProject
    laborAppliedMinutes: number
    progress: ConstructionProgress
  }
  | {
    ok: false
    error: Extract<ConstructionProjectError, 'project_complete' | 'invalid_labor'>
    project: ConstructionProject
    laborAppliedMinutes: 0
    progress: ConstructionProgress
  }

export const STARTER_HOUSE_RECIPE: ConstructionRecipe = {
  id: 'starter-house',
  name: 'Starter House',
  required: resourceInventory({
    wood: 120,
    stone: 60,
    metal: 20,
    glass: 10,
  }),
  laborRequiredMinutes: 8 * 60,
  permitFee: 500,
  permitReceiverId: 'system:building-permits',
}

export function createConstructionProject(input: CreateConstructionProjectInput): ConstructionProject | null {
  const id = input.id.trim()
  const recipe = input.recipe ?? STARTER_HOUSE_RECIPE
  if (!id || !isValidCoordinate(input.lat, input.lng)) return null
  return updateConstructionStatus({
    id,
    recipeId: recipe.id,
    name: input.name?.trim() || recipe.name,
    lat: input.lat,
    lng: input.lng,
    required: resourceInventory(recipe.required),
    deposited: emptyResourceInventory(),
    laborRequiredMinutes: Math.max(0, Math.floor(recipe.laborRequiredMinutes)),
    laborDoneMinutes: 0,
    permitFeePaid: false,
    permitFee: Math.max(0, Math.floor(recipe.permitFee)),
    permitReceiverId: recipe.permitReceiverId,
    status: 'planned',
  })
}

export function depositConstructionResources(
  project: ConstructionProject,
  availableInventory: Partial<Record<ResourceKind, number>>,
  requestedInventory: Partial<Record<ResourceKind, number>> = availableInventory,
): DepositConstructionResourcesResult {
  const progress = constructionProjectProgress(project)
  const available = resourceInventory(availableInventory)
  if (progress.complete) {
    return {
      ok: false,
      error: 'project_complete',
      project,
      consumed: emptyResourceInventory(),
      remainingInventory: available,
      progress,
    }
  }

  const requested = resourceInventory(requestedInventory)
  const consumed = emptyResourceInventory()
  const deposited = resourceInventory(project.deposited)
  for (const kind of RESOURCE_KINDS) {
    const needed = Math.max(0, project.required[kind] - deposited[kind])
    consumed[kind] = Math.min(needed, requested[kind], available[kind])
    deposited[kind] += consumed[kind]
  }

  if (totalResourceUnits(consumed) <= 0) {
    return {
      ok: false,
      error: 'no_resources',
      project,
      consumed,
      remainingInventory: available,
      progress,
    }
  }

  const nextProject = updateConstructionStatus({
    ...project,
    deposited,
  })
  return {
    ok: true,
    project: nextProject,
    consumed,
    remainingInventory: subtractResourceInventories(available, consumed),
    progress: constructionProjectProgress(nextProject),
  }
}

export function payConstructionPermit(
  project: ConstructionProject,
  input: { payerId: string; cash: number },
): PayConstructionPermitResult {
  const progress = constructionProjectProgress(project)
  const cash = roundMoney(input.cash)
  const payerId = input.payerId.trim()
  if (!payerId) {
    return { ok: false, error: 'invalid_project', project, remainingCash: cash, progress }
  }
  if (progress.complete) {
    return { ok: false, error: 'project_complete', project, remainingCash: cash, progress }
  }
  if (project.permitFeePaid) {
    return { ok: false, error: 'permit_already_paid', project, remainingCash: cash, progress }
  }
  if (cash < project.permitFee) {
    return { ok: false, error: 'insufficient_funds', project, remainingCash: cash, progress }
  }

  const nextProject = updateConstructionStatus({
    ...project,
    permitFeePaid: true,
  })
  return {
    ok: true,
    project: nextProject,
    payment: {
      fromId: payerId,
      toId: project.permitReceiverId,
      amount: project.permitFee,
      memo: `${project.name} permit fee paid.`,
    },
    remainingCash: roundMoney(cash - project.permitFee),
    progress: constructionProjectProgress(nextProject),
  }
}

export function workConstructionLabor(
  project: ConstructionProject,
  minutes: number,
): WorkConstructionLaborResult {
  const progress = constructionProjectProgress(project)
  if (progress.complete) {
    return { ok: false, error: 'project_complete', project, laborAppliedMinutes: 0, progress }
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { ok: false, error: 'invalid_labor', project, laborAppliedMinutes: 0, progress }
  }

  const remainingLabor = Math.max(0, project.laborRequiredMinutes - project.laborDoneMinutes)
  const laborAppliedMinutes = Math.min(remainingLabor, Math.floor(minutes))
  if (laborAppliedMinutes <= 0) {
    return { ok: false, error: 'invalid_labor', project, laborAppliedMinutes: 0, progress }
  }

  const nextProject = updateConstructionStatus({
    ...project,
    laborDoneMinutes: project.laborDoneMinutes + laborAppliedMinutes,
  })
  return {
    ok: true,
    project: nextProject,
    laborAppliedMinutes,
    progress: constructionProjectProgress(nextProject),
  }
}

export function constructionProjectProgress(project: ConstructionProject): ConstructionProgress {
  const deposited = resourceInventory(project.deposited)
  const missing = missingConstructionResources(project)
  const resourceUnitsRequired = totalResourceUnits(project.required)
  const resourceUnitsMissing = totalResourceUnits(missing)
  const resourceUnitsDeposited = Math.max(0, resourceUnitsRequired - resourceUnitsMissing)
  const resourcesComplete = resourceUnitsMissing === 0
  const laborComplete = project.laborDoneMinutes >= project.laborRequiredMinutes
  const permitComplete = project.permitFeePaid
  const complete = resourcesComplete && laborComplete && permitComplete
  const resourcePercent = percent(resourceUnitsDeposited, resourceUnitsRequired)
  const laborPercent = percent(project.laborDoneMinutes, project.laborRequiredMinutes)
  const overallPercent = Math.min(100, Math.round((resourcePercent + laborPercent + (permitComplete ? 100 : 0)) / 3))
  return {
    status: updateConstructionStatus({ ...project, deposited }).status,
    missing,
    resourcesComplete,
    laborComplete,
    permitComplete,
    complete,
    resourceUnitsRequired,
    resourceUnitsDeposited,
    resourcePercent,
    laborPercent,
    overallPercent,
  }
}

export function missingConstructionResources(project: ConstructionProject): ResourceInventory {
  return missingResources(project.deposited, project.required)
}

function updateConstructionStatus(project: ConstructionProject): ConstructionProject {
  const resourcesComplete = hasEnoughResources(project.deposited, project.required)
  const laborComplete = project.laborDoneMinutes >= project.laborRequiredMinutes
  const complete = resourcesComplete && laborComplete && project.permitFeePaid
  if (complete) return { ...project, status: 'complete' }
  const started = project.permitFeePaid || project.laborDoneMinutes > 0 || totalResourceUnits(project.deposited) > 0
  return { ...project, status: started ? 'building' : 'planned' }
}

function percent(value: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.round((Math.max(0, value) / total) * 100))
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
}
