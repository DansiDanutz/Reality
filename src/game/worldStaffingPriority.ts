import type { WorldBusinessKind, WorldCitizenKind, WorldCitizenState } from './worldSim'

export type WorldStaffingPriorityReason =
  | 'essential_service'
  | 'no_active_staff'
  | 'multiple_open_positions'
  | 'owner_unavailable'
  | 'local_demand_waiting'
  | 'quality_degraded'

export type WorldStaffingPolicyBlocker =
  | 'staffing_execution_disabled'
  | 'business_identity_required'
  | 'supported_business_required'
  | 'open_position_required'
  | 'worker_identity_required'
  | 'participant_kind_required'
  | 'active_worker_required'
  | 'worker_already_assigned'
  | 'real_worker_acceptance_required'
  | 'founder_authority_required'

export interface WorldStaffingBusinessInput {
  businessId?: string | null
  name?: string | null
  kind?: WorldBusinessKind | string | null
  activeStaff?: number | null
  targetStaff?: number | null
  ownerUnavailable?: boolean | null
  localDemand?: number | null
  quality?: number | null
}

export interface WorldStaffingWorkerInput {
  citizenId?: string | null
  name?: string | null
  kind?: WorldCitizenKind | string | null
  state?: WorldCitizenState | null
  currentBusinessId?: string | null
}

export interface WorldStaffingPriorityPolicyInput {
  founderCanManage?: boolean | null
  maxAssignments?: number | null
  businesses?: readonly WorldStaffingBusinessInput[] | null
  workers?: readonly WorldStaffingWorkerInput[] | null
}

export interface WorldStaffingBusinessNeed {
  businessId: string
  name: string
  kind: WorldBusinessKind
  activeStaff: number
  targetStaff: number
  openPositions: number
  ownerUnavailable: boolean
  localDemand: number
  quality: number
  priorityScore: number
  reasons: readonly WorldStaffingPriorityReason[]
  blockers: readonly WorldStaffingPolicyBlocker[]
}

export interface RejectedWorldStaffingBusiness {
  businessId: string | null
  name: string | null
  kind: string | null
  blockers: readonly WorldStaffingPolicyBlocker[]
}

export interface WorldStaffingWorkerCandidate {
  citizenId: string
  name: string
  displayName: string
  kind: WorldCitizenKind
  simulated: boolean
  currentBusinessId: string | null
  availableForSimAssignment: boolean
  requiresAcceptance: boolean
  readinessScore: number
  blockers: readonly WorldStaffingPolicyBlocker[]
}

export interface RejectedWorldStaffingWorker {
  citizenId: string | null
  name: string | null
  kind: string | null
  blockers: readonly WorldStaffingPolicyBlocker[]
}

export interface WorldStaffingAssignmentDraft {
  kind: 'world_staffing_assignment'
  executionEnabled: false
  businessId: string
  businessKind: WorldBusinessKind
  workerCitizenId: string
  workerKind: WorldCitizenKind
  requiresAcceptance: boolean
  blockers: readonly WorldStaffingPolicyBlocker[]
}

export interface WorldStaffingPriorityPolicyAssessment {
  sourceOfTruth: 'reality_server_simulation'
  staffingExecutionEnabled: false
  wagePaymentEnabled: false
  founderCanManage: boolean
  maxAssignments: number
  businessNeedCount: number
  rejectedBusinessCount: number
  workerCandidateCount: number
  rejectedWorkerCount: number
  simReadyWorkerCount: number
  realWorkerAcceptanceCount: number
  assignmentDraftCount: number
  businessNeeds: readonly WorldStaffingBusinessNeed[]
  rejectedBusinesses: readonly RejectedWorldStaffingBusiness[]
  workerCandidates: readonly WorldStaffingWorkerCandidate[]
  blockedWorkers: readonly WorldStaffingWorkerCandidate[]
  rejectedWorkers: readonly RejectedWorldStaffingWorker[]
  assignmentDrafts: readonly WorldStaffingAssignmentDraft[]
  blockers: readonly WorldStaffingPolicyBlocker[]
}

const BUSINESS_KINDS: readonly WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']
const ESSENTIAL_BUSINESS_KINDS = new Set<WorldBusinessKind>(['water', 'food', 'housing', 'clinic'])
const BASE_BLOCKERS: readonly WorldStaffingPolicyBlocker[] = ['staffing_execution_disabled']

