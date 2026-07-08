import type { Needs } from './types'
import type { WorldBusinessKind, WorldCitizenKind, WorldCitizenState } from './worldSim'

export type WorldServicePriorityUrgency = 'none' | 'watch' | 'urgent' | 'emergency'

export type WorldServicePriorityReason =
  | 'critical_hydration'
  | 'low_hydration'
  | 'critical_hunger'
  | 'low_hunger'
  | 'no_home'
  | 'exhausted'
  | 'low_energy'
  | 'critical_health'
  | 'low_health'
  | 'uninsured'

export type WorldServicePriorityBlocker =
  | 'service_purchase_execution_disabled'
  | 'supported_service_required'
  | 'citizen_identity_required'
  | 'participant_kind_required'
  | 'active_citizen_required'
  | 'needs_required'
  | 'service_need_required'
  | 'funds_required'

export interface WorldServicePriorityCitizenInput {
  citizenId?: string | null
  name?: string | null
  kind?: WorldCitizenKind | string | null
  state?: WorldCitizenState | null
  money?: number | null
  needs?: Partial<Needs> | null
  health?: number | null
  hasHome?: boolean | null
  activeInsurance?: boolean | null
}

export interface WorldServicePriorityPolicyInput {
  serviceKind?: WorldBusinessKind | string | null
  servicePrice?: number | null
  availableCapacity?: number | null
  citizens?: readonly WorldServicePriorityCitizenInput[] | null
}

export interface WorldServicePriorityCandidate {
  citizenId: string
  name: string
  displayName: string
  kind: WorldCitizenKind
  simulated: boolean
  serviceKind: WorldBusinessKind
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
  money: number
  servicePrice: number
  canPay: boolean
  selectedForService: boolean
  blockers: readonly WorldServicePriorityBlocker[]
}

export interface RejectedWorldServicePriorityCandidate {
  citizenId: string | null
  name: string | null
  kind: string | null
  blockers: readonly WorldServicePriorityBlocker[]
}

export interface WorldServicePriorityPolicyAssessment {
  sourceOfTruth: 'reality_server_simulation'
  purchaseExecutionEnabled: false
  passiveRevenueEnabled: false
  serviceKind: WorldBusinessKind | null
  servicePrice: number
  availableCapacity: number
  candidateCount: number
  selectedCount: number
  deferredCount: number
  blockedCount: number
  rejectedCount: number
  selectedCandidates: readonly WorldServicePriorityCandidate[]
  deferredCandidates: readonly WorldServicePriorityCandidate[]
  blockedCandidates: readonly WorldServicePriorityCandidate[]
  rejectedCandidates: readonly RejectedWorldServicePriorityCandidate[]
  candidates: readonly WorldServicePriorityCandidate[]
  purchaseDrafts: readonly []
  blockers: readonly WorldServicePriorityBlocker[]
}

const WORLD_SERVICE_KINDS: readonly WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']

const BASE_BLOCKERS: readonly WorldServicePriorityBlocker[] = ['service_purchase_execution_disabled']

export function assessWorldServicePriorityPolicy(
  input: WorldServicePriorityPolicyInput = {},
): WorldServicePriorityPolicyAssessment {
  const serviceKind = normalizeServiceKind(input.serviceKind)
  const servicePrice = normalizeMoney(input.servicePrice)
  const availableCapacity = normalizeCapacity(input.availableCapacity)
  const citizens = input.citizens ?? []
  const globalBlockers = uniqueBlockers([
    ...BASE_BLOCKERS,
    ...(serviceKind ? [] : ['supported_service_required' as const]),
  ])

  if (!serviceKind) {
    return {
      sourceOfTruth: 'reality_server_simulation',
      purchaseExecutionEnabled: false,
      passiveRevenueEnabled: false,
      serviceKind: null,
      servicePrice,
      availableCapacity,
      candidateCount: 0,
      selectedCount: 0,
      deferredCount: 0,
      blockedCount: 0,
      rejectedCount: citizens.length,
      selectedCandidates: [],
      deferredCandidates: [],
      blockedCandidates: [],
      rejectedCandidates: citizens.map((citizen) => rejectedCitizen(citizen, ['supported_service_required'])),
      candidates: [],
      purchaseDrafts: [],
      blockers: globalBlockers,
    }
  }

  const evaluated = citizens.map((citizen) => evaluateCitizenForService(citizen, serviceKind, servicePrice))
  const rejectedCandidates = evaluated
    .filter((entry): entry is { rejected: RejectedWorldServicePriorityCandidate } => 'rejected' in entry)
    .map((entry) => entry.rejected)
  const candidateBases = evaluated
    .filter((entry): entry is { candidate: Omit<WorldServicePriorityCandidate, 'selectedForService'> } => 'candidate' in entry)
    .map((entry) => entry.candidate)
  const eligible = candidateBases
    .filter((candidate) => candidate.blockers.length === 0)
    .sort(compareServiceCandidates)
  const selectedIds = new Set(eligible.slice(0, availableCapacity).map((candidate) => candidate.citizenId))
  const candidates = candidateBases
    .map((candidate) => ({
      ...candidate,
      selectedForService: selectedIds.has(candidate.citizenId),
    }))
    .sort(compareServiceCandidates)

  const selectedCandidates = candidates.filter((candidate) => candidate.selectedForService)
  const deferredCandidates = candidates.filter((candidate) =>
    !candidate.selectedForService && candidate.blockers.length === 0
  )
  const blockedCandidates = candidates.filter((candidate) => candidate.blockers.length > 0)

  return {
    sourceOfTruth: 'reality_server_simulation',
    purchaseExecutionEnabled: false,
    passiveRevenueEnabled: false,
    serviceKind,
    servicePrice,
    availableCapacity,
    candidateCount: candidates.length,
    selectedCount: selectedCandidates.length,
    deferredCount: deferredCandidates.length,
    blockedCount: blockedCandidates.length,
    rejectedCount: rejectedCandidates.length,
    selectedCandidates,
    deferredCandidates,
    blockedCandidates,
    rejectedCandidates,
    candidates,
    purchaseDrafts: [],
    blockers: globalBlockers,
  }
}

