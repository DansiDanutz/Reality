import type {
  AreaClaimSource,
  FounderCovenantApprovalBlocker,
  FounderCovenantApprovalRequest,
  FounderCovenantApprovalRequestKind,
  FounderCovenantApprovalRequestStatus,
  FounderCovenantAuthorityRole,
  FounderCovenantAuthorityStatus,
  FounderCovenantManualAction,
  FounderCovenantManualActionKind,
  FounderCovenantNextAction,
  FounderCovenantNotificationDraftKind,
  FounderCovenantReviewChecklistStatus,
  FounderCovenantReviewHistoryItem,
  FounderCovenantReviewInputKind,
  FounderCovenantReviewInputStatus,
  FounderCovenantReviewQueueNextStep,
  FounderCovenantSignalKind,
  FounderCovenantSignalSeverity,
  FounderCovenantStageKind,
  FounderCovenantStageStatus,
  FounderCovenantStatus,
  WorldArea,
  WorldAreaEvent,
  WorldAreaEventKind,
  WorldAreaEventSeverity,
  WorldBusiness,
  WorldBusinessKind,
  WorldCitizen,
  WorldCitizenKind,
  WorldCitizenState,
  WorldDebt,
  WorldDebtKind,
  WorldDepartureReason,
  WorldDepartureServiceKind,
  WorldTransaction,
  WorldTransactionKind,
} from './worldSim'
import type { Needs } from './types'

export const WORLD_AREA_SNAPSHOT_VERSION = 1

export interface WorldAreaSnapshot {
  version: typeof WORLD_AREA_SNAPSHOT_VERSION
  area: WorldArea
}

export type DecodeWorldAreaSnapshotError =
  | 'invalid_json'
  | 'invalid_version'
  | 'invalid_area'

export type DecodeWorldAreaSnapshotResult =
  | { ok: true; area: WorldArea }
  | { ok: false; error: DecodeWorldAreaSnapshotError }

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']
const CITIZEN_KINDS: WorldCitizenKind[] = ['sim', 'real']
const DEBT_KINDS: WorldDebtKind[] = ['medical']
const CLAIM_SOURCES: AreaClaimSource[] = ['manual', 'ip', 'geolocation', 'telegram']
const AREA_EVENT_KINDS: WorldAreaEventKind[] = ['sim_citizen_departure']
const AREA_EVENT_SEVERITIES: WorldAreaEventSeverity[] = ['info', 'warning', 'critical']
const DEPARTURE_REASONS: WorldDepartureReason[] = ['water_unserved', 'food_unserved', 'housing_unserved']
const DEPARTURE_SERVICE_KINDS: WorldDepartureServiceKind[] = ['water', 'food', 'housing']
const COVENANT_STATUSES: FounderCovenantStatus[] = ['unclaimed', 'active', 'watch', 'manual_review']
const COVENANT_NEXT_ACTIONS: FounderCovenantNextAction[] = ['claim_area', 'none', 'warn_founder', 'manual_review']
const COVENANT_SIGNAL_SEVERITIES: FounderCovenantSignalSeverity[] = ['info', 'warning', 'critical']
const COVENANT_SIGNAL_KINDS: FounderCovenantSignalKind[] = [
  'founder_unavailable',
  'no_business_built',
  'understaffed_businesses',
  'essential_shortage',
  'sim_departure',
  'founder_debt',
  'review_due',
]
const COVENANT_CHECKLIST_STATUSES: FounderCovenantReviewChecklistStatus[] = ['met', 'watch', 'manual_review']
const COVENANT_REVIEW_INPUT_KINDS: FounderCovenantReviewInputKind[] = [
  'in_game_activity',
  'area_health',
  'population_growth',
  'external_contribution',
  'ideas_feedback',
  'review_consistency',
]
const COVENANT_REVIEW_INPUT_STATUSES: FounderCovenantReviewInputStatus[] = ['captured', 'watch', 'manual_needed']
const COVENANT_STAGE_KINDS: FounderCovenantStageKind[] = [
  'active',
  'warning',
  'probation',
  'removed',
  'waitlist_replacement',
]
const COVENANT_STAGE_STATUSES: FounderCovenantStageStatus[] = ['current', 'recommended', 'locked']
const COVENANT_MANUAL_ACTION_KINDS: FounderCovenantManualActionKind[] = [
  'record_review',
  'send_warning',
  'start_probation',
  'recommend_replacement',
]
const COVENANT_QUEUE_NEXT_STEPS: FounderCovenantReviewQueueNextStep[] = [
  'record_review',
  'main_founder_approval',
  'monitor',
]
const COVENANT_AUTHORITY_ROLES: FounderCovenantAuthorityRole[] = ['area_reviewer', 'main_founder']
const COVENANT_AUTHORITY_STATUSES: FounderCovenantAuthorityStatus[] = ['evidence_only', 'approval_required']
const COVENANT_APPROVAL_KINDS: FounderCovenantApprovalRequestKind[] = [
  'send_warning',
  'start_probation',
  'recommend_replacement',
]
const COVENANT_APPROVAL_STATUSES: FounderCovenantApprovalRequestStatus[] = ['pending_manual_approval']
const COVENANT_APPROVAL_BLOCKERS: FounderCovenantApprovalBlocker[] = [
  'approval_workflow_disabled',
  'telegram_delivery_disabled',
  'probation_execution_disabled',
  'replacement_disabled',
  'waitlist_handoff_disabled',
]
const COVENANT_NOTIFICATION_DRAFT_KINDS: FounderCovenantNotificationDraftKind[] = [
  'founder_warning',
  'manual_review_required',
]
const SYSTEM_HOSPITAL_ACCOUNT = 'system:hospital'
const SYSTEM_LEDGER_ACCOUNTS = new Set([
  'system:founder-credit',
  'system:sim-credit',
  'system:builders',
  SYSTEM_HOSPITAL_ACCOUNT,
])
const TRANSACTION_KINDS: WorldTransactionKind[] = [
  'founder_credit',
  'sim_citizen_credit',
  'customer_purchase',
  'business_build',
  'worker_wage',
  'hospital_bill',
  'insurance_premium',
  'insurance_payout',
  'medical_debt',
  'debt_repayment',
]

