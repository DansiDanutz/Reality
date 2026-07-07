import type { AssetKind, PlacedAsset, ShopItem } from './types'
import {
  EMPTY_RESOURCES,
  RESOURCE_KINDS,
  type ResourceInventory,
  freshResources,
  resourceShortfall,
} from './resources'

export type ConstructionRecipeId = 'starter-house' | `business:${string}`

export interface ConstructionRecipe {
  id: ConstructionRecipeId
  name: string
  itemId: string
  resultKind: AssetKind
  required: ResourceInventory
  laborRequiredMinutes: number
  permitFee: number
  incomePerDay: number
}

export interface ConstructionProject {
  id: string
  recipeId: ConstructionRecipeId
  name: string
  itemId: string
  resultKind: AssetKind
  lat: number
  lng: number
  required: ResourceInventory
  deposited: ResourceInventory
  laborRequiredMinutes: number
  laborDoneMinutes: number
  hiredLaborMinutes: number
  workerContracts: ConstructionWorkerContract[]
  permitFee: number
  permitFeePaid: boolean
  incomePerDay: number
  status: 'planned' | 'building' | 'complete'
  placedAt: number
}

export type ConstructionWorkerId = 'helper' | 'builder' | 'crew'
export type WorkerContractSource = 'workers-hall'

export interface ConstructionWorker {
  id: ConstructionWorkerId
  name: string
  ratePerHour: number
  laborMultiplier: number
  maxHours: number
  description: string
}

export interface ConstructionWorkerContract {
  id: string
  source: WorkerContractSource
  workerId: ConstructionWorkerId
  workerName: string
  hiredAt: number
  paidUntil: number
  paidMinutes: number
  workedMinutes: number
  laborMultiplier: number
  ratePerHour: number
  cost: number
  communityCreditMinutes?: number
  communityCreditValue?: number
}

export const STARTER_HOUSE_RECIPE: ConstructionRecipe = {
  id: 'starter-house',
  name: 'Starter House',
  itemId: 'microstudio',
  resultKind: 'home',
  required: { wood: 120, stone: 60, metal: 20, glass: 10 },
  laborRequiredMinutes: 8 * 60,
  permitFee: 500,
  incomePerDay: 0,
}

export const CONSTRUCTION_RECIPES: Record<'starter-house', ConstructionRecipe> = {
  'starter-house': STARTER_HOUSE_RECIPE,
}

export const CONSTRUCTION_WORKERS: ConstructionWorker[] = [
  {
    id: 'helper',
    name: 'Local helper',
    ratePerHour: 16,
    laborMultiplier: 1,
    maxHours: 4,
    description: 'Reliable basic labor from the Workers Hall.',
  },
  {
    id: 'builder',
    name: 'Skilled builder',
    ratePerHour: 28,
    laborMultiplier: 1.5,
    maxHours: 6,
    description: 'Faster craft work once materials are on site.',
  },
  {
    id: 'crew',
    name: 'Small crew',
    ratePerHour: 75,
    laborMultiplier: 4,
    maxHours: 8,
    description: 'A coordinated AI crew for finishing big blocks of work.',
  },
]

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5)
}

export function businessConstructionRecipe(item: Pick<ShopItem, 'id' | 'name' | 'price' | 'incomePerDay'>): ConstructionRecipe {
  const scale = Math.min(12, Math.max(1, item.price / 15_000))
  return {
    id: `business:${item.id}`,
    name: item.name,
    itemId: item.id,
    resultKind: 'business',
    required: {
      wood: roundToFive(45 * scale),
      stone: roundToFive(30 * scale),
      metal: roundToFive(25 * scale),
      glass: roundToFive(10 * scale),
    },
    laborRequiredMinutes: Math.round(Math.min(48, 6 + scale * 2) * 60),
    permitFee: Math.max(500, Math.round(item.price * 0.03)),
    incomePerDay: item.incomePerDay ?? 0,
  }
}

function recipeFor(recipeId: ConstructionRecipeId): ConstructionRecipe {
  const recipe = recipeId === 'starter-house' ? CONSTRUCTION_RECIPES[recipeId] : null
  if (!recipe) throw new Error(`Unknown construction recipe: ${recipeId}`)
  return recipe
}

export function createConstructionProject(
  recipeId: ConstructionRecipeId,
  lat: number,
  lng: number,
  now = Date.now(),
): ConstructionProject {
  const recipe = recipeFor(recipeId)
  return createConstructionProjectFromRecipe(recipe, lat, lng, now)
}