export function assessWorldStaffingPriorityPolicy(
  input: WorldStaffingPriorityPolicyInput = {},
): WorldStaffingPriorityPolicyAssessment {
  const founderCanManage = input.founderCanManage === true
  const maxAssignments = normalizeMaxAssignments(input.maxAssignments)
  const businessResults = (input.businesses ?? []).map(evaluateBusinessNeed)
  const rejectedBusinesses = businessResults
    .filter((entry): entry is { rejected: RejectedWorldStaffingBusiness } => 'rejected' in entry)
    .map((entry) => entry.rejected)
  const businessNeeds = businessResults
    .filter((entry): entry is { need: WorldStaffingBusinessNeed } => 'need' in entry)
    .map((entry) => entry.need)
    .sort(compareBusinessNeeds)

  const workerResults = (input.workers ?? []).map((worker) => evaluateWorkerCandidate(worker, founderCanManage))
  const rejectedWorkers = workerResults
    .filter((entry): entry is { rejected: RejectedWorldStaffingWorker } => 'rejected' in entry)
    .map((entry) => entry.rejected)
  const workerCandidates = workerResults
    .filter((entry): entry is { candidate: WorldStaffingWorkerCandidate } => 'candidate' in entry)
    .map((entry) => entry.candidate)
    .sort(compareWorkerCandidates)
  const readyWorkers = workerCandidates.filter((candidate) => candidate.availableForSimAssignment)
  const assignmentDrafts = staffingAssignmentDrafts(businessNeeds, readyWorkers, maxAssignments)
  const blockers = uniqueBlockers([
    ...BASE_BLOCKERS,
    ...(founderCanManage ? [] : ['founder_authority_required' as const]),
  ])

  return {
    sourceOfTruth: 'reality_server_simulation',
    staffingExecutionEnabled: false,
    wagePaymentEnabled: false,
    founderCanManage,
    maxAssignments,
    businessNeedCount: businessNeeds.length,
    rejectedBusinessCount: rejectedBusinesses.length,
    workerCandidateCount: workerCandidates.length,
    rejectedWorkerCount: rejectedWorkers.length,
    simReadyWorkerCount: readyWorkers.length,
    realWorkerAcceptanceCount: workerCandidates.filter((candidate) => candidate.requiresAcceptance).length,
    assignmentDraftCount: assignmentDrafts.length,
    businessNeeds,
    rejectedBusinesses,
    workerCandidates,
    blockedWorkers: workerCandidates.filter((candidate) => candidate.blockers.length > 0),
    rejectedWorkers,
    assignmentDrafts,
    blockers,
  }
}

function evaluateBusinessNeed(
  input: WorldStaffingBusinessInput,
): { need: WorldStaffingBusinessNeed } | { rejected: RejectedWorldStaffingBusiness } {
  const businessId = input.businessId?.trim() || null
  const kind = normalizeBusinessKind(input.kind)
  const blockers: WorldStaffingPolicyBlocker[] = []

  if (!businessId) blockers.push('business_identity_required')
  if (!kind) blockers.push('supported_business_required')

  if (!businessId || !kind) {
    return {
      rejected: {
        businessId,
        name: input.name?.trim() || null,
        kind: typeof input.kind === 'string' ? input.kind.trim() || null : null,
        blockers,
      },
    }
  }

  const activeStaff = normalizeCount(input.activeStaff)
  const targetStaff = Math.max(0, normalizeCount(input.targetStaff))
  const openPositions = Math.max(0, targetStaff - activeStaff)
  if (openPositions <= 0) blockers.push('open_position_required')

  const ownerUnavailable = input.ownerUnavailable === true
  const localDemand = normalizeCount(input.localDemand)
  const quality = normalizeQuality(input.quality)
  const reasons = staffingReasons({ kind, activeStaff, openPositions, ownerUnavailable, localDemand, quality })

  return {
    need: {
      businessId,
      name: input.name?.trim() || businessId,
      kind,
      activeStaff,
      targetStaff,
      openPositions,
      ownerUnavailable,
      localDemand,
      quality,
      priorityScore: businessPriorityScore({ kind, activeStaff, openPositions, ownerUnavailable, localDemand, quality }),
      reasons,
      blockers: uniqueBlockers(blockers),
    },
  }
}

function evaluateWorkerCandidate(
  input: WorldStaffingWorkerInput,
  founderCanManage: boolean,
): { candidate: WorldStaffingWorkerCandidate } | { rejected: RejectedWorldStaffingWorker } {
  const citizenId = input.citizenId?.trim() || null
  const kind = normalizeWorkerKind(input.kind)
  const blockers: WorldStaffingPolicyBlocker[] = []

  if (!citizenId) blockers.push('worker_identity_required')
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

  const currentBusinessId = input.currentBusinessId?.trim() || null
  if (input.state?.kind !== 'active') blockers.push('active_worker_required')
  if (currentBusinessId) blockers.push('worker_already_assigned')
  if (kind === 'real') blockers.push('real_worker_acceptance_required')
  if (!founderCanManage && kind === 'sim' && !currentBusinessId) blockers.push('founder_authority_required')

  const unique = uniqueBlockers(blockers)
  return {
    candidate: {
      citizenId,
      name: input.name?.trim() || citizenId,
      displayName: kind === 'sim' ? `${input.name?.trim() || citizenId} (Sim)` : input.name?.trim() || citizenId,
      kind,
      simulated: kind === 'sim',
      currentBusinessId,
      availableForSimAssignment: kind === 'sim' && unique.length === 0,
      requiresAcceptance: kind === 'real',
      readinessScore: workerReadinessScore({ kind, blockers: unique }),
      blockers: unique,
    },
  }
}