export function encodeWorldAreaSnapshot(area: WorldArea): string {
  return JSON.stringify({ version: WORLD_AREA_SNAPSHOT_VERSION, area } satisfies WorldAreaSnapshot)
}

export function decodeWorldAreaSnapshot(raw: string): DecodeWorldAreaSnapshotResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }

  if (!isRecord(parsed) || parsed.version !== WORLD_AREA_SNAPSHOT_VERSION) {
    return { ok: false, error: 'invalid_version' }
  }
  if (!isWorldArea(parsed.area)) return { ok: false, error: 'invalid_area' }
  return { ok: true, area: cloneArea(parsed.area) }
}

function isWorldArea(value: unknown): value is WorldArea {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isFiniteNumber(value.now)) return false
  if (value.claim !== undefined && !isAreaClaim(value.claim)) return false
  if (!Array.isArray(value.citizens) || !value.citizens.every(isWorldCitizen) || !hasUniqueIds(value.citizens)) {
    return false
  }
  if (!Array.isArray(value.businesses) || !value.businesses.every(isWorldBusiness) || !hasUniqueIds(value.businesses)) {
    return false
  }
  if (
    !Array.isArray(value.transactions) ||
    !value.transactions.every(isWorldTransaction) ||
    !hasUniqueIds(value.transactions)
  ) {
    return false
  }
  if (
    value.areaEvents !== undefined &&
    (!Array.isArray(value.areaEvents) || !value.areaEvents.every(isWorldAreaEvent) || !hasUniqueIds(value.areaEvents))
  ) {
    return false
  }
  if (
    value.founderReviewHistory !== undefined &&
    (
      !Array.isArray(value.founderReviewHistory) ||
      !value.founderReviewHistory.every(isFounderCovenantReviewHistoryItem) ||
      !hasUniqueIds(value.founderReviewHistory)
    )
  ) {
    return false
  }
  return hasValidAreaReferences(value as unknown as WorldArea)
}

function isAreaClaim(value: unknown): value is WorldArea['claim'] {
  return isRecord(value) &&
    isNonEmptyString(value.founderCitizenId) &&
    isNonEmptyString(value.label) &&
    isLatitude(value.centerLat) &&
    isLongitude(value.centerLng) &&
    isFiniteNumber(value.radiusKm) &&
    value.radiusKm > 0 &&
    isFiniteNumber(value.claimedAt) &&
    isOneOf(value.source, CLAIM_SOURCES)
}