export function createConstructionProjectFromRecipe(
  recipe: ConstructionRecipe,
  lat: number,
  lng: number,
  now = Date.now(),
): ConstructionProject {
  return {
    id: `${recipe.id}-${now}`,
    recipeId: recipe.id,
    name: recipe.name,
    itemId: recipe.itemId,
    resultKind: recipe.resultKind,
    lat,
    lng,
    required: freshResources(recipe.required),
    deposited: freshResources(),
    laborRequiredMinutes: recipe.laborRequiredMinutes,
    laborDoneMinutes: 0,
    hiredLaborMinutes: 0,
    workerContracts: [],
    permitFee: recipe.permitFee,
    permitFeePaid: false,
    incomePerDay: recipe.incomePerDay,
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

export function constructionLaborBreakdown(project: ConstructionProject): {
  playerMinutes: number
  hiredMinutes: number
  totalMinutes: number
  remainingMinutes: number
} {
  const hiredMinutes = Math.max(0, project.hiredLaborMinutes ?? 0)
  const totalMinutes = Math.max(0, project.laborDoneMinutes)
  return {
    playerMinutes: Math.max(0, totalMinutes - hiredMinutes),
    hiredMinutes,
    totalMinutes,
    remainingMinutes: Math.max(0, project.laborRequiredMinutes - totalMinutes),
  }
}

function activePaidMinutes(contract: ConstructionWorkerContract, now: number): number {
  if (now <= contract.hiredAt) return 0
  const elapsedMinutes = (Math.min(now, contract.paidUntil) - contract.hiredAt) / 60_000
  return Math.min(contract.paidMinutes, Math.max(0, Math.floor(elapsedMinutes)))
}

export function advanceConstructionWorkerContracts(
  project: ConstructionProject,
  now = Date.now(),
): { project: ConstructionProject; laborMinutes: number } {
  const contracts = project.workerContracts ?? []
  if (contracts.length === 0) return { project: { ...project, workerContracts: [] }, laborMinutes: 0 }

  let laborDoneMinutes = Math.max(0, project.laborDoneMinutes)
  let hiredLaborMinutes = Math.max(0, project.hiredLaborMinutes ?? 0)
  let laborDelta = 0
  const nextContracts = contracts.map((contract) => {
    const paidWorkedTarget = activePaidMinutes(contract, now)
    const availablePaidMinutes = Math.max(0, paidWorkedTarget - contract.workedMinutes)
    const multiplier = Math.max(0, contract.laborMultiplier)
    const remainingLabor = Math.max(0, project.laborRequiredMinutes - laborDoneMinutes)
    const possibleLabor = availablePaidMinutes * multiplier
    const addedLabor = Math.min(remainingLabor, possibleLabor)
    const paidMinutesUsed = multiplier > 0 ? addedLabor / multiplier : 0
    laborDoneMinutes += addedLabor
    hiredLaborMinutes += addedLabor
    laborDelta += addedLabor
    return {
      ...contract,
      workedMinutes: Math.min(contract.paidMinutes, contract.workedMinutes + paidMinutesUsed),
    }
  })

  return {
    project: {
      ...project,
      laborDoneMinutes: Math.min(project.laborRequiredMinutes, laborDoneMinutes),
      hiredLaborMinutes: Math.min(Math.min(project.laborRequiredMinutes, laborDoneMinutes), hiredLaborMinutes),
      workerContracts: nextContracts,
      status: project.status === 'planned' ? 'building' : project.status,
    },
    laborMinutes: laborDelta,
  }
}

export function constructionShortfall(project: ConstructionProject): ResourceInventory {
  return resourceShortfall(project.deposited, project.required)
}

type ConstructionProgressInput = Pick<ConstructionProject, 'deposited' | 'required' | 'permitFeePaid' | 'laborDoneMinutes' | 'laborRequiredMinutes'>

export function constructionProgress(project: ConstructionProgressInput): {
  resourcesComplete: boolean
  laborComplete: boolean
  permitComplete: boolean
  complete: boolean
  percent: number
} {
  const resourcesComplete = RESOURCE_KINDS.every((kind) => project.deposited[kind] >= project.required[kind])
  const laborComplete = project.laborDoneMinutes >= project.laborRequiredMinutes
  const permitComplete = project.permitFeePaid
  const resourceRatio = RESOURCE_KINDS.reduce((sum, kind) => {
    const required = project.required[kind]
    return sum + (required <= 0 ? 1 : Math.min(1, project.deposited[kind] / required))
  }, 0) / RESOURCE_KINDS.length
  const laborRatio = project.laborRequiredMinutes <= 0 ? 1 : Math.min(1, project.laborDoneMinutes / project.laborRequiredMinutes)
  const permitRatio = permitComplete ? 1 : 0
  return {
    resourcesComplete,
    laborComplete,
    permitComplete,
    complete: resourcesComplete && laborComplete && permitComplete,
    percent: Math.round(((resourceRatio * 0.55) + (laborRatio * 0.35) + (permitRatio * 0.1)) * 100),
  }
}

export function workerById(workerId: ConstructionWorkerId): ConstructionWorker | undefined {
  return CONSTRUCTION_WORKERS.find((worker) => worker.id === workerId)
}

export function constructionWorkerBlocker(project: ConstructionProgressInput): 'materials' | 'permit' | 'labor' | null {
  const progress = constructionProgress(project)
  if (!progress.resourcesComplete) return 'materials'
  if (!progress.permitComplete) return 'permit'
  if (progress.laborComplete) return 'labor'
  return null
}

export function estimateConstructionWorkerHire(
  project: ConstructionProject,
  workerId: ConstructionWorkerId,
  hours = 1,
  communityCreditMinutes = 0,
): { worker: ConstructionWorker; hours: number; cost: number; laborMinutes: number; communityCreditMinutes: number; communityCreditValue: number; blockedBy: ReturnType<typeof constructionWorkerBlocker> } | null {
  const worker = workerById(workerId)
  if (!worker) return null
  const requestedHours = Math.min(Math.max(hours, 1), worker.maxHours)
  const paidMinutes = requestedHours * 60
  const creditMinutes = Math.min(paidMinutes, Math.max(0, Math.floor(communityCreditMinutes)))
  const creditValue = Math.min(worker.ratePerHour * requestedHours, Math.round((worker.ratePerHour / 60) * creditMinutes))
  const cost = Math.max(0, worker.ratePerHour * requestedHours - creditValue)
  const blockedBy = constructionWorkerBlocker(project)
  if (blockedBy) return { worker, hours: requestedHours, cost, laborMinutes: 0, communityCreditMinutes: creditMinutes, communityCreditValue: creditValue, blockedBy }
  const remaining = constructionLaborBreakdown(project).remainingMinutes
  const laborMinutes = Math.min(remaining, Math.round(requestedHours * 60 * worker.laborMultiplier))
  return {
    worker,
    hours: requestedHours,
    cost,
    laborMinutes,
    communityCreditMinutes: creditMinutes,
    communityCreditValue: creditValue,
    blockedBy: null,
  }
}

export function hireConstructionWorker(
  project: ConstructionProject,
  workerId: ConstructionWorkerId,
  money: number,
  hours = 1,
  now = Date.now(),
  communityCreditMinutes = 0,
): { project: ConstructionProject; money: number; hired: boolean; cost: number; laborMinutes: number; contract: ConstructionWorkerContract | null; reason: 'unknown_worker' | 'materials' | 'permit' | 'labor' | 'money' | null } {
  const estimate = estimateConstructionWorkerHire(project, workerId, hours, communityCreditMinutes)
  if (!estimate) return { project, money, hired: false, cost: 0, laborMinutes: 0, contract: null, reason: 'unknown_worker' }
  if (estimate.blockedBy) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: estimate.blockedBy }
  if (money < estimate.cost) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: 'money' }
  if (estimate.laborMinutes <= 0) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: 'labor' }
  const contract: ConstructionWorkerContract = {
    id: `${project.id}:${estimate.worker.id}:${now}`,
    source: 'workers-hall',
    workerId: estimate.worker.id,
    workerName: estimate.worker.name,
    hiredAt: now,
    paidUntil: now + estimate.hours * 3_600_000,
    paidMinutes: estimate.hours * 60,
    workedMinutes: 0,
    laborMultiplier: estimate.worker.laborMultiplier,
    ratePerHour: estimate.worker.ratePerHour,
    cost: estimate.cost,
    communityCreditMinutes: estimate.communityCreditMinutes,
    communityCreditValue: estimate.communityCreditValue,
  }
  return {
    project: {
      ...project,
      workerContracts: [...(project.workerContracts ?? []), contract],
      status: project.status === 'planned' ? 'building' : project.status,
    },
    money: money - estimate.cost,
    hired: true,
    cost: estimate.cost,
    laborMinutes: estimate.laborMinutes,
    contract,
    reason: null,
  }
}

export function completeConstructionProject(project: ConstructionProject): {
  project: ConstructionProject
  asset: PlacedAsset | null
} {
  if (!constructionProgress(project).complete) return { project, asset: null }
  const completeProject = { ...project, status: 'complete' as const }
  const idPrefix = project.recipeId.replace(/[^a-z0-9-]/gi, '-')
  return {
    project: completeProject,
    asset: {
      id: `${idPrefix}-${project.resultKind}-${Date.now()}`,
      itemId: project.itemId,
      kind: project.resultKind,
      name: project.name,
      lat: project.lat,
      lng: project.lng,
      incomePerDay: project.incomePerDay,
      pendingIncome: 0,
      placedAtMinute: 0,
    },
  }
}

export function totalResourceCount(resources: ResourceInventory = EMPTY_RESOURCES): number {
  return RESOURCE_KINDS.reduce((sum, kind) => sum + (resources[kind] ?? 0), 0)
}