function staffingAssignmentDrafts(
  businessNeeds: readonly WorldStaffingBusinessNeed[],
  readyWorkers: readonly WorldStaffingWorkerCandidate[],
  maxAssignments: number,
): WorldStaffingAssignmentDraft[] {
  const drafts: WorldStaffingAssignmentDraft[] = []
  const workerQueue = [...readyWorkers]
  for (const business of businessNeeds) {
    if (business.blockers.length > 0) continue
    for (let slot = 0; slot < business.openPositions; slot += 1) {
      if (drafts.length >= maxAssignments) return drafts
      const worker = workerQueue.shift()
      if (!worker) return drafts
      drafts.push({
        kind: 'world_staffing_assignment',
        executionEnabled: false,
        businessId: business.businessId,
        businessKind: business.kind,
        workerCitizenId: worker.citizenId,
        workerKind: worker.kind,
        requiresAcceptance: false,
        blockers: BASE_BLOCKERS,
      })
    }
  }
  return drafts
}

function staffingReasons(input: {
  kind: WorldBusinessKind
  activeStaff: number
  openPositions: number
  ownerUnavailable: boolean
  localDemand: number
  quality: number
}): WorldStaffingPriorityReason[] {
  const reasons: WorldStaffingPriorityReason[] = []
  if (ESSENTIAL_BUSINESS_KINDS.has(input.kind)) reasons.push('essential_service')
  if (input.activeStaff <= 0 && input.openPositions > 0) reasons.push('no_active_staff')
  if (input.openPositions > 1) reasons.push('multiple_open_positions')
  if (input.ownerUnavailable) reasons.push('owner_unavailable')
  if (input.localDemand > 0) reasons.push('local_demand_waiting')
  if (input.quality < 0.6) reasons.push('quality_degraded')
  return reasons
}

function businessPriorityScore(input: {
  kind: WorldBusinessKind
  activeStaff: number
  openPositions: number
  ownerUnavailable: boolean
  localDemand: number
  quality: number
}): number {
  let score = input.openPositions * 30
  if (ESSENTIAL_BUSINESS_KINDS.has(input.kind)) score += 20
  if (input.activeStaff <= 0 && input.openPositions > 0) score += 25
  if (input.ownerUnavailable) score += 20
  score += Math.min(30, input.localDemand * 5)
  if (input.quality < 0.6) score += Math.round((0.6 - input.quality) * 50)
  return score
}

function workerReadinessScore(input: {
  kind: WorldCitizenKind
  blockers: readonly WorldStaffingPolicyBlocker[]
}): number {
  if (input.blockers.length > 0) return input.kind === 'real' ? 10 : 0
  return input.kind === 'sim' ? 80 : 40
}

function normalizeBusinessKind(kind: WorldStaffingBusinessInput['kind']): WorldBusinessKind | null {
  if (typeof kind !== 'string') return null
  const normalized = kind.trim()
  return BUSINESS_KINDS.includes(normalized as WorldBusinessKind) ? normalized as WorldBusinessKind : null
}

function normalizeWorkerKind(kind: WorldStaffingWorkerInput['kind']): WorldCitizenKind | null {
  if (kind === 'sim' || kind === 'real') return kind
  return null
}

function normalizeCount(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! < 0) return 0
  return Math.floor(value!)
}

function normalizeMaxAssignments(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value! <= 0) return Number.POSITIVE_INFINITY
  return Math.floor(value!)
}

function normalizeQuality(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1.5, value!))
}

function compareBusinessNeeds(a: WorldStaffingBusinessNeed, b: WorldStaffingBusinessNeed): number {
  return b.priorityScore - a.priorityScore ||
    b.openPositions - a.openPositions ||
    a.businessId.localeCompare(b.businessId)
}

function compareWorkerCandidates(a: WorldStaffingWorkerCandidate, b: WorldStaffingWorkerCandidate): number {
  return b.readinessScore - a.readinessScore ||
    Number(b.availableForSimAssignment) - Number(a.availableForSimAssignment) ||
    a.citizenId.localeCompare(b.citizenId)
}

function uniqueBlockers(blockers: readonly WorldStaffingPolicyBlocker[]): readonly WorldStaffingPolicyBlocker[] {
  return [...new Set(blockers)]
}