function isWorldCitizen(value: unknown): value is WorldCitizen {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isOneOf(value.kind, CITIZEN_KINDS)) return false
  if (!isMoney(value.money) || !isMoney(value.debt) || !isNeeds(value.needs) || !isPercentage(value.health)) return false
  const debts = value.debts
  if (debts !== undefined) {
    if (!Array.isArray(debts) || !debts.every(isWorldDebt)) return false
    if (!hasUniqueIds(debts)) return false
    if (roundMoney(debts.reduce((total, debt) => total + debt.amount, 0)) !== value.debt) return false
  }
  if (!isCitizenState(value.state)) return false
  if (value.homeBusinessId !== undefined && !isNonEmptyString(value.homeBusinessId)) return false
  if (value.jobBusinessId !== undefined && !isNonEmptyString(value.jobBusinessId)) return false
  if (value.insuranceBusinessId !== undefined && !isNonEmptyString(value.insuranceBusinessId)) return false
  if (value.insurancePaidUntil !== undefined && !isFiniteNumber(value.insurancePaidUntil)) return false
  if (value.heirCitizenId !== undefined && !isNonEmptyString(value.heirCitizenId)) return false
  return true
}

function isWorldDebt(value: unknown): value is WorldDebt {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.kind, DEBT_KINDS) &&
    isNonEmptyString(value.creditorId) &&
    isPositiveMoney(value.amount) &&
    isFiniteNumber(value.issuedAt) &&
    isNonEmptyString(value.memo)
}

function isCitizenState(value: unknown): value is WorldCitizenState {
  if (!isRecord(value)) return false
  if (value.kind === 'active') return true
  return value.kind === 'hospitalized' && isFiniteNumber(value.until)
}

function isWorldBusiness(value: unknown): value is WorldBusiness {
  if (!isRecord(value)) return false
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isOneOf(value.kind, BUSINESS_KINDS)) return false
  if (!isNonEmptyString(value.ownerId) || !isMoney(value.cash) || !Array.isArray(value.staffCitizenIds)) return false
  if (!value.staffCitizenIds.every(isNonEmptyString)) return false
  if (value.price !== undefined && !isPositiveMoney(value.price)) return false
  if (value.wagePerHour !== undefined && !isPositiveMoney(value.wagePerHour)) return false
  if (value.quality !== undefined && (!isFiniteNumber(value.quality) || value.quality <= 0)) return false
  if (value.createdBy !== undefined && !isNonEmptyString(value.createdBy)) return false
  if (value.inheritedFrom !== undefined && !isNonEmptyString(value.inheritedFrom)) return false
  return true
}

function isWorldTransaction(value: unknown): value is WorldTransaction {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.at) &&
    isOneOf(value.kind, TRANSACTION_KINDS) &&
    value.payoutEligibility === 'game_only' &&
    isNonEmptyString(value.fromId) &&
    isNonEmptyString(value.toId) &&
    isPositiveMoney(value.amount) &&
    isNonEmptyString(value.memo)
}

function isWorldAreaEvent(value: unknown): value is WorldAreaEvent {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.at) &&
    isOneOf(value.kind, AREA_EVENT_KINDS) &&
    isOneOf(value.severity, AREA_EVENT_SEVERITIES) &&
    isNonEmptyString(value.citizenId) &&
    isNonEmptyString(value.citizenName) &&
    value.simulated === true &&
    isOneOf(value.reason, DEPARTURE_REASONS) &&
    isOneOf(value.serviceKind, DEPARTURE_SERVICE_KINDS) &&
    departureReasonServiceKind(value.reason) === value.serviceKind &&
    isPercentage(value.health) &&
    isNeeds(value.needs) &&
    isNonEmptyString(value.message)
}

function isFounderCovenantReviewHistoryItem(value: unknown): value is FounderCovenantReviewHistoryItem {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.at) &&
    isNonEmptyString(value.reviewerId) &&
    isOneOf(value.actionKind, COVENANT_MANUAL_ACTION_KINDS) &&
    isNonEmptyString(value.summary) &&
    isFounderCovenantEvidenceAuthorityGate(value.authorityGate) &&
    (value.decision === null || isFounderCovenantReviewDecision(value.decision)) &&
    Array.isArray(value.signals) &&
    value.signals.every(isFounderCovenantSignal) &&
    (value.activityReview === null || isFounderCovenantActivityReview(value.activityReview)) &&
    isFounderCovenantReviewQueue(value.reviewQueue) &&
    Array.isArray(value.reviewInputs) &&
    value.reviewInputs.every(isFounderCovenantReviewInput) &&
    Array.isArray(value.stages) &&
    value.stages.every(isFounderCovenantStage) &&
    Array.isArray(value.reviewChecklist) &&
    value.reviewChecklist.every(isFounderCovenantReviewChecklistItem) &&
    Array.isArray(value.manualActions) &&
    value.manualActions.every(isFounderCovenantManualAction) &&
    Array.isArray(value.approvalRequests) &&
    value.approvalRequests.every(isFounderCovenantApprovalRequest) &&
    (value.reviewSchedule === null || isFounderCovenantReviewSchedule(value.reviewSchedule))
}