function evaluateCitizenForService(
  input: WorldServicePriorityCitizenInput,
  serviceKind: WorldBusinessKind,
  servicePrice: number,
):
  | { candidate: Omit<WorldServicePriorityCandidate, 'selectedForService'> }
  | { rejected: RejectedWorldServicePriorityCandidate } {
  const citizenId = input.citizenId?.trim() || null
  const kind = normalizeCitizenKind(input.kind)
  const name = normalizeName(input.name, citizenId)
  const money = normalizeMoney(input.money)
  const health = normalizePercent(input.health, 100)
  const needs = normalizeNeeds(input.needs)
  const blockers: WorldServicePriorityBlocker[] = []

  if (!citizenId) blockers.push('citizen_identity_required')
  if (!kind) blockers.push('participant_kind_required')

  if (!citizenId || !kind) {
    return {
      rejected: {
        citizenId,
        name: input.name?.trim() || null,
        kind: typeof input.kind === 'string' ? input.kind.trim() || null : null,
        blockers,
      },
    }
  }

  if (input.state?.kind !== 'active') blockers.push('active_citizen_required')
  if (!needs && serviceKind !== 'insurance') blockers.push('needs_required')

  const serviceNeed = needs
    ? serviceNeedForCitizen(serviceKind, {
      needs,
      health,
      hasHome: input.hasHome === true,
      activeInsurance: input.activeInsurance === true,
    })
    : serviceNeedWithoutNeeds(serviceKind, input.activeInsurance === true)

  if (serviceNeed.urgency === 'none') blockers.push('service_need_required')
  const canPay = money >= servicePrice
  if (!canPay) blockers.push('funds_required')

  return {
    candidate: {
      citizenId,
      name,
      displayName: kind === 'sim' ? `${name} (Sim)` : name,
      kind,
      simulated: kind === 'sim',
      serviceKind,
      urgency: serviceNeed.urgency,
      sortScore: serviceNeed.sortScore,
      reasons: serviceNeed.reasons,
      money,
      servicePrice,
      canPay,
      blockers: uniqueBlockers(blockers),
    },
  }
}

function serviceNeedForCitizen(
  serviceKind: WorldBusinessKind,
  input: {
    needs: Needs
    health: number
    hasHome: boolean
    activeInsurance: boolean
  },
): {
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
} {
  switch (serviceKind) {
    case 'water':
      return thresholdNeed(input.needs.hydration, 'critical_hydration', 'low_hydration')
    case 'food':
      return thresholdNeed(input.needs.hunger, 'critical_hunger', 'low_hunger')
    case 'housing':
      return housingNeed(input.needs.energy, input.hasHome)
    case 'clinic':
      return thresholdNeed(input.health, 'critical_health', 'low_health', 80, 50, 20)
    case 'insurance':
      return insuranceNeed(input.activeInsurance)
  }
}

function serviceNeedWithoutNeeds(
  serviceKind: WorldBusinessKind,
  activeInsurance: boolean,
): {
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
} {
  if (serviceKind === 'insurance') return insuranceNeed(activeInsurance)
  return { urgency: 'none', sortScore: 0, reasons: [] }
}

