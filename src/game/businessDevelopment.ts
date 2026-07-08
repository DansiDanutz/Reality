import { upgradeOutcome, type UpgradeOutcome } from './businessUpgrades'
import {
  type ConstructionWorker,
  type ConstructionWorkerId,
  type WorkerContractSource,
  workerById,
} from './construction'
import {
  RESOURCE_KINDS,
  type ResourceInventory,
  freshResources,
  resourceShortfall,
} from './resources'
import type { PlacedAsset } from './types'

export interface BusinessDevelopmentProject {
  id: string
  businessId: string
  businessName: string
  itemId: string
  levelFrom: number
  levelTo: number
  incomeBefore: number
  incomeAfter: number
  incomeDelta: number
  required: ResourceInventory
  deposited: ResourceInventory
  laborRequiredMinutes: number
  laborDoneMinutes: number
  hiredLaborMinutes: number
  workerContracts: BusinessDevelopmentWorkerContract[]
  budgetCost: number
  budgetPaid: boolean
  startedAt: number
}

export interface BusinessDevelopmentWorkerContract {
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

export interface BusinessDevelopmentPlan {
  outcome: UpgradeOutcome
  required: ResourceInventory
  laborRequiredMinutes: number
  budgetCost: number
}

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5)
}

export function businessDevelopmentPlanFor(asset: PlacedAsset): BusinessDevelopmentPlan | null {
  if (asset.kind !== 'business') return null
  const level = asset.level ?? 1
  const baseIncome = asset.incomePerDay / level
  const outcome = upgradeOutcome(baseIncome, level)
  if (!outcome) return null
  const scale = Math.min(10, Math.max(1, outcome.cost / 1_000))
  return {
    outcome,
    required: {
      wood: roundToFive(10 + level * 4 + scale * 4),
      stone: roundToFive(6 + level * 3 + scale * 3),
      metal: roundToFive(12 + level * 5 + scale * 5),
      glass: roundToFive(6 + level * 2 + scale * 3),
    },
    laborRequiredMinutes: roundToFive(90 + level * 45 + scale * 15),
    budgetCost: outcome.cost,
  }
}

export function createBusinessDevelopmentProject(asset: PlacedAsset, now = Date.now()): BusinessDevelopmentProject | null {
  const plan = businessDevelopmentPlanFor(asset)
  if (!plan) return null
  const level = asset.level ?? 1
  return {
    id: `${asset.id}:develop:${level}->${plan.outcome.newLevel}:${now}`,
    businessId: asset.id,
    businessName: asset.name,
    itemId: asset.itemId,
    levelFrom: level,
    levelTo: plan.outcome.newLevel,
    incomeBefore: asset.incomePerDay,
    incomeAfter: plan.outcome.newIncome,
    incomeDelta: plan.outcome.incomeDelta,
    required: freshResources(plan.required),
    deposited: freshResources(),
    laborRequiredMinutes: plan.laborRequiredMinutes,
    laborDoneMinutes: 0,
    hiredLaborMinutes: 0,
    workerContracts: [],
    budgetCost: plan.budgetCost,
    budgetPaid: false,
    startedAt: now,
  }
}

function normalizeBusinessDevelopmentWorkerContracts(
  contracts: Partial<BusinessDevelopmentWorkerContract>[] | undefined,
  projectId: string,
): BusinessDevelopmentWorkerContract[] {
  if (!Array.isArray(contracts)) return []
  return contracts.flatMap((contract, index) => {
    const worker = workerById(contract.workerId as ConstructionWorkerId)
    if (!worker) return []
    const paidMinutes = Math.max(0, Math.floor(Number(contract.paidMinutes ?? 0)))
    if (paidMinutes <= 0) return []
    return [{
      id: String(contract.id ?? `${projectId}:${worker.id}:${index}`),
      source: 'workers-hall',
      workerId: worker.id,
      workerName: String(contract.workerName ?? worker.name),
      hiredAt: Number.isFinite(contract.hiredAt) ? Number(contract.hiredAt) : Date.now(),
      paidUntil: Number.isFinite(contract.paidUntil) ? Number(contract.paidUntil) : Date.now(),
      paidMinutes,
      workedMinutes: Math.min(paidMinutes, Math.max(0, Number(contract.workedMinutes ?? 0))),
      laborMultiplier: Math.max(0, Number(contract.laborMultiplier ?? worker.laborMultiplier)),
      ratePerHour: Math.max(0, Number(contract.ratePerHour ?? worker.ratePerHour)),
      cost: Math.max(0, Number(contract.cost ?? worker.ratePerHour * (paidMinutes / 60))),
      communityCreditMinutes: Math.max(0, Number(contract.communityCreditMinutes ?? 0)),
      communityCreditValue: Math.max(0, Number(contract.communityCreditValue ?? 0)),
    }]
  })
}