function isFounderCovenantEvidenceAuthorityGate(value: unknown): boolean {
  return isRecord(value) &&
    value.requiredRole === 'area_reviewer' &&
    value.status === 'evidence_only' &&
    value.approvedById === null &&
    value.approvedAt === null &&
    value.executionEnabled === false
}

function isFounderCovenantAuthorityGate(value: unknown): boolean {
  return isRecord(value) &&
    isOneOf(value.requiredRole, COVENANT_AUTHORITY_ROLES) &&
    isOneOf(value.status, COVENANT_AUTHORITY_STATUSES) &&
    value.approvedById === null &&
    value.approvedAt === null &&
    typeof value.executionEnabled === 'boolean'
}

function isFounderCovenantReviewDecision(value: unknown): boolean {
  return isRecord(value) &&
    isOneOf(value.status, COVENANT_STATUSES) &&
    isOneOf(value.nextAction, COVENANT_NEXT_ACTIONS) &&
    typeof value.manualReviewRequired === 'boolean'
}

function isFounderCovenantSignal(value: unknown): boolean {
  return isRecord(value) &&
    isOneOf(value.kind, COVENANT_SIGNAL_KINDS) &&
    isOneOf(value.severity, COVENANT_SIGNAL_SEVERITIES) &&
    isNonEmptyString(value.message) &&
    (value.businessIds === undefined || (Array.isArray(value.businessIds) && value.businessIds.every(isNonEmptyString))) &&
    (value.businessKinds === undefined || (Array.isArray(value.businessKinds) && value.businessKinds.every((kind) => isOneOf(kind, BUSINESS_KINDS)))) &&
    (value.amount === undefined || (isFiniteNumber(value.amount) && value.amount >= 0))
}

function isFounderCovenantActivityReview(value: unknown): boolean {
  return isRecord(value) &&
    isFiniteNumber(value.checkedAt) &&
    typeof value.active === 'boolean' &&
    typeof value.useful === 'boolean' &&
    typeof value.building === 'boolean' &&
    typeof value.staffed === 'boolean' &&
    typeof value.indebted === 'boolean' &&
    typeof value.hospitalized === 'boolean' &&
    typeof value.atRisk === 'boolean' &&
    isFiniteNumber(value.score)
}

function isFounderCovenantReviewQueue(value: unknown): boolean {
  return isRecord(value) &&
    value.evidenceOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    isOneOf(value.nextStep, COVENANT_QUEUE_NEXT_STEPS) &&
    typeof value.recordReviewEnabled === 'boolean' &&
    Array.isArray(value.recommendedActionKinds) &&
    value.recommendedActionKinds.every((kind) => isOneOf(kind, COVENANT_MANUAL_ACTION_KINDS)) &&
    Array.isArray(value.pendingApprovalKinds) &&
    value.pendingApprovalKinds.every((kind) => isOneOf(kind, COVENANT_APPROVAL_KINDS)) &&
    isFiniteNumber(value.pendingApprovalCount) &&
    Array.isArray(value.pendingNotificationKinds) &&
    value.pendingNotificationKinds.every((kind) => isOneOf(kind, COVENANT_NOTIFICATION_DRAFT_KINDS)) &&
    isFiniteNumber(value.pendingNotificationCount) &&
    isFiniteNumber(value.blockerCount) &&
    Array.isArray(value.blockers) &&
    value.blockers.every((blocker) => isOneOf(blocker, COVENANT_APPROVAL_BLOCKERS))
}

function isFounderCovenantReviewInput(value: unknown): boolean {
  return isRecord(value) &&
    isOneOf(value.kind, COVENANT_REVIEW_INPUT_KINDS) &&
    isNonEmptyString(value.label) &&
    isOneOf(value.status, COVENANT_REVIEW_INPUT_STATUSES) &&
    isNonEmptyString(value.evidence) &&
    typeof value.manualEvidenceRequired === 'boolean'
}