function thresholdNeed(
  value: number,
  criticalReason: WorldServicePriorityReason,
  lowReason: WorldServicePriorityReason,
  watchBelow = 70,
  urgentAt = 35,
  emergencyAt = 10,
): {
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
} {
  if (value <= emergencyAt) {
    return {
      urgency: 'emergency',
      sortScore: roundPriorityScore(120 + (emergencyAt - value)),
      reasons: [criticalReason],
    }
  }
  if (value <= urgentAt) {
    return {
      urgency: 'urgent',
      sortScore: roundPriorityScore(80 + (urgentAt - value)),
      reasons: [lowReason],
    }
  }
  if (value < watchBelow) {
    return {
      urgency: 'watch',
      sortScore: roundPriorityScore(40 + ((watchBelow - value) / 2)),
      reasons: [lowReason],
    }
  }
  return { urgency: 'none', sortScore: 0, reasons: [] }
}

function housingNeed(
  energy: number,
  hasHome: boolean,
): {
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
} {
  const reasons: WorldServicePriorityReason[] = []
  if (!hasHome) reasons.push('no_home')
  if (energy <= 10) reasons.push('exhausted')
  else if (energy < 60) reasons.push('low_energy')

  if (energy <= 10) {
    return { urgency: 'emergency', sortScore: roundPriorityScore(125 + (hasHome ? 0 : 10)), reasons }
  }
  if (!hasHome || energy <= 35) {
    return {
      urgency: 'urgent',
      sortScore: roundPriorityScore((hasHome ? 75 : 95) + Math.max(0, 35 - energy)),
      reasons,
    }
  }
  if (energy < 60) {
    return { urgency: 'watch', sortScore: roundPriorityScore(45 + ((60 - energy) / 2)), reasons }
  }
  return { urgency: 'none', sortScore: 0, reasons: [] }
}

function insuranceNeed(activeInsurance: boolean): {
  urgency: WorldServicePriorityUrgency
  sortScore: number
  reasons: readonly WorldServicePriorityReason[]
} {
  if (activeInsurance) return { urgency: 'none', sortScore: 0, reasons: [] }
  return { urgency: 'watch', sortScore: 25, reasons: ['uninsured'] }
}

function rejectedCitizen(
  citizen: WorldServicePriorityCitizenInput,
  blockers: readonly WorldServicePriorityBlocker[],
): RejectedWorldServicePriorityCandidate {
  return {
    citizenId: citizen.citizenId?.trim() || null,
    name: citizen.name?.trim() || null,
    kind: typeof citizen.kind === 'string' ? citizen.kind.trim() || null : null,
    blockers,
  }
}

function normalizeServiceKind(kind: WorldServicePriorityPolicyInput['serviceKind']): WorldBusinessKind | null {
  if (typeof kind !== 'string') return null
  const normalized = kind.trim()
  return WORLD_SERVICE_KINDS.includes(normalized as WorldBusinessKind) ? normalized as WorldBusinessKind : null
}

function normalizeCitizenKind(kind: WorldServicePriorityCitizenInput['kind']): WorldCitizenKind | null {
  if (kind === 'sim' || kind === 'real') return kind
  return null
}

function normalizeNeeds(needs: Partial<Needs> | null | undefined): Needs | null {
  if (!needs) return null
  const hunger = normalizePercent(needs.hunger, Number.NaN)
  const hydration = normalizePercent(needs.hydration, Number.NaN)
  const energy = normalizePercent(needs.energy, Number.NaN)
  const hygiene = normalizePercent(needs.hygiene, Number.NaN)
  const fun = normalizePercent(needs.fun, Number.NaN)
  if ([hunger, hydration, energy, hygiene, fun].some(Number.isNaN)) return null
  return { hunger, hydration, energy, hygiene, fun }
}

function normalizeName(name: string | null | undefined, citizenId: string | null): string {
  return name?.trim() || citizenId || 'Citizen'
}

function normalizeMoney(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return roundPriorityScore(value!)
}

function normalizePercent(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(0, value!))
}

function normalizeCapacity(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! <= 0) return 0
  return Math.floor(value!)
}

function compareServiceCandidates(
  a: Pick<WorldServicePriorityCandidate, 'sortScore' | 'urgency' | 'citizenId'>,
  b: Pick<WorldServicePriorityCandidate, 'sortScore' | 'urgency' | 'citizenId'>,
): number {
  return b.sortScore - a.sortScore ||
    urgencyRank(b.urgency) - urgencyRank(a.urgency) ||
    a.citizenId.localeCompare(b.citizenId)
}

function urgencyRank(urgency: WorldServicePriorityUrgency): number {
  switch (urgency) {
    case 'emergency':
      return 4
    case 'urgent':
      return 3
    case 'watch':
      return 2
    case 'none':
      return 0
  }
}

function roundPriorityScore(value: number): number {
  return Math.round(value * 100) / 100
}

function uniqueBlockers(blockers: readonly WorldServicePriorityBlocker[]): readonly WorldServicePriorityBlocker[] {
  return [...new Set(blockers)]
}