export function normalizeBusinessDevelopmentProject(project: Partial<BusinessDevelopmentProject>): BusinessDevelopmentProject | null {
  if (!project.id || !project.businessId || !project.businessName || !project.itemId) return null
  const levelFrom = Math.max(1, Math.floor(project.levelFrom ?? 1))
  const levelTo = Math.max(levelFrom + 1, Math.floor(project.levelTo ?? levelFrom + 1))
  const laborRequiredMinutes = Math.max(5, Math.floor(project.laborRequiredMinutes ?? 60))
  return {
    id: String(project.id),
    businessId: String(project.businessId),
    businessName: String(project.businessName),
    itemId: String(project.itemId),
    levelFrom,
    levelTo,
    incomeBefore: Math.max(0, Number(project.incomeBefore ?? 0)),
    incomeAfter: Math.max(0, Number(project.incomeAfter ?? 0)),
    incomeDelta: Math.max(0, Number(project.incomeDelta ?? 0)),
    required: freshResources(project.required),
    deposited: freshResources(project.deposited),
    laborRequiredMinutes,
    laborDoneMinutes: Math.min(laborRequiredMinutes, Math.max(0, Math.floor(project.laborDoneMinutes ?? 0))),
    hiredLaborMinutes: Math.max(0, Math.floor(project.hiredLaborMinutes ?? 0)),
    workerContracts: normalizeBusinessDevelopmentWorkerContracts(project.workerContracts, String(project.id)),
    budgetCost: Math.max(0, Math.floor(project.budgetCost ?? 0)),
    budgetPaid: Boolean(project.budgetPaid),
    startedAt: Number.isFinite(project.startedAt) ? Number(project.startedAt) : Date.now(),
  }
}

export function businessDevelopmentShortfall(project: BusinessDevelopmentProject): ResourceInventory {
  return resourceShortfall(project.deposited, project.required)
}

type BusinessDevelopmentProgressInput = Pick<BusinessDevelopmentProject, 'deposited' | 'required' | 'budgetPaid' | 'laborDoneMinutes' | 'laborRequiredMinutes'>

export function businessDevelopmentProgress(project: BusinessDevelopmentProgressInput): {
  resourcesComplete: boolean
  budgetComplete: boolean
  laborComplete: boolean
  complete: boolean
  percent: number
} {
  const resourcesComplete = RESOURCE_KINDS.every((kind) => project.deposited[kind] >= project.required[kind])
  const budgetComplete = project.budgetPaid
  const laborComplete = project.laborDoneMinutes >= project.laborRequiredMinutes
  const resourceRatio = RESOURCE_KINDS.reduce((sum, kind) => {
    const required = project.required[kind]
    return sum + (required <= 0 ? 1 : Math.min(1, project.deposited[kind] / required))
  }, 0) / RESOURCE_KINDS.length
  const laborRatio = project.laborRequiredMinutes <= 0 ? 1 : Math.min(1, project.laborDoneMinutes / project.laborRequiredMinutes)
  const budgetRatio = budgetComplete ? 1 : 0
  return {
    resourcesComplete,
    budgetComplete,
    laborComplete,
    complete: resourcesComplete && budgetComplete && laborComplete,
    percent: Math.round((resourceRatio * 0.45 + laborRatio * 0.35 + budgetRatio * 0.2) * 100),
  }
}

export function depositBusinessDevelopmentResources(
  project: BusinessDevelopmentProject,
  inventory: ResourceInventory,
): { project: BusinessDevelopmentProject; inventory: ResourceInventory; deposited: ResourceInventory } {
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
    project: { ...project, deposited: nextDeposited },
    inventory: nextInventory,
    deposited,
  }
}

export function payBusinessDevelopmentBudget(
  project: BusinessDevelopmentProject,
  money: number,
): { project: BusinessDevelopmentProject; money: number; paid: boolean } {
  if (project.budgetPaid) return { project, money, paid: false }
  if (money < project.budgetCost) return { project, money, paid: false }
  return {
    project: { ...project, budgetPaid: true },
    money: money - project.budgetCost,
    paid: true,
  }
}

export function addBusinessDevelopmentLabor(project: BusinessDevelopmentProject, minutes: number): BusinessDevelopmentProject {
  const laborDoneMinutes = Math.min(project.laborRequiredMinutes, project.laborDoneMinutes + Math.max(0, Math.floor(minutes)))
  return { ...project, laborDoneMinutes }
}