function isFounderCovenantStage(value: unknown): boolean {
  return isRecord(value) &&
    isOneOf(value.kind, COVENANT_STAGE_KINDS) &&
    isNonEmptyString(value.label) &&
    isOneOf(value.status, COVENANT_STAGE_STATUSES) &&
    isNonEmptyString(value.reason) &&
    typeof value.requiresMainFounderApproval === 'boolean' &&
    value.manualOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false
}

function isFounderCovenantReviewChecklistItem(value: unknown): boolean {
  return isRecord(value) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.label) &&
    isOneOf(value.status, COVENANT_CHECKLIST_STATUSES) &&
    isNonEmptyString(value.evidence)
}

function isFounderCovenantManualAction(value: unknown): value is FounderCovenantManualAction {
  return isRecord(value) &&
    isOneOf(value.kind, COVENANT_MANUAL_ACTION_KINDS) &&
    isNonEmptyString(value.label) &&
    typeof value.recommended === 'boolean' &&
    value.requiresApproval === true &&
    value.automationEnabled === false &&
    isFounderCovenantAuthorityGate(value.authorityGate) &&
    isNonEmptyString(value.reason) &&
    value.clientPayload === null
}

function isFounderCovenantApprovalRequest(value: unknown): value is FounderCovenantApprovalRequest {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.at) &&
    isOneOf(value.kind, COVENANT_APPROVAL_KINDS) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.reason) &&
    isOneOf(value.status, COVENANT_APPROVAL_STATUSES) &&
    value.recommended === true &&
    value.requiresApproval === true &&
    value.approvalEnabled === false &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    isFounderCovenantAuthorityGate(value.authorityGate) &&
    (value.notificationDraftId === null || isNonEmptyString(value.notificationDraftId)) &&
    Array.isArray(value.blockers) &&
    value.blockers.every((blocker) => isOneOf(blocker, COVENANT_APPROVAL_BLOCKERS))
}

function isFounderCovenantReviewSchedule(value: unknown): boolean {
  return isRecord(value) &&
    (value.lastReviewAt === null || isFiniteNumber(value.lastReviewAt)) &&
    isFiniteNumber(value.nextWeeklyReviewAt) &&
    isFiniteNumber(value.nextMonthlyReviewAt) &&
    typeof value.weeklyReviewDue === 'boolean' &&
    typeof value.monthlyReviewDue === 'boolean' &&
    typeof value.overdue === 'boolean' &&
    value.overdue === (value.weeklyReviewDue || value.monthlyReviewDue) &&
    value.automationEnabled === false
}

function departureReasonServiceKind(reason: WorldDepartureReason): WorldDepartureServiceKind {
  switch (reason) {
    case 'water_unserved':
      return 'water'
    case 'food_unserved':
      return 'food'
    case 'housing_unserved':
      return 'housing'
  }
}

function hasValidAreaReferences(area: WorldArea): boolean {
  const citizens = new Map(area.citizens.map((citizen) => [citizen.id, citizen]))
  const businesses = new Map(area.businesses.map((business) => [business.id, business]))
  const departedCitizens = new Map((area.areaEvents ?? [])
    .filter((event) => event.kind === 'sim_citizen_departure')
    .map((event) => [event.citizenId, event]))

  if (area.claim && citizens.get(area.claim.founderCitizenId)?.kind !== 'real') return false

  for (const business of area.businesses) {
    if (!citizens.has(business.ownerId)) return false
    if (!hasUniqueStrings(business.staffCitizenIds)) return false
    for (const staffCitizenId of business.staffCitizenIds) {
      const worker = citizens.get(staffCitizenId)
      if (!worker || worker.jobBusinessId !== business.id) return false
    }
  }

  for (const citizen of area.citizens) {
    for (const debt of citizen.debts ?? []) {
      if (!isValidMedicalCreditor(debt.creditorId, businesses)) return false
    }
    if (citizen.homeBusinessId !== undefined && businesses.get(citizen.homeBusinessId)?.kind !== 'housing') {
      return false
    }
    if (citizen.jobBusinessId !== undefined) {
      const employer = businesses.get(citizen.jobBusinessId)
      if (!employer || !employer.staffCitizenIds.includes(citizen.id)) return false
    }
    if ((citizen.insuranceBusinessId === undefined) !== (citizen.insurancePaidUntil === undefined)) {
      return false
    }
    if (
      citizen.insuranceBusinessId !== undefined &&
      businesses.get(citizen.insuranceBusinessId)?.kind !== 'insurance'
    ) {
      return false
    }
    if (citizen.heirCitizenId !== undefined) {
      const heir = citizens.get(citizen.heirCitizenId)
      if (!heir || heir.kind !== 'real' || heir.id === citizen.id) return false
    }
  }

  for (const transaction of area.transactions) {
    if (!isValidTransactionReferences(transaction, area, citizens, businesses, departedCitizens)) return false
  }

  return true
}

function isValidTransactionReferences(
  transaction: WorldTransaction,
  area: WorldArea,
  citizens: Map<string, WorldCitizen>,
  businesses: Map<string, WorldBusiness>,
  departedCitizens: Map<string, WorldAreaEvent>,
): boolean {
  if (!isLedgerAccount(transaction.fromId, citizens, businesses, departedCitizens)) return false
  if (!isLedgerAccount(transaction.toId, citizens, businesses, departedCitizens)) return false

  switch (transaction.kind) {
    case 'founder_credit':
      return transaction.fromId === 'system:founder-credit' &&
        transaction.toId === area.claim?.founderCitizenId &&
        citizens.get(transaction.toId)?.kind === 'real'
    case 'sim_citizen_credit':
      return transaction.fromId === 'system:sim-credit' &&
        (citizens.get(transaction.toId)?.kind === 'sim' || departedCitizens.has(transaction.toId))
    case 'customer_purchase':
      return isCitizenLedgerAccount(transaction.fromId, citizens, departedCitizens) && businesses.has(transaction.toId)
    case 'business_build':
      return transaction.fromId === area.claim?.founderCitizenId && transaction.toId === 'system:builders'
    case 'worker_wage':
      return businesses.has(transaction.fromId) && isCitizenLedgerAccount(transaction.toId, citizens, departedCitizens)
    case 'hospital_bill':
      return isCitizenLedgerAccount(transaction.fromId, citizens, departedCitizens) &&
        isValidMedicalCreditor(transaction.toId, businesses)
    case 'insurance_premium':
      return isCitizenLedgerAccount(transaction.fromId, citizens, departedCitizens) &&
        businesses.get(transaction.toId)?.kind === 'insurance'
    case 'insurance_payout':
      return businesses.get(transaction.fromId)?.kind === 'insurance' &&
        isValidMedicalCreditor(transaction.toId, businesses)
    case 'medical_debt':
      return isCitizenLedgerAccount(transaction.fromId, citizens, departedCitizens) &&
        isValidMedicalCreditor(transaction.toId, businesses)
    case 'debt_repayment':
      return isCitizenLedgerAccount(transaction.fromId, citizens, departedCitizens) &&
        isValidMedicalCreditor(transaction.toId, businesses)
  }
}

function isLedgerAccount(
  accountId: string,
  citizens: Map<string, WorldCitizen>,
  businesses: Map<string, WorldBusiness>,
  departedCitizens: Map<string, WorldAreaEvent>,
): boolean {
  return isCitizenLedgerAccount(accountId, citizens, departedCitizens) ||
    businesses.has(accountId) ||
    SYSTEM_LEDGER_ACCOUNTS.has(accountId)
}

function isCitizenLedgerAccount(
  accountId: string,
  citizens: Map<string, WorldCitizen>,
  departedCitizens: Map<string, WorldAreaEvent>,
): boolean {
  return citizens.has(accountId) || departedCitizens.has(accountId)
}

function isValidMedicalCreditor(accountId: string, businesses: Map<string, WorldBusiness>): boolean {
  return accountId === SYSTEM_HOSPITAL_ACCOUNT || businesses.get(accountId)?.kind === 'clinic'
}

function isNeeds(value: unknown): value is Needs {
  return isRecord(value) &&
    isPercentage(value.hunger) &&
    isPercentage(value.hydration) &&
    isPercentage(value.energy) &&
    isPercentage(value.hygiene) &&
    isPercentage(value.fun)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T)
}

function hasUniqueIds(values: { id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMoney(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isPositiveMoney(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isPercentage(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90
}

function isLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180
}

function cloneArea(area: WorldArea): WorldArea {
  return JSON.parse(JSON.stringify(area)) as WorldArea
}