export function businessDevelopmentLaborBreakdown(project: BusinessDevelopmentProject): {
  playerMinutes: number
  hiredMinutes: number
  totalMinutes: number
  remainingMinutes: number
} {
  const hiredMinutes = Math.max(0, project.hiredLaborMinutes)
  const totalMinutes = Math.max(0, project.laborDoneMinutes)
  return {
    playerMinutes: Math.max(0, totalMinutes - hiredMinutes),
    hiredMinutes,
    totalMinutes,
    remainingMinutes: Math.max(0, project.laborRequiredMinutes - totalMinutes),
  }
}

export function businessDevelopmentWorkerBlocker(project: BusinessDevelopmentProgressInput): 'materials' | 'budget' | 'labor' | null {
  const progress = businessDevelopmentProgress(project)
  if (!progress.resourcesComplete) return 'materials'
  if (!progress.budgetComplete) return 'budget'
  if (progress.laborComplete) return 'labor'
  return null
}

export function estimateBusinessDevelopmentWorkerHire(
  project: BusinessDevelopmentProject,
  workerId: ConstructionWorkerId,
  hours = 1,
  communityCreditMinutes = 0,
): { worker: ConstructionWorker; hours: number; cost: number; laborMinutes: number; communityCreditMinutes: number; communityCreditValue: number; blockedBy: ReturnType<typeof businessDevelopmentWorkerBlocker> } | null {
  const worker = workerById(workerId)
  if (!worker) return null
  const requestedHours = Math.min(Math.max(hours, 1), worker.maxHours)
  const paidMinutes = requestedHours * 60
  const creditMinutes = Math.min(paidMinutes, Math.max(0, Math.floor(communityCreditMinutes)))
  const creditValue = Math.min(worker.ratePerHour * requestedHours, Math.round((worker.ratePerHour / 60) * creditMinutes))
  const cost = Math.max(0, worker.ratePerHour * requestedHours - creditValue)
  const blockedBy = businessDevelopmentWorkerBlocker(project)
  if (blockedBy) return { worker, hours: requestedHours, cost, laborMinutes: 0, communityCreditMinutes: creditMinutes, communityCreditValue: creditValue, blockedBy }
  const remaining = businessDevelopmentLaborBreakdown(project).remainingMinutes
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

function activePaidMinutes(contract: BusinessDevelopmentWorkerContract, now: number): number {
  if (now <= contract.hiredAt) return 0
  const elapsedMinutes = (Math.min(now, contract.paidUntil) - contract.hiredAt) / 60_000
  return Math.min(contract.paidMinutes, Math.max(0, Math.floor(elapsedMinutes)))
}

export function advanceBusinessDevelopmentWorkerContracts(
  project: BusinessDevelopmentProject,
  now = Date.now(),
): { project: BusinessDevelopmentProject; laborMinutes: number } {
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
    },
    laborMinutes: laborDelta,
  }
}

export function hireBusinessDevelopmentWorker(
  project: BusinessDevelopmentProject,
  workerId: ConstructionWorkerId,
  money: number,
  hours = 1,
  now = Date.now(),
  communityCreditMinutes = 0,
): { project: BusinessDevelopmentProject; money: number; hired: boolean; cost: number; laborMinutes: number; contract: BusinessDevelopmentWorkerContract | null; reason: 'unknown_worker' | 'materials' | 'budget' | 'labor' | 'money' | null } {
  const estimate = estimateBusinessDevelopmentWorkerHire(project, workerId, hours, communityCreditMinutes)
  if (!estimate) return { project, money, hired: false, cost: 0, laborMinutes: 0, contract: null, reason: 'unknown_worker' }
  if (estimate.blockedBy) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: estimate.blockedBy }
  if (money < estimate.cost) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: 'money' }
  if (estimate.laborMinutes <= 0) return { project, money, hired: false, cost: estimate.cost, laborMinutes: 0, contract: null, reason: 'labor' }
  const contract: BusinessDevelopmentWorkerContract = {
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
    },
    money: money - estimate.cost,
    hired: true,
    cost: estimate.cost,
    laborMinutes: estimate.laborMinutes,
    contract,
    reason: null,
  }
}

export function completeBusinessDevelopmentProject(
  project: BusinessDevelopmentProject,
  asset: PlacedAsset | null | undefined,
): PlacedAsset | null {
  if (!asset || asset.id !== project.businessId || asset.kind !== 'business') return null
  if ((asset.level ?? 1) >= project.levelTo && asset.incomePerDay >= project.incomeAfter) return asset
  if (!businessDevelopmentProgress(project).complete) return null
  return {
    ...asset,
    level: project.levelTo,
    incomePerDay: project.incomeAfter,
  }
}
