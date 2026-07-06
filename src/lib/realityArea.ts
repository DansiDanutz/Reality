import type { Citizen } from '../game/types'
import type { FounderAreaProfile } from '../game/founderAreaSession'
import type {
  AreaBusinessAlert,
  AreaBusinessDashboard,
  AreaBusinessStatus,
  AreaCitizenDashboard,
  AreaDebtRepaymentBlocker,
  AreaFounderCovenantDashboard,
  AreaInsuranceActionBlocker,
  AreaLedgerDashboard,
  AreaJobsDashboard,
  AreaNeedsDashboard,
  AreaSurvivalDashboard,
  AreaWorkerCandidateAction,
  CitizenSurvivalSignal,
  FirstBuildBlocker,
  FirstBuildRecommendation,
  FounderCovenantReviewHistoryItem,
  FounderCovenantSignal,
  WorldArea,
  WorldBusiness,
  WorldBusinessKind,
  WorldCitizen,
  WorldClientIntentPayload,
  WorldTransactionKind,
  WorldSurvivalActionBlocker,
  WorldSurvivalActionIntent,
  WorldSurvivalRiskLevel,
  WorldSurvivalWarningKind,
  WorldDebt,
  WorldTransaction,
} from '../game/worldSim'

export type RealityAreaClaimSource = 'manual' | 'ip' | 'geolocation' | 'telegram'

export interface RealityAreaNeeds {
  hunger: number
  hydration: number
  energy: number
  hygiene: number
  fun: number
}

export interface RealityAreaDebt {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
}

export interface RealityAreaCitizen {
  id: string
  name: string
  kind: 'real' | 'sim'
  money: number
  debt: number
  debts?: RealityAreaDebt[]
  needs: RealityAreaNeeds
  health: number
  state: { kind: 'active' } | { kind: 'hospitalized'; until: string }
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  insurancePaidUntil?: string
  heirCitizenId?: string
}

export interface RealityAreaBusiness {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  staffCitizenIds: string[]
  createdAt: string
  createdBy: string
}

export interface RealityAreaTransaction {
  id: string
  at: string
  kind: WorldTransaction['kind']
  fromId: string
  toId: string
  amount: number
  memo: string
}

export type RealityAreaCovenantStatus = 'active' | 'watch' | 'manual_review'
export type RealityAreaCovenantNextAction = 'none' | 'warn_founder' | 'manual_review'
export type RealityAreaCovenantSignalSeverity = 'info' | 'warning' | 'critical'
export type RealityAreaCovenantReviewChecklistStatus = 'met' | 'watch' | 'manual_review'
export type RealityAreaCovenantReviewQueueNextStep = 'record_review' | 'main_founder_approval' | 'monitor'
export type RealityAreaCovenantReviewInputKind =
  | 'in_game_activity'
  | 'area_health'
  | 'population_growth'
  | 'external_contribution'
  | 'ideas_feedback'
  | 'review_consistency'
export type RealityAreaCovenantReviewInputStatus = 'captured' | 'watch' | 'manual_needed'
export type RealityAreaCovenantStageKind = 'active' | 'warning' | 'probation' | 'removed' | 'waitlist_replacement'
export type RealityAreaCovenantStageStatus = 'current' | 'recommended' | 'locked'
export type RealityAreaCovenantManualActionKind =
  | 'record_review'
  | 'send_warning'
  | 'start_probation'
  | 'recommend_replacement'
export type RealityAreaCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'founder_debt'
  | 'review_due'

export interface RealityAreaCovenantSignal {
  kind: RealityAreaCovenantSignalKind
  severity: RealityAreaCovenantSignalSeverity
  message: string
  businessIds?: string[]
  businessKinds?: WorldBusinessKind[]
  amount?: number
}

export interface RealityAreaCovenantReviewChecklistItem {
  key: string
  label: string
  status: RealityAreaCovenantReviewChecklistStatus
  evidence: string
}

export interface RealityAreaCovenantReviewInput {
  kind: RealityAreaCovenantReviewInputKind
  label: string
  status: RealityAreaCovenantReviewInputStatus
  evidence: string
  manualEvidenceRequired: boolean
}

export interface RealityAreaCovenantStage {
  kind: RealityAreaCovenantStageKind
  label: string
  status: RealityAreaCovenantStageStatus
  reason: string
  requiresMainFounderApproval: boolean
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

export interface RealityAreaCovenantReviewQueue {
  evidenceOnly: true
  automationEnabled: false
  executionEnabled: false
  nextStep: RealityAreaCovenantReviewQueueNextStep
  recordReviewEnabled: boolean
  recommendedActionKinds: readonly RealityAreaCovenantManualActionKind[]
  pendingApprovalKinds: readonly RealityAreaCovenantApprovalRequestKind[]
  pendingApprovalCount: number
  pendingNotificationKinds: readonly RealityAreaCovenantNotificationDraftKind[]
  pendingNotificationCount: number
  blockerCount: number
  blockers: readonly RealityAreaCovenantApprovalBlocker[]
}

export interface RealityAreaCovenantReviewPayload {
  type: 'recordCovenantReview'
  actionKind: 'record_review'
  note?: string
}

export type RealityAreaCovenantAuthorityRole = 'area_reviewer' | 'main_founder'
export type RealityAreaCovenantAuthorityStatus = 'evidence_only' | 'approval_required'

export interface RealityAreaCovenantAuthorityGate {
  requiredRole: RealityAreaCovenantAuthorityRole
  status: RealityAreaCovenantAuthorityStatus
  approvedById: null
  approvedAt: null
  executionEnabled: boolean
}

export interface RealityAreaCovenantManualAction {
  kind: RealityAreaCovenantManualActionKind
  label: string
  recommended: boolean
  requiresApproval: true
  automationEnabled: false
  authorityGate: RealityAreaCovenantAuthorityGate
  reason: string
  clientPayload: RealityAreaCovenantReviewPayload | null
}

export type RealityAreaCovenantApprovalRequestKind = Exclude<RealityAreaCovenantManualActionKind, 'record_review'>
export type RealityAreaCovenantApprovalRequestStatus = 'pending_manual_approval'
export type RealityAreaCovenantApprovalBlocker =
  | 'approval_workflow_disabled'
  | 'telegram_delivery_disabled'
  | 'probation_execution_disabled'
  | 'replacement_disabled'
  | 'waitlist_handoff_disabled'

export interface RealityAreaCovenantApprovalRequest {
  id: string
  at: string
  kind: RealityAreaCovenantApprovalRequestKind
  label: string
  reason: string
  status: RealityAreaCovenantApprovalRequestStatus
  recommended: true
  requiresApproval: true
  approvalEnabled: false
  automationEnabled: false
  executionEnabled: false
  authorityGate: RealityAreaCovenantAuthorityGate
  notificationDraftId: string | null
  blockers: readonly RealityAreaCovenantApprovalBlocker[]
}

export interface RealityAreaCovenantReviewHistoryItem {
  id: string
  at: string
  reviewerId: string
  actionKind: RealityAreaCovenantManualActionKind
  summary: string
  authorityGate: RealityAreaCovenantAuthorityGate
  decision: RealityAreaCovenantReviewDecisionSnapshot | null
  signals: RealityAreaCovenantSignal[]
  activityReview: RealityAreaCovenantReview['activityReview'] | null
  reviewQueue: RealityAreaCovenantReviewQueue
  reviewInputs: RealityAreaCovenantReviewInput[]
  stages: RealityAreaCovenantStage[]
  reviewChecklist: RealityAreaCovenantReviewChecklistItem[]
  manualActions: RealityAreaCovenantManualAction[]
  approvalRequests: RealityAreaCovenantApprovalRequest[]
  reviewSchedule: RealityAreaCovenantReviewSchedule | null
}

export interface RealityAreaCovenantReviewDecisionSnapshot {
  status: RealityAreaCovenantStatus
  nextAction: RealityAreaCovenantNextAction
  manualReviewRequired: boolean
}

export interface RealityAreaCovenantLatestReview {
  id: string
  reviewedAt: string
  reviewerId: string
  actionKind: RealityAreaCovenantManualActionKind
  summary: string
  authorityGate: RealityAreaCovenantAuthorityGate
  decision: RealityAreaCovenantReviewDecisionSnapshot | null
  signals: RealityAreaCovenantSignal[]
  activityReview: RealityAreaCovenantReview['activityReview'] | null
  reviewQueue: RealityAreaCovenantReviewQueue
  reviewInputs: RealityAreaCovenantReviewInput[]
  stages: RealityAreaCovenantStage[]
  reviewChecklist: RealityAreaCovenantReviewChecklistItem[]
  manualActions: RealityAreaCovenantManualAction[]
  approvalRequests: RealityAreaCovenantApprovalRequest[]
  reviewSchedule: RealityAreaCovenantReviewSchedule | null
  evidenceOnly: true
  automationEnabled: false
}

export interface RealityAreaCovenantReviewSchedule {
  lastReviewAt: string | null
  nextWeeklyReviewAt: string
  nextMonthlyReviewAt: string
  weeklyReviewDue: boolean
  monthlyReviewDue: boolean
  overdue: boolean
  automationEnabled: false
}

export type RealityAreaCovenantNotificationDraftKind = 'founder_warning' | 'manual_review_required'
export type RealityAreaCovenantNotificationChannel = 'telegram'

export interface RealityAreaCovenantNotificationDraft {
  id: string
  at: string
  kind: RealityAreaCovenantNotificationDraftKind
  channel: RealityAreaCovenantNotificationChannel
  recipientCitizenId: string
  title: string
  body: string
  requiresApproval: true
  sendEnabled: false
  authorityGate: RealityAreaCovenantAuthorityGate
}

export interface RealityAreaCovenantReview {
  founderCitizenId: string
  status: RealityAreaCovenantStatus
  nextAction: RealityAreaCovenantNextAction
  reviewCadence: 'weekly_monthly_manual'
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: {
    checkedAt: string
    active: boolean
    useful: boolean
    building: boolean
    staffed: boolean
    indebted: boolean
    hospitalized: boolean
    atRisk: boolean
    score: number
  }
  reviewQueue: RealityAreaCovenantReviewQueue
  reviewInputs: RealityAreaCovenantReviewInput[]
  stages: RealityAreaCovenantStage[]
  reviewChecklist: RealityAreaCovenantReviewChecklistItem[]
  manualActions: RealityAreaCovenantManualAction[]
  approvalRequests: RealityAreaCovenantApprovalRequest[]
  reviewSchedule: RealityAreaCovenantReviewSchedule
  latestReview: RealityAreaCovenantLatestReview | null
  reviewHistory: RealityAreaCovenantReviewHistoryItem[]
  notificationDrafts: RealityAreaCovenantNotificationDraft[]
  signals: RealityAreaCovenantSignal[]
}

export interface RealityAreaLicenseDashboard {
  slots: number
  used: number
  remaining: number
  saturation: number
}

export interface RealityAreaFirstBuildRecommendation {
  kind: WorldBusinessKind
  name: string
  proposedBusinessId: string | null
  priority: FirstBuildRecommendation['priority']
  action: FirstBuildRecommendation['action']
  buildCost: number
  cashShortfall: number
  currentDemand: number
  currentSupply: number
  licenseSlots: number
  licensesRemaining: number
  nextLicensePopulation: number
  citizensUntilNextLicense: number
  saturation: number
  founderCanAfford: boolean
  canBuildNow: boolean
  blockers: FirstBuildBlocker[]
  licensed: boolean
  saturated: boolean
  score: number
  estimatedHourlyRevenue: number
  estimatedHourlyWageCost: number
  estimatedHourlyProfit: number
  estimatedPaybackHours: number | null
  clientPayload: Extract<WorldClientIntentPayload, { type: 'buildBusiness' }> | null
  reason: string
}

export interface RealityAreaWorkerCandidateDashboard {
  citizenId: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  action: AreaWorkerCandidateAction
  recommendedBusinessId: string | null
  recommendedBusinessName: string | null
  recommendedBusinessKind: WorldBusinessKind | null
  clientPayload: Extract<WorldClientIntentPayload, { type: 'hireWorker' }> | null
}

export interface RealityAreaJobsDashboard {
  employedCitizens: number
  unemployedCitizens: number
  hireableSimWorkers: number
  realWorkersRequiringAcceptance: number
  openPositions: number
  understaffedBusinesses: number
  candidates: RealityAreaWorkerCandidateDashboard[]
}

export interface RealityAreaBusinessDashboard {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  activeStaff: number
  targetStaff: number
  openPositions: number
  hourlyCapacity: number
  ledger: RealityAreaBusinessLedgerDashboard
  status: AreaBusinessStatus
  alerts: AreaBusinessAlert[]
}

export interface RealityAreaBusinessLedgerDashboard {
  transactionCount: number
  revenue: number
  expenses: number
  netCashFlow: number
  wagesPaid: number
  receivablesIssued: number
  recentTransactions: RealityAreaTransaction[]
}

export interface RealityAreaLedgerDashboard {
  transactionCount: number
  totalsByKind: Record<WorldTransactionKind, number>
  recentTransactions: RealityAreaTransaction[]
}

export type RealityAreaGrowthBlocker =
  | 'telegram_invite_links_disabled'
  | 'invite_tracking_disabled'
  | 'automatic_growth_rewards_disabled'
  | 'manual_review_required'

export interface RealityAreaGrowthDashboard {
  channel: 'telegram'
  inviteLinkEnabled: false
  inviteTrackingEnabled: false
  automaticRewardsEnabled: false
  manualEvidenceRequired: true
  realPopulation: number
  simPopulation: number
  trackedInvites: 0
  blockers: RealityAreaGrowthBlocker[]
}

export type RealityAreaSettlementBlocker =
  | 'ton_connect_disabled'
  | 'deposits_disabled'
  | 'withdrawals_disabled'
  | 'land_reservations_disabled'
  | 'leases_disabled'
  | 'manual_payout_review_required'
  | 'compliance_review_required'

export interface RealityAreaSettlementDashboard {
  rail: 'ton'
  mode: 'ledger_only'
  gameplayLedgerSource: 'reality_server'
  gameCredits: number
  payoutEligibleCredits: 0
  walletConnectionRequired: false
  walletConnectionEnabled: false
  depositsEnabled: false
  withdrawalsEnabled: false
  landReservationsEnabled: false
  landLeasesEnabled: false
  highFrequencyOnChainTransactions: false
  manualReviewRequired: true
  complianceReviewRequired: true
  blockers: RealityAreaSettlementBlocker[]
}

export type RealityAreaLegacyRoyaltyBlocker =
  | 'replacement_workflow_disabled'
  | 'waitlist_handoff_disabled'
  | 'treasury_payout_disabled'
  | 'compliance_review_required'

export interface RealityAreaLegacyRoyaltyDashboard {
  enabled: false
  payoutEnabled: false
  replacementWorkflowEnabled: false
  manualReviewRequired: true
  appliesTo: 'inherited_founder_created_businesses_only'
  royaltyRate: number
  treasuryAccountId: 'system:founder-legacy-treasury'
  royaltyEligibleBusinessIds: string[]
  royaltyExcludedBusinessIds: string[]
  blockers: RealityAreaLegacyRoyaltyBlocker[]
}

export interface RealityAreaCitizenDebtDashboard {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
  repaymentIntent: 'repayDebt'
  clientPayload: Extract<WorldClientIntentPayload, { type: 'repayDebt' }> | null
  recommendedPayment: number
  maxAffordablePayment: number
  canRepayNow: boolean
  blockers: AreaDebtRepaymentBlocker[]
}

export interface RealityAreaInsuranceActionDashboard {
  intent: 'buyInsurance'
  clientPayload: Extract<WorldClientIntentPayload, { type: 'buyInsurance' }> | null
  insuranceBusinessId: string | null
  premium: number | null
  available: boolean
  canAfford: boolean
  canBuyNow: boolean
  blockers: AreaInsuranceActionBlocker[]
}

export interface RealityAreaEstateProtectionDashboard {
  enabled: false
  namedHeirCitizenId: string | null
  namedHeirName: string | null
  protectedByInsurance: boolean
  status: 'disabled_until_death_enabled'
}

export interface RealityAreaCitizenDashboard {
  id: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  state: 'active' | 'hospitalized'
  health: number
  needs: RealityAreaNeeds
  money: number
  debt: number
  debts: RealityAreaCitizenDebtDashboard[]
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  heirCitizenId?: string
  insuranceActive: boolean
  insuranceAction: RealityAreaInsuranceActionDashboard
  estateProtection: RealityAreaEstateProtectionDashboard
}

export interface RealityAreaSurvivalAction {
  warning: WorldSurvivalWarningKind
  intent: WorldSurvivalActionIntent
  clientPayload: Extract<WorldClientIntentPayload, { type: WorldSurvivalActionIntent }>
  serviceKind: Exclude<WorldBusinessKind, 'insurance'>
  available: boolean
  lowestPrice: number | null
  canAfford: boolean
  blockers: WorldSurvivalActionBlocker[]
}

export interface RealityAreaSurvivalSignal {
  citizenId: string
  name: string
  displayName: string
  kind: 'real' | 'sim'
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  risk: WorldSurvivalRiskLevel
  warnings: WorldSurvivalWarningKind[]
  actions: RealityAreaSurvivalAction[]
  hospitalizedUntil?: string
}

export interface RealityAreaSurvivalDashboard {
  stableCitizens: number
  warningCitizens: number
  dangerCitizens: number
  hospitalizedCitizens: number
  signals: RealityAreaSurvivalSignal[]
}

export interface RealityAreaDashboard {
  areaId: string
  updatedAt: string
  founderIdentity: {
    citizenId: string
    founderNumber: number
    claimSource: RealityAreaClaimSource
    telegramUserId: string | null
    telegramAccountId: string | null
  }
  population: number
  simPopulation: number
  realPopulation: number
  demand: Record<WorldBusinessKind, number>
  simDemand: Record<WorldBusinessKind, number>
  realDemand: Record<WorldBusinessKind, number>
  supply: Record<WorldBusinessKind, number>
  capacity: Record<WorldBusinessKind, number>
  shortage: Record<WorldBusinessKind, number>
  licenseSlots: Record<WorldBusinessKind, number>
  saturation: Record<WorldBusinessKind, number>
  licenses: Record<WorldBusinessKind, RealityAreaLicenseDashboard>
  jobs: RealityAreaJobsDashboard
  firstBuild: RealityAreaFirstBuildRecommendation[]
  existingBusinesses: RealityAreaBusinessDashboard[]
  citizens: RealityAreaCitizenDashboard[]
  survival: RealityAreaSurvivalDashboard
  ledger: RealityAreaLedgerDashboard
  growth: RealityAreaGrowthDashboard
  settlement: RealityAreaSettlementDashboard
  legacyRoyalty: RealityAreaLegacyRoyaltyDashboard
  founderCovenant: RealityAreaCovenantReview
}

export type MergedRealityAreaDashboard = AreaNeedsDashboard & Pick<RealityAreaDashboard, 'founderIdentity' | 'growth' | 'settlement' | 'legacyRoyalty'>

export interface RealityAreaState {
  version: 1
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: {
    founderCitizenId: string
    founderNumber: number
    label: string
    centerLat: number
    centerLng: number
    radiusKm: number
    claimedAt: string
    source: RealityAreaClaimSource
    telegramUserId?: string
    telegramAccountId?: string
  }
  businesses: RealityAreaBusiness[]
  citizens: RealityAreaCitizen[]
  transactions: RealityAreaTransaction[]
  founderReviewHistory?: RealityAreaCovenantReviewHistoryItem[]
  founderCovenant: RealityAreaCovenantReview
  updatedAt: string
}

export type RealityAreaClaimResult =
  | { ok: true; state: RealityAreaState; restoredExisting: boolean; dashboard?: RealityAreaDashboard }
  | { ok: false; reason: 'missing_identity' | 'not_founder' | 'request_failed' | 'server_rejected'; error: string; code?: string }

export type RealityAreaServerIntentType =
  | 'buildBusiness'
  | 'buyWater'
  | 'buyFood'
  | 'buyHousing'
  | 'visitClinic'
  | 'hireWorker'
  | 'repayDebt'
  | 'buyInsurance'
export type RealityAreaServerPayload = Extract<WorldClientIntentPayload, { type: RealityAreaServerIntentType }>

export interface RealityAreaRefreshPayload {
  type: 'refreshArea'
}

export type RealityAreaApplyResult =
  | { ok: true; state: RealityAreaState; dashboard?: RealityAreaDashboard }
  | { ok: false; reason: 'missing_identity' | 'not_founder' | 'request_failed' | 'server_rejected'; error: string; code?: string }

type RealityAreaAuthorityPayload = RealityAreaServerPayload | RealityAreaCovenantReviewPayload | RealityAreaRefreshPayload

export function founderAreaClaimSource(citizen: Pick<Citizen, 'telegramAccountId' | 'spawnLat' | 'spawnLng'>): RealityAreaClaimSource {
  if (citizen.telegramAccountId) return 'telegram'
  return citizen.spawnLat !== undefined && citizen.spawnLng !== undefined ? 'geolocation' : 'manual'
}

export async function claimRealityFounderArea(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  profile: FounderAreaProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaClaimResult> {
  const ready = readyFounderCredentials(citizen)
  if (!ready.ok) return ready

  try {
    const response = await fetchImpl('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: citizen.citizenId,
        token: citizen.token,
        intent: {
          type: 'claimArea',
          label: profile.areaLabel,
          centerLat: profile.centerLat,
          centerLng: profile.centerLng,
          radiusKm: profile.radiusKm,
          source: profile.claimSource,
        },
      }),
    })
    const data = await response.json() as Record<string, unknown>
    const state = isRealityAreaState(data.state) ? data.state : null
    const dashboard = isRealityAreaDashboard(data.dashboard) ? data.dashboard : undefined
    if (response.ok && data.ok === true && state) {
      return { ok: true, state, restoredExisting: false, dashboard }
    }
    if (response.status === 409 && data.code === 'area_already_claimed' && state) {
      return { ok: true, state, restoredExisting: true, dashboard }
    }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Area claim was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
}

export async function applyRealityFounderAreaIntent(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  payload: RealityAreaServerPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return applyRealityAreaPayload(citizen, payload, fetchImpl)
}

export async function advanceRealityFounderArea(
  _citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  _fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return {
    ok: false,
    reason: 'server_rejected',
    error: 'Reality area clock advances only from the server clock.',
    code: 'server_clock_unauthorized',
  }
}

export async function refreshRealityFounderArea(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return applyRealityAreaPayload(citizen, { type: 'refreshArea' }, fetchImpl)
}

export async function recordRealityFounderCovenantReview(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  payload: RealityAreaCovenantReviewPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityAreaApplyResult> {
  return applyRealityAreaPayload(citizen, payload, fetchImpl)
}

async function applyRealityAreaPayload(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
  payload: RealityAreaAuthorityPayload,
  fetchImpl: typeof fetch,
): Promise<RealityAreaApplyResult> {
  const ready = readyFounderCredentials(citizen)
  if (!ready.ok) return ready

  try {
    const response = await fetchImpl('/api/reality-area', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: citizen.citizenId,
        token: citizen.token,
        intent: payload,
      }),
    })
    const data = await response.json() as Record<string, unknown>
    const state = isRealityAreaState(data.state) ? data.state : null
    const dashboard = isRealityAreaDashboard(data.dashboard) ? data.dashboard : undefined
    if (response.ok && data.ok === true && state) return { ok: true, state, dashboard }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Reality area intent was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
}

export function isRealityAreaServerPayload(payload: WorldClientIntentPayload): payload is RealityAreaServerPayload {
  return payload.type === 'buildBusiness' ||
    payload.type === 'buyWater' ||
    payload.type === 'buyFood' ||
    payload.type === 'buyHousing' ||
    payload.type === 'visitClinic' ||
    payload.type === 'hireWorker' ||
    payload.type === 'repayDebt' ||
    payload.type === 'buyInsurance'
}

export function founderAreaProfileWithServerClaim(
  profile: FounderAreaProfile,
  state: RealityAreaState,
): FounderAreaProfile {
  return {
    ...profile,
    founderId: state.founderCitizenId,
    areaId: state.areaId,
    areaLabel: state.claim.label,
    centerLat: state.claim.centerLat,
    centerLng: state.claim.centerLng,
    radiusKm: state.claim.radiusKm,
    claimSource: state.claim.source,
  }
}

export function realityAreaStateToWorldArea(state: RealityAreaState): WorldArea {
  return {
    id: state.areaId,
    name: state.claim.label,
    now: parseInstant(state.updatedAt),
    claim: {
      founderCitizenId: state.founderCitizenId,
      label: state.claim.label,
      centerLat: state.claim.centerLat,
      centerLng: state.claim.centerLng,
      radiusKm: state.claim.radiusKm,
      claimedAt: parseInstant(state.claim.claimedAt),
      source: state.claim.source,
    },
    citizens: state.citizens.map(realityCitizenToWorldCitizen),
    businesses: state.businesses.map(realityBusinessToWorldBusiness),
    transactions: state.transactions.map(realityTransactionToWorldTransaction),
    founderReviewHistory: state.founderReviewHistory?.map(realityReviewHistoryToWorldReviewHistory),
  }
}

export function mergeRealityAreaDashboardIntoWorldDashboard(
  dashboard: AreaNeedsDashboard,
  serverDashboard: RealityAreaDashboard | undefined,
): AreaNeedsDashboard | MergedRealityAreaDashboard {
  if (!serverDashboard) return dashboard

  const licenseSlots = { ...dashboard.licenseSlots, ...serverDashboard.licenseSlots }
  const saturation = { ...dashboard.saturation, ...serverDashboard.saturation }
  const licenses = { ...dashboard.licenses }
  for (const kind of BUSINESS_KINDS) {
    const serverLicense = serverDashboard.licenses[kind]
    if (!serverLicense) continue
    licenses[kind] = {
      ...licenses[kind],
      slots: serverLicense.slots,
      used: serverLicense.used,
      remaining: serverLicense.remaining,
      saturation: serverLicense.saturation,
    }
  }

  return {
    ...dashboard,
    founderIdentity: { ...serverDashboard.founderIdentity },
    population: serverDashboard.population,
    simPopulation: serverDashboard.simPopulation,
    realPopulation: serverDashboard.realPopulation,
    demand: { ...serverDashboard.demand },
    simDemand: { ...serverDashboard.simDemand },
    realDemand: { ...serverDashboard.realDemand },
    supply: { ...serverDashboard.supply },
    capacity: { ...serverDashboard.capacity },
    shortage: { ...serverDashboard.shortage },
    licenseSlots,
    saturation,
    licenses,
    jobs: mergeRealityAreaJobsDashboard(dashboard.jobs, serverDashboard.jobs),
    firstBuild: serverDashboard.firstBuild.map((recommendation) =>
      mergeFirstBuildRecommendation(recommendation, dashboard.firstBuild.find((candidate) => candidate.kind === recommendation.kind))
    ),
    existingBusinesses: serverDashboard.existingBusinesses.map((business) =>
      mergeRealityAreaBusinessDashboard(business, dashboard.existingBusinesses.find((candidate) => candidate.id === business.id))
    ),
    citizens: serverDashboard.citizens.map((citizen) =>
      mergeRealityAreaCitizenDashboard(citizen, dashboard.citizens.find((candidate) => candidate.id === citizen.id))
    ),
    survival: mergeRealityAreaSurvivalDashboard(serverDashboard.survival),
    ledger: mergeRealityAreaLedgerDashboard(serverDashboard.ledger),
    growth: {
      ...serverDashboard.growth,
      blockers: [...serverDashboard.growth.blockers],
    },
    settlement: {
      ...serverDashboard.settlement,
      blockers: [...serverDashboard.settlement.blockers],
    },
    legacyRoyalty: {
      ...serverDashboard.legacyRoyalty,
      royaltyEligibleBusinessIds: [...serverDashboard.legacyRoyalty.royaltyEligibleBusinessIds],
      royaltyExcludedBusinessIds: [...serverDashboard.legacyRoyalty.royaltyExcludedBusinessIds],
      blockers: [...serverDashboard.legacyRoyalty.blockers],
    },
    founderCovenant: mergeRealityAreaCovenantReview(serverDashboard.founderCovenant),
  }
}

function mergeRealityAreaLedgerDashboard(ledger: RealityAreaLedgerDashboard): AreaLedgerDashboard {
  return {
    transactionCount: ledger.transactionCount,
    totalsByKind: { ...ledger.totalsByKind },
    recentTransactions: ledger.recentTransactions.map((transaction) => ({
      ...transaction,
      at: parseInstant(transaction.at),
    })),
  }
}

function mergeRealityAreaCovenantReview(review: RealityAreaCovenantReview): AreaFounderCovenantDashboard {
  return {
    founderCitizenId: review.founderCitizenId,
    status: review.status,
    nextAction: review.nextAction,
    reviewCadence: review.reviewCadence,
    manualReviewRequired: review.manualReviewRequired,
    replacementEnabled: review.replacementEnabled,
    waitlistHandoffEnabled: review.waitlistHandoffEnabled,
    activityReview: {
      ...review.activityReview,
      checkedAt: parseInstant(review.activityReview.checkedAt),
    },
    reviewQueue: {
      ...review.reviewQueue,
      recommendedActionKinds: [...review.reviewQueue.recommendedActionKinds],
      pendingApprovalKinds: [...review.reviewQueue.pendingApprovalKinds],
      pendingNotificationKinds: [...review.reviewQueue.pendingNotificationKinds],
      blockers: [...review.reviewQueue.blockers],
    },
    reviewInputs: review.reviewInputs.map((item) => ({ ...item })),
    stages: review.stages.map((stage) => ({ ...stage })),
    reviewChecklist: review.reviewChecklist.map((item) => ({ ...item })),
    manualActions: review.manualActions.map((action) => ({
      ...action,
      authorityGate: { ...action.authorityGate },
      clientPayload: action.clientPayload ? { ...action.clientPayload } : null,
    })),
    approvalRequests: review.approvalRequests.map((request) => ({
      ...request,
      at: parseInstant(request.at),
      authorityGate: { ...request.authorityGate },
    })),
    reviewSchedule: mergeRealityAreaCovenantReviewSchedule(review.reviewSchedule),
    latestReview: review.latestReview === null
      ? null
      : {
        ...review.latestReview,
        reviewedAt: parseInstant(review.latestReview.reviewedAt),
        authorityGate: { ...review.latestReview.authorityGate },
        decision: review.latestReview.decision === null ? null : { ...review.latestReview.decision },
        signals: review.latestReview.signals.map(realityCovenantSignalToWorldSignal),
        activityReview: mergeRealityAreaCovenantActivityReview(review.latestReview.activityReview),
        reviewQueue: realityCovenantReviewQueueToWorldQueue(review.latestReview.reviewQueue),
        reviewInputs: review.latestReview.reviewInputs.map((item) => ({ ...item })),
        stages: review.latestReview.stages.map((stage) => ({ ...stage })),
        reviewChecklist: review.latestReview.reviewChecklist.map((item) => ({ ...item })),
        manualActions: review.latestReview.manualActions.map(realityCovenantManualActionToWorldAction),
        approvalRequests: review.latestReview.approvalRequests.map(realityCovenantApprovalRequestToWorldRequest),
        reviewSchedule: review.latestReview.reviewSchedule === null
          ? null
          : mergeRealityAreaCovenantReviewSchedule(review.latestReview.reviewSchedule),
      },
    reviewHistory: review.reviewHistory.map(realityReviewHistoryToWorldReviewHistory),
    notificationDrafts: review.notificationDrafts.map((draft) => ({
      ...draft,
      at: parseInstant(draft.at),
      authorityGate: { ...draft.authorityGate },
    })),
    signals: review.signals.map((signal) => ({
      ...signal,
      businessIds: signal.businessIds ? [...signal.businessIds] : undefined,
      businessKinds: signal.businessKinds ? [...signal.businessKinds] : undefined,
    })),
  }
}

function mergeRealityAreaCovenantReviewSchedule(
  schedule: RealityAreaCovenantReviewSchedule,
): AreaFounderCovenantDashboard['reviewSchedule'] {
  return {
    ...schedule,
    lastReviewAt: schedule.lastReviewAt === null ? null : parseInstant(schedule.lastReviewAt),
    nextWeeklyReviewAt: parseInstant(schedule.nextWeeklyReviewAt),
    nextMonthlyReviewAt: parseInstant(schedule.nextMonthlyReviewAt),
  }
}

function realityReviewHistoryToWorldReviewHistory(
  entry: RealityAreaCovenantReviewHistoryItem,
): FounderCovenantReviewHistoryItem {
  return {
    ...entry,
    at: parseInstant(entry.at),
    authorityGate: { ...entry.authorityGate },
    decision: entry.decision === null ? null : { ...entry.decision },
    signals: entry.signals.map(realityCovenantSignalToWorldSignal),
    activityReview: mergeRealityAreaCovenantActivityReview(entry.activityReview),
    reviewQueue: realityCovenantReviewQueueToWorldQueue(entry.reviewQueue),
    reviewInputs: entry.reviewInputs.map((item) => ({ ...item })),
    stages: entry.stages.map((stage) => ({ ...stage })),
    reviewChecklist: entry.reviewChecklist.map((item) => ({ ...item })),
    manualActions: entry.manualActions.map(realityCovenantManualActionToWorldAction),
    approvalRequests: entry.approvalRequests.map(realityCovenantApprovalRequestToWorldRequest),
    reviewSchedule: entry.reviewSchedule === null ? null : mergeRealityAreaCovenantReviewSchedule(entry.reviewSchedule),
  }
}

function realityCovenantManualActionToWorldAction(
  action: RealityAreaCovenantManualAction,
): FounderCovenantReviewHistoryItem['manualActions'][number] {
  return {
    ...action,
    authorityGate: { ...action.authorityGate },
    clientPayload: action.clientPayload ? { ...action.clientPayload } : null,
  }
}

function realityCovenantApprovalRequestToWorldRequest(
  request: RealityAreaCovenantApprovalRequest,
): FounderCovenantReviewHistoryItem['approvalRequests'][number] {
  return {
    ...request,
    at: parseInstant(request.at),
    authorityGate: { ...request.authorityGate },
  }
}

function realityCovenantReviewQueueToWorldQueue(
  queue: RealityAreaCovenantReviewQueue,
): FounderCovenantReviewHistoryItem['reviewQueue'] {
  return {
    ...queue,
    recommendedActionKinds: [...queue.recommendedActionKinds],
    pendingApprovalKinds: [...queue.pendingApprovalKinds],
    pendingNotificationKinds: [...queue.pendingNotificationKinds],
    blockers: [...queue.blockers],
  }
}

function mergeRealityAreaCovenantActivityReview(
  review: RealityAreaCovenantReview['activityReview'] | null,
): FounderCovenantReviewHistoryItem['activityReview'] {
  return review === null
    ? null
    : {
      ...review,
      checkedAt: parseInstant(review.checkedAt),
    }
}

function realityCovenantSignalToWorldSignal(signal: RealityAreaCovenantSignal): FounderCovenantSignal {
  return {
    ...signal,
    ...(signal.businessIds ? { businessIds: [...signal.businessIds] } : {}),
    ...(signal.businessKinds ? { businessKinds: [...signal.businessKinds] } : {}),
  }
}

function mergeRealityAreaJobsDashboard(
  fallback: AreaJobsDashboard,
  serverJobs: RealityAreaJobsDashboard,
): AreaJobsDashboard {
  return {
    ...fallback,
    employedCitizens: serverJobs.employedCitizens,
    unemployedCitizens: serverJobs.unemployedCitizens,
    hireableSimWorkers: serverJobs.hireableSimWorkers,
    realWorkersRequiringAcceptance: serverJobs.realWorkersRequiringAcceptance,
    openPositions: serverJobs.openPositions,
    understaffedBusinesses: serverJobs.understaffedBusinesses,
    candidates: serverJobs.candidates.map((candidate) => ({ ...candidate })),
  }
}

function mergeRealityAreaBusinessDashboard(
  business: RealityAreaBusinessDashboard,
  fallback: AreaBusinessDashboard | undefined,
): AreaBusinessDashboard {
  return {
    ...fallback,
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    price: business.price,
    wagePerHour: business.wagePerHour,
    quality: business.quality,
    activeStaff: business.activeStaff,
    targetStaff: business.targetStaff,
    openPositions: business.openPositions,
    hourlyCapacity: business.hourlyCapacity,
    ledger: mergeRealityAreaBusinessLedgerDashboard(business.ledger),
    status: business.status,
    alerts: business.alerts.map((alert) => ({ ...alert })),
  }
}

function mergeRealityAreaBusinessLedgerDashboard(
  ledger: RealityAreaBusinessLedgerDashboard,
): AreaBusinessDashboard['ledger'] {
  return {
    transactionCount: ledger.transactionCount,
    revenue: ledger.revenue,
    expenses: ledger.expenses,
    netCashFlow: ledger.netCashFlow,
    wagesPaid: ledger.wagesPaid,
    receivablesIssued: ledger.receivablesIssued,
    recentTransactions: ledger.recentTransactions.map((transaction) => ({
      ...transaction,
      at: parseInstant(transaction.at),
    })),
  }
}

function mergeRealityAreaSurvivalDashboard(survival: RealityAreaSurvivalDashboard): AreaSurvivalDashboard {
  return {
    stableCitizens: survival.stableCitizens,
    warningCitizens: survival.warningCitizens,
    dangerCitizens: survival.dangerCitizens,
    hospitalizedCitizens: survival.hospitalizedCitizens,
    signals: survival.signals.map(mergeRealityAreaSurvivalSignal),
  }
}

function mergeRealityAreaSurvivalSignal(signal: RealityAreaSurvivalSignal): CitizenSurvivalSignal {
  return {
    ...signal,
    actions: signal.actions.map((action) => ({
      ...action,
      blockers: [...action.blockers],
      clientPayload: { ...action.clientPayload },
    })),
    warnings: [...signal.warnings],
    hospitalizedUntil: signal.hospitalizedUntil ? parseInstant(signal.hospitalizedUntil) : undefined,
  }
}

function mergeRealityAreaCitizenDashboard(
  citizen: RealityAreaCitizenDashboard,
  fallback: AreaCitizenDashboard | undefined,
): AreaCitizenDashboard {
  const fallbackDebts = new Map((fallback?.debts ?? []).map((debt) => [debt.id, debt]))
  return {
    ...fallback,
    id: citizen.id,
    name: citizen.name,
    displayName: citizen.displayName,
    kind: citizen.kind,
    simulated: citizen.simulated,
    participantLabel: citizen.participantLabel,
    visualTone: citizen.visualTone,
    state: citizen.state,
    health: citizen.health,
    needs: { ...citizen.needs },
    money: citizen.money,
    debt: citizen.debt,
    debts: citizen.debts.map((debt) => mergeRealityAreaDebtDashboard(debt, fallbackDebts.get(debt.id))),
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    heirCitizenId: citizen.heirCitizenId,
    insuranceActive: citizen.insuranceActive,
    insuranceAction: mergeRealityAreaInsuranceAction(citizen.insuranceAction),
    estateProtection: { ...citizen.estateProtection },
  }
}

function mergeRealityAreaInsuranceAction(
  action: RealityAreaInsuranceActionDashboard,
): AreaCitizenDashboard['insuranceAction'] {
  return {
    ...action,
    clientPayload: action.clientPayload ? { ...action.clientPayload } : null,
    blockers: [...action.blockers],
  }
}

function mergeRealityAreaDebtDashboard(
  debt: RealityAreaCitizenDebtDashboard,
  fallback: AreaCitizenDashboard['debts'][number] | undefined,
): AreaCitizenDashboard['debts'][number] {
  return {
    ...fallback,
    id: debt.id,
    kind: debt.kind,
    creditorId: debt.creditorId,
    amount: debt.amount,
    issuedAt: parseInstant(debt.issuedAt),
    memo: debt.memo,
    repaymentIntent: debt.repaymentIntent,
    clientPayload: debt.clientPayload ? { ...debt.clientPayload } : null,
    recommendedPayment: debt.recommendedPayment,
    maxAffordablePayment: debt.maxAffordablePayment,
    canRepayNow: debt.canRepayNow,
    blockers: [...debt.blockers],
  }
}

function isRealityAreaState(value: unknown): value is RealityAreaState {
  if (!isRecord(value) || value.version !== 1) return false
  if (
    typeof value.areaId !== 'string' ||
    typeof value.founderCitizenId !== 'string' ||
    typeof value.founderNumber !== 'number' ||
    typeof value.balance !== 'number' ||
    !isRecord(value.claim) ||
    !Array.isArray(value.businesses) ||
    !Array.isArray(value.citizens) ||
    !isRealityAreaCovenantReview(value.founderCovenant) ||
    !Array.isArray(value.transactions) ||
    (value.founderReviewHistory !== undefined && (
      !Array.isArray(value.founderReviewHistory) ||
      !value.founderReviewHistory.every(isRealityAreaCovenantReviewHistoryItem)
    ))
  ) {
    return false
  }
  return typeof value.claim.label === 'string' &&
    typeof value.claim.centerLat === 'number' &&
    typeof value.claim.centerLng === 'number' &&
    typeof value.claim.radiusKm === 'number' &&
    typeof value.claim.claimedAt === 'string' &&
    (value.claim.telegramUserId === undefined || typeof value.claim.telegramUserId === 'string') &&
    (value.claim.telegramAccountId === undefined || typeof value.claim.telegramAccountId === 'string') &&
    isClaimSource(value.claim.source)
}

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance']
const TRANSACTION_KINDS: WorldTransactionKind[] = [
  'founder_credit',
  'sim_citizen_credit',
  'business_build',
  'customer_purchase',
  'worker_wage',
  'hospital_bill',
  'insurance_premium',
  'insurance_payout',
  'medical_debt',
  'debt_repayment',
]

function mergeFirstBuildRecommendation(
  recommendation: RealityAreaFirstBuildRecommendation,
  fallback: FirstBuildRecommendation | undefined,
): FirstBuildRecommendation {
  return {
    ...fallback,
    kind: recommendation.kind,
    name: recommendation.name,
    proposedBusinessId: recommendation.proposedBusinessId,
    priority: recommendation.priority,
    action: recommendation.action,
    clientPayload: recommendation.clientPayload,
    score: recommendation.score,
    buildCost: recommendation.buildCost,
    cashShortfall: recommendation.cashShortfall,
    currentDemand: recommendation.currentDemand,
    currentSupply: recommendation.currentSupply,
    licenseSlots: recommendation.licenseSlots,
    licensesRemaining: recommendation.licensesRemaining,
    nextLicensePopulation: recommendation.nextLicensePopulation,
    citizensUntilNextLicense: recommendation.citizensUntilNextLicense,
    founderCanAfford: recommendation.founderCanAfford,
    canBuildNow: recommendation.canBuildNow,
    blockers: [...recommendation.blockers],
    licensed: recommendation.licensed,
    saturated: recommendation.saturated,
    estimatedHourlyRevenue: recommendation.estimatedHourlyRevenue,
    estimatedHourlyWageCost: recommendation.estimatedHourlyWageCost,
    estimatedHourlyProfit: recommendation.estimatedHourlyProfit,
    estimatedPaybackHours: recommendation.estimatedPaybackHours,
    reason: recommendation.reason,
  }
}

function isRealityAreaDashboard(value: unknown): value is RealityAreaDashboard {
  if (!isRecord(value)) return false
  return typeof value.areaId === 'string' &&
    typeof value.updatedAt === 'string' &&
    isRealityAreaFounderIdentity(value.founderIdentity) &&
    typeof value.population === 'number' &&
    typeof value.simPopulation === 'number' &&
    typeof value.realPopulation === 'number' &&
    isKindNumberRecord(value.demand) &&
    isKindNumberRecord(value.simDemand) &&
    isKindNumberRecord(value.realDemand) &&
    isKindNumberRecord(value.supply) &&
    isKindNumberRecord(value.capacity) &&
    isKindNumberRecord(value.shortage) &&
    isKindNumberRecord(value.licenseSlots) &&
    isKindNumberRecord(value.saturation) &&
    isLicenseDashboardRecord(value.licenses) &&
    isRealityAreaJobsDashboard(value.jobs) &&
    Array.isArray(value.firstBuild) &&
    value.firstBuild.every(isRealityAreaFirstBuildRecommendation) &&
    Array.isArray(value.existingBusinesses) &&
    value.existingBusinesses.every(isRealityAreaBusinessDashboard) &&
    Array.isArray(value.citizens) &&
    value.citizens.every(isRealityAreaCitizenDashboard) &&
    isRealityAreaSurvivalDashboard(value.survival) &&
    isRealityAreaLedgerDashboard(value.ledger) &&
    isRealityAreaGrowthDashboard(value.growth) &&
    isRealityAreaSettlementDashboard(value.settlement) &&
    isRealityAreaLegacyRoyaltyDashboard(value.legacyRoyalty) &&
    isRealityAreaCovenantReview(value.founderCovenant)
}

function isRealityAreaFounderIdentity(value: unknown): value is RealityAreaDashboard['founderIdentity'] {
  return isRecord(value) &&
    typeof value.citizenId === 'string' &&
    typeof value.founderNumber === 'number' &&
    isClaimSource(value.claimSource) &&
    (value.telegramUserId === null || typeof value.telegramUserId === 'string') &&
    (value.telegramAccountId === null || typeof value.telegramAccountId === 'string')
}

function isRealityAreaLedgerDashboard(value: unknown): value is RealityAreaLedgerDashboard {
  return isRecord(value) &&
    typeof value.transactionCount === 'number' &&
    isTransactionKindNumberRecord(value.totalsByKind) &&
    Array.isArray(value.recentTransactions) &&
    value.recentTransactions.every(isRealityAreaTransaction)
}

function isRealityAreaGrowthDashboard(value: unknown): value is RealityAreaGrowthDashboard {
  return isRecord(value) &&
    value.channel === 'telegram' &&
    value.inviteLinkEnabled === false &&
    value.inviteTrackingEnabled === false &&
    value.automaticRewardsEnabled === false &&
    value.manualEvidenceRequired === true &&
    typeof value.realPopulation === 'number' &&
    typeof value.simPopulation === 'number' &&
    value.trackedInvites === 0 &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaGrowthBlocker)
}

function isRealityAreaGrowthBlocker(value: unknown): value is RealityAreaGrowthBlocker {
  return value === 'telegram_invite_links_disabled' ||
    value === 'invite_tracking_disabled' ||
    value === 'automatic_growth_rewards_disabled' ||
    value === 'manual_review_required'
}

function isRealityAreaSettlementDashboard(value: unknown): value is RealityAreaSettlementDashboard {
  return isRecord(value) &&
    value.rail === 'ton' &&
    value.mode === 'ledger_only' &&
    value.gameplayLedgerSource === 'reality_server' &&
    typeof value.gameCredits === 'number' &&
    value.payoutEligibleCredits === 0 &&
    value.walletConnectionRequired === false &&
    value.walletConnectionEnabled === false &&
    value.depositsEnabled === false &&
    value.withdrawalsEnabled === false &&
    value.landReservationsEnabled === false &&
    value.landLeasesEnabled === false &&
    value.highFrequencyOnChainTransactions === false &&
    value.manualReviewRequired === true &&
    value.complianceReviewRequired === true &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaSettlementBlocker)
}

function isRealityAreaSettlementBlocker(value: unknown): value is RealityAreaSettlementBlocker {
  return value === 'ton_connect_disabled' ||
    value === 'deposits_disabled' ||
    value === 'withdrawals_disabled' ||
    value === 'land_reservations_disabled' ||
    value === 'leases_disabled' ||
    value === 'manual_payout_review_required' ||
    value === 'compliance_review_required'
}

function isRealityAreaLegacyRoyaltyDashboard(value: unknown): value is RealityAreaLegacyRoyaltyDashboard {
  return isRecord(value) &&
    value.enabled === false &&
    value.payoutEnabled === false &&
    value.replacementWorkflowEnabled === false &&
    value.manualReviewRequired === true &&
    value.appliesTo === 'inherited_founder_created_businesses_only' &&
    typeof value.royaltyRate === 'number' &&
    value.royaltyRate >= 0 &&
    value.royaltyRate <= 1 &&
    value.treasuryAccountId === 'system:founder-legacy-treasury' &&
    Array.isArray(value.royaltyEligibleBusinessIds) &&
    value.royaltyEligibleBusinessIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.royaltyExcludedBusinessIds) &&
    value.royaltyExcludedBusinessIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaLegacyRoyaltyBlocker)
}

function isRealityAreaLegacyRoyaltyBlocker(value: unknown): value is RealityAreaLegacyRoyaltyBlocker {
  return value === 'replacement_workflow_disabled' ||
    value === 'waitlist_handoff_disabled' ||
    value === 'treasury_payout_disabled' ||
    value === 'compliance_review_required'
}

function isRealityAreaCovenantReview(value: unknown): value is RealityAreaCovenantReview {
  return isRecord(value) &&
    typeof value.founderCitizenId === 'string' &&
    isRealityAreaCovenantStatus(value.status) &&
    isRealityAreaCovenantNextAction(value.nextAction) &&
    value.reviewCadence === 'weekly_monthly_manual' &&
    typeof value.manualReviewRequired === 'boolean' &&
    value.replacementEnabled === false &&
    value.waitlistHandoffEnabled === false &&
    isRealityAreaCovenantActivityReview(value.activityReview) &&
    isRealityAreaCovenantReviewQueue(value.reviewQueue) &&
    Array.isArray(value.reviewInputs) &&
    value.reviewInputs.every(isRealityAreaCovenantReviewInput) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRealityAreaCovenantStage) &&
    Array.isArray(value.reviewChecklist) &&
    value.reviewChecklist.every(isRealityAreaCovenantReviewChecklistItem) &&
    Array.isArray(value.manualActions) &&
    value.manualActions.every(isRealityAreaCovenantManualAction) &&
    Array.isArray(value.approvalRequests) &&
    value.approvalRequests.every(isRealityAreaCovenantApprovalRequest) &&
    isRealityAreaCovenantReviewSchedule(value.reviewSchedule) &&
    (value.latestReview === null || isRealityAreaCovenantLatestReview(value.latestReview)) &&
    Array.isArray(value.reviewHistory) &&
    value.reviewHistory.every(isRealityAreaCovenantReviewHistoryItem) &&
    Array.isArray(value.notificationDrafts) &&
    value.notificationDrafts.every(isRealityAreaCovenantNotificationDraft) &&
    Array.isArray(value.signals) &&
    value.signals.every(isRealityAreaCovenantSignal)
}

function isRealityAreaCovenantActivityReview(value: unknown): value is RealityAreaCovenantReview['activityReview'] {
  return isRecord(value) &&
    typeof value.checkedAt === 'string' &&
    typeof value.active === 'boolean' &&
    typeof value.useful === 'boolean' &&
    typeof value.building === 'boolean' &&
    typeof value.staffed === 'boolean' &&
    typeof value.indebted === 'boolean' &&
    typeof value.hospitalized === 'boolean' &&
    typeof value.atRisk === 'boolean' &&
    typeof value.score === 'number'
}

function isRealityAreaCovenantReviewChecklistItem(value: unknown): value is RealityAreaCovenantReviewChecklistItem {
  return isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    isRealityAreaCovenantReviewChecklistStatus(value.status) &&
    typeof value.evidence === 'string'
}

function isRealityAreaCovenantReviewInput(value: unknown): value is RealityAreaCovenantReviewInput {
  return isRecord(value) &&
    isRealityAreaCovenantReviewInputKind(value.kind) &&
    typeof value.label === 'string' &&
    isRealityAreaCovenantReviewInputStatus(value.status) &&
    typeof value.evidence === 'string' &&
    typeof value.manualEvidenceRequired === 'boolean'
}

function isRealityAreaCovenantStage(value: unknown): value is RealityAreaCovenantStage {
  return isRecord(value) &&
    isRealityAreaCovenantStageKind(value.kind) &&
    typeof value.label === 'string' &&
    isRealityAreaCovenantStageStatus(value.status) &&
    typeof value.reason === 'string' &&
    typeof value.requiresMainFounderApproval === 'boolean' &&
    value.manualOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false
}

function isRealityAreaCovenantReviewQueue(value: unknown): value is RealityAreaCovenantReviewQueue {
  return isRecord(value) &&
    value.evidenceOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    isRealityAreaCovenantReviewQueueNextStep(value.nextStep) &&
    typeof value.recordReviewEnabled === 'boolean' &&
    Array.isArray(value.recommendedActionKinds) &&
    value.recommendedActionKinds.every(isRealityAreaCovenantManualActionKind) &&
    Array.isArray(value.pendingApprovalKinds) &&
    value.pendingApprovalKinds.every(isRealityAreaCovenantApprovalRequestKind) &&
    typeof value.pendingApprovalCount === 'number' &&
    Array.isArray(value.pendingNotificationKinds) &&
    value.pendingNotificationKinds.every(isRealityAreaCovenantNotificationDraftKind) &&
    typeof value.pendingNotificationCount === 'number' &&
    typeof value.blockerCount === 'number' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaCovenantApprovalBlocker)
}

function isRealityAreaCovenantManualAction(value: unknown): value is RealityAreaCovenantManualAction {
  return isRecord(value) &&
    isRealityAreaCovenantManualActionKind(value.kind) &&
    typeof value.label === 'string' &&
    typeof value.recommended === 'boolean' &&
    value.requiresApproval === true &&
    value.automationEnabled === false &&
    isRealityAreaCovenantAuthorityGate(value.authorityGate, value.kind) &&
    typeof value.reason === 'string' &&
    (value.clientPayload === null || isRealityAreaCovenantReviewPayload(value.clientPayload))
}

function isRealityAreaCovenantAuthorityGate(
  value: unknown,
  actionKind?: RealityAreaCovenantManualActionKind,
): value is RealityAreaCovenantAuthorityGate {
  if (!isRecord(value) ||
    !isRealityAreaCovenantAuthorityRole(value.requiredRole) ||
    !isRealityAreaCovenantAuthorityStatus(value.status) ||
    value.approvedById !== null ||
    value.approvedAt !== null ||
    typeof value.executionEnabled !== 'boolean'
  ) {
    return false
  }

  if (actionKind === 'record_review') {
    return value.requiredRole === 'area_reviewer' &&
      value.status === 'evidence_only'
  }

  return value.requiredRole === 'main_founder' &&
    value.status === 'approval_required' &&
    value.executionEnabled === false
}

function isRealityAreaCovenantReviewPayload(value: unknown): value is RealityAreaCovenantReviewPayload {
  return isRecord(value) &&
    value.type === 'recordCovenantReview' &&
    value.actionKind === 'record_review' &&
    value.summary === undefined &&
    (typeof value.note === 'string' || value.note === undefined)
}

function isRealityAreaCovenantReviewHistoryItem(value: unknown): value is RealityAreaCovenantReviewHistoryItem {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    typeof value.reviewerId === 'string' &&
    isRealityAreaCovenantManualActionKind(value.actionKind) &&
    typeof value.summary === 'string' &&
    isRealityAreaCovenantEvidenceAuthorityGate(value.authorityGate) &&
    (value.decision === null || isRealityAreaCovenantReviewDecisionSnapshot(value.decision)) &&
    Array.isArray(value.signals) &&
    value.signals.every(isRealityAreaCovenantSignal) &&
    (value.activityReview === null || isRealityAreaCovenantActivityReview(value.activityReview)) &&
    isRealityAreaCovenantReviewQueue(value.reviewQueue) &&
    Array.isArray(value.reviewInputs) &&
    value.reviewInputs.every(isRealityAreaCovenantReviewInput) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRealityAreaCovenantStage) &&
    Array.isArray(value.reviewChecklist) &&
    value.reviewChecklist.every(isRealityAreaCovenantReviewChecklistItem) &&
    Array.isArray(value.manualActions) &&
    value.manualActions.every(isRealityAreaCovenantReviewActionSnapshot) &&
    Array.isArray(value.approvalRequests) &&
    value.approvalRequests.every(isRealityAreaCovenantReviewApprovalRequestSnapshot) &&
    (value.reviewSchedule === null || isRealityAreaCovenantReviewSchedule(value.reviewSchedule))
}

function isRealityAreaCovenantLatestReview(value: unknown): value is RealityAreaCovenantLatestReview {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.reviewedAt === 'string' &&
    typeof value.reviewerId === 'string' &&
    isRealityAreaCovenantManualActionKind(value.actionKind) &&
    typeof value.summary === 'string' &&
    isRealityAreaCovenantEvidenceAuthorityGate(value.authorityGate) &&
    (value.decision === null || isRealityAreaCovenantReviewDecisionSnapshot(value.decision)) &&
    Array.isArray(value.signals) &&
    value.signals.every(isRealityAreaCovenantSignal) &&
    (value.activityReview === null || isRealityAreaCovenantActivityReview(value.activityReview)) &&
    isRealityAreaCovenantReviewQueue(value.reviewQueue) &&
    Array.isArray(value.reviewInputs) &&
    value.reviewInputs.every(isRealityAreaCovenantReviewInput) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRealityAreaCovenantStage) &&
    Array.isArray(value.reviewChecklist) &&
    value.reviewChecklist.every(isRealityAreaCovenantReviewChecklistItem) &&
    Array.isArray(value.manualActions) &&
    value.manualActions.every(isRealityAreaCovenantReviewActionSnapshot) &&
    Array.isArray(value.approvalRequests) &&
    value.approvalRequests.every(isRealityAreaCovenantReviewApprovalRequestSnapshot) &&
    (value.reviewSchedule === null || isRealityAreaCovenantReviewSchedule(value.reviewSchedule)) &&
    value.evidenceOnly === true &&
    value.automationEnabled === false
}

function isRealityAreaCovenantEvidenceAuthorityGate(value: unknown): value is RealityAreaCovenantAuthorityGate {
  return isRecord(value) &&
    value.requiredRole === 'area_reviewer' &&
    value.status === 'evidence_only' &&
    value.approvedById === null &&
    value.approvedAt === null &&
    value.executionEnabled === false
}

function isRealityAreaCovenantReviewDecisionSnapshot(
  value: unknown,
): value is RealityAreaCovenantReviewDecisionSnapshot {
  return isRecord(value) &&
    isRealityAreaCovenantStatus(value.status) &&
    isRealityAreaCovenantNextAction(value.nextAction) &&
    typeof value.manualReviewRequired === 'boolean'
}

function isRealityAreaCovenantReviewSchedule(value: unknown): value is RealityAreaCovenantReviewSchedule {
  return isRecord(value) &&
    (typeof value.lastReviewAt === 'string' || value.lastReviewAt === null) &&
    typeof value.nextWeeklyReviewAt === 'string' &&
    typeof value.nextMonthlyReviewAt === 'string' &&
    typeof value.weeklyReviewDue === 'boolean' &&
    typeof value.monthlyReviewDue === 'boolean' &&
    typeof value.overdue === 'boolean' &&
    value.overdue === (value.weeklyReviewDue || value.monthlyReviewDue) &&
    value.automationEnabled === false
}

function isRealityAreaCovenantReviewActionSnapshot(value: unknown): value is RealityAreaCovenantManualAction {
  return isRealityAreaCovenantManualAction(value) &&
    value.automationEnabled === false &&
    value.clientPayload === null &&
    value.authorityGate.executionEnabled === false
}

function isRealityAreaCovenantApprovalRequest(value: unknown): value is RealityAreaCovenantApprovalRequest {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    isRealityAreaCovenantApprovalRequestKind(value.kind) &&
    typeof value.label === 'string' &&
    typeof value.reason === 'string' &&
    value.status === 'pending_manual_approval' &&
    value.recommended === true &&
    value.requiresApproval === true &&
    value.approvalEnabled === false &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    isRealityAreaCovenantAuthorityGate(value.authorityGate, value.kind) &&
    (typeof value.notificationDraftId === 'string' || value.notificationDraftId === null) &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaCovenantApprovalBlocker)
}

function isRealityAreaCovenantReviewApprovalRequestSnapshot(
  value: unknown,
): value is RealityAreaCovenantApprovalRequest {
  return isRealityAreaCovenantApprovalRequest(value) &&
    value.approvalEnabled === false &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    value.authorityGate.executionEnabled === false
}

function isRealityAreaCovenantNotificationDraft(value: unknown): value is RealityAreaCovenantNotificationDraft {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    isRealityAreaCovenantNotificationDraftKind(value.kind) &&
    value.channel === 'telegram' &&
    typeof value.recipientCitizenId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    value.requiresApproval === true &&
    value.sendEnabled === false &&
    isRealityAreaCovenantAuthorityGate(value.authorityGate)
}

function isRealityAreaCovenantSignal(value: unknown): value is RealityAreaCovenantSignal {
  return isRecord(value) &&
    isRealityAreaCovenantSignalKind(value.kind) &&
    (value.severity === 'info' || value.severity === 'warning' || value.severity === 'critical') &&
    typeof value.message === 'string' &&
    (Array.isArray(value.businessIds) ? value.businessIds.every((id) => typeof id === 'string') : value.businessIds === undefined) &&
    (Array.isArray(value.businessKinds) ? value.businessKinds.every(isBusinessKind) : value.businessKinds === undefined) &&
    (typeof value.amount === 'number' || value.amount === undefined)
}

function isRealityAreaCovenantStatus(value: unknown): value is RealityAreaCovenantStatus {
  return value === 'active' || value === 'watch' || value === 'manual_review'
}

function isRealityAreaCovenantNextAction(value: unknown): value is RealityAreaCovenantNextAction {
  return value === 'none' || value === 'warn_founder' || value === 'manual_review'
}

function isRealityAreaCovenantReviewChecklistStatus(value: unknown): value is RealityAreaCovenantReviewChecklistStatus {
  return value === 'met' || value === 'watch' || value === 'manual_review'
}

function isRealityAreaCovenantReviewInputKind(value: unknown): value is RealityAreaCovenantReviewInputKind {
  return value === 'in_game_activity' ||
    value === 'area_health' ||
    value === 'population_growth' ||
    value === 'external_contribution' ||
    value === 'ideas_feedback' ||
    value === 'review_consistency'
}

function isRealityAreaCovenantReviewInputStatus(value: unknown): value is RealityAreaCovenantReviewInputStatus {
  return value === 'captured' || value === 'watch' || value === 'manual_needed'
}

function isRealityAreaCovenantStageKind(value: unknown): value is RealityAreaCovenantStageKind {
  return value === 'active' ||
    value === 'warning' ||
    value === 'probation' ||
    value === 'removed' ||
    value === 'waitlist_replacement'
}

function isRealityAreaCovenantStageStatus(value: unknown): value is RealityAreaCovenantStageStatus {
  return value === 'current' || value === 'recommended' || value === 'locked'
}

function isRealityAreaCovenantReviewQueueNextStep(value: unknown): value is RealityAreaCovenantReviewQueueNextStep {
  return value === 'record_review' || value === 'main_founder_approval' || value === 'monitor'
}

function isRealityAreaCovenantManualActionKind(value: unknown): value is RealityAreaCovenantManualActionKind {
  return value === 'record_review' ||
    value === 'send_warning' ||
    value === 'start_probation' ||
    value === 'recommend_replacement'
}

function isRealityAreaCovenantApprovalRequestKind(value: unknown): value is RealityAreaCovenantApprovalRequestKind {
  return value === 'send_warning' ||
    value === 'start_probation' ||
    value === 'recommend_replacement'
}

function isRealityAreaCovenantApprovalBlocker(value: unknown): value is RealityAreaCovenantApprovalBlocker {
  return value === 'approval_workflow_disabled' ||
    value === 'telegram_delivery_disabled' ||
    value === 'probation_execution_disabled' ||
    value === 'replacement_disabled' ||
    value === 'waitlist_handoff_disabled'
}

function isRealityAreaCovenantNotificationDraftKind(value: unknown): value is RealityAreaCovenantNotificationDraftKind {
  return value === 'founder_warning' || value === 'manual_review_required'
}

function isRealityAreaCovenantAuthorityRole(value: unknown): value is RealityAreaCovenantAuthorityRole {
  return value === 'area_reviewer' || value === 'main_founder'
}

function isRealityAreaCovenantAuthorityStatus(value: unknown): value is RealityAreaCovenantAuthorityStatus {
  return value === 'evidence_only' || value === 'approval_required'
}

function isRealityAreaCovenantSignalKind(value: unknown): value is RealityAreaCovenantSignalKind {
  return value === 'founder_unavailable' ||
    value === 'no_business_built' ||
    value === 'understaffed_businesses' ||
    value === 'essential_shortage' ||
    value === 'founder_debt' ||
    value === 'review_due'
}

function isKindNumberRecord(value: unknown): value is Record<WorldBusinessKind, number> {
  return isRecord(value) && BUSINESS_KINDS.every((kind) => typeof value[kind] === 'number')
}

function isTransactionKindNumberRecord(value: unknown): value is Record<WorldTransactionKind, number> {
  return isRecord(value) && TRANSACTION_KINDS.every((kind) => typeof value[kind] === 'number')
}

function isLicenseDashboardRecord(value: unknown): value is Record<WorldBusinessKind, RealityAreaLicenseDashboard> {
  return isRecord(value) && BUSINESS_KINDS.every((kind) => isRealityAreaLicenseDashboard(value[kind]))
}

function isRealityAreaLicenseDashboard(value: unknown): value is RealityAreaLicenseDashboard {
  return isRecord(value) &&
    typeof value.slots === 'number' &&
    typeof value.used === 'number' &&
    typeof value.remaining === 'number' &&
    typeof value.saturation === 'number'
}

function isRealityAreaJobsDashboard(value: unknown): value is RealityAreaJobsDashboard {
  return isRecord(value) &&
    typeof value.employedCitizens === 'number' &&
    typeof value.unemployedCitizens === 'number' &&
    typeof value.hireableSimWorkers === 'number' &&
    typeof value.realWorkersRequiringAcceptance === 'number' &&
    typeof value.openPositions === 'number' &&
    typeof value.understaffedBusinesses === 'number' &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isRealityAreaWorkerCandidateDashboard)
}

function isRealityAreaBusinessDashboard(value: unknown): value is RealityAreaBusinessDashboard {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isBusinessKind(value.kind) &&
    typeof value.ownerId === 'string' &&
    typeof value.cash === 'number' &&
    typeof value.price === 'number' &&
    typeof value.wagePerHour === 'number' &&
    typeof value.quality === 'number' &&
    typeof value.activeStaff === 'number' &&
    typeof value.targetStaff === 'number' &&
    typeof value.openPositions === 'number' &&
    typeof value.hourlyCapacity === 'number' &&
    isRealityAreaBusinessLedgerDashboard(value.ledger) &&
    isBusinessStatus(value.status) &&
    Array.isArray(value.alerts) &&
    value.alerts.every(isBusinessAlert)
}

function isRealityAreaBusinessLedgerDashboard(value: unknown): value is RealityAreaBusinessLedgerDashboard {
  return isRecord(value) &&
    typeof value.transactionCount === 'number' &&
    typeof value.revenue === 'number' &&
    typeof value.expenses === 'number' &&
    typeof value.netCashFlow === 'number' &&
    typeof value.wagesPaid === 'number' &&
    typeof value.receivablesIssued === 'number' &&
    Array.isArray(value.recentTransactions) &&
    value.recentTransactions.every(isRealityAreaTransaction)
}

function isRealityAreaTransaction(value: unknown): value is RealityAreaTransaction {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    isTransactionKind(value.kind) &&
    typeof value.fromId === 'string' &&
    typeof value.toId === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.memo === 'string'
}

function isTransactionKind(value: unknown): value is WorldTransactionKind {
  return TRANSACTION_KINDS.includes(value as WorldTransactionKind)
}

function isBusinessAlert(value: unknown): value is AreaBusinessAlert {
  return isRecord(value) &&
    isBusinessAlertKind(value.kind) &&
    (value.severity === 'warning' || value.severity === 'critical')
}

function isRealityAreaCitizenDashboard(value: unknown): value is RealityAreaCitizenDashboard {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    (value.state === 'active' || value.state === 'hospitalized') &&
    typeof value.health === 'number' &&
    isRealityAreaNeeds(value.needs) &&
    typeof value.money === 'number' &&
    typeof value.debt === 'number' &&
    Array.isArray(value.debts) &&
    value.debts.every(isRealityAreaCitizenDebtDashboard) &&
    (typeof value.homeBusinessId === 'string' || value.homeBusinessId === undefined) &&
    (typeof value.jobBusinessId === 'string' || value.jobBusinessId === undefined) &&
    (typeof value.insuranceBusinessId === 'string' || value.insuranceBusinessId === undefined) &&
    (typeof value.heirCitizenId === 'string' || value.heirCitizenId === undefined) &&
    typeof value.insuranceActive === 'boolean' &&
    isRealityAreaInsuranceAction(value.insuranceAction) &&
    isRealityAreaEstateProtection(value.estateProtection)
}

function isRealityAreaInsuranceAction(value: unknown): value is RealityAreaInsuranceActionDashboard {
  return isRecord(value) &&
    value.intent === 'buyInsurance' &&
    (isRealityAreaBuyInsurancePayload(value.clientPayload) || value.clientPayload === null) &&
    (typeof value.insuranceBusinessId === 'string' || value.insuranceBusinessId === null) &&
    (typeof value.premium === 'number' || value.premium === null) &&
    typeof value.available === 'boolean' &&
    typeof value.canAfford === 'boolean' &&
    typeof value.canBuyNow === 'boolean' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isInsuranceActionBlocker)
}

function isRealityAreaEstateProtection(value: unknown): value is RealityAreaEstateProtectionDashboard {
  return isRecord(value) &&
    value.enabled === false &&
    (typeof value.namedHeirCitizenId === 'string' || value.namedHeirCitizenId === null) &&
    (typeof value.namedHeirName === 'string' || value.namedHeirName === null) &&
    typeof value.protectedByInsurance === 'boolean' &&
    value.status === 'disabled_until_death_enabled'
}

function isRealityAreaCitizenDebtDashboard(value: unknown): value is RealityAreaCitizenDebtDashboard {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    value.kind === 'medical' &&
    typeof value.creditorId === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.issuedAt === 'string' &&
    typeof value.memo === 'string' &&
    value.repaymentIntent === 'repayDebt' &&
    (isRealityAreaRepayDebtPayload(value.clientPayload) || value.clientPayload === null) &&
    typeof value.recommendedPayment === 'number' &&
    typeof value.maxAffordablePayment === 'number' &&
    typeof value.canRepayNow === 'boolean' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isDebtRepaymentBlocker)
}

function isRealityAreaSurvivalDashboard(value: unknown): value is RealityAreaSurvivalDashboard {
  return isRecord(value) &&
    typeof value.stableCitizens === 'number' &&
    typeof value.warningCitizens === 'number' &&
    typeof value.dangerCitizens === 'number' &&
    typeof value.hospitalizedCitizens === 'number' &&
    Array.isArray(value.signals) &&
    value.signals.every(isRealityAreaSurvivalSignal)
}

function isRealityAreaSurvivalSignal(value: unknown): value is RealityAreaSurvivalSignal {
  if (!isRecord(value)) return false
  return typeof value.citizenId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    isSurvivalRisk(value.risk) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isSurvivalWarning) &&
    Array.isArray(value.actions) &&
    value.actions.every(isRealityAreaSurvivalAction) &&
    (typeof value.hospitalizedUntil === 'string' || value.hospitalizedUntil === undefined)
}

function isRealityAreaSurvivalAction(value: unknown): value is RealityAreaSurvivalAction {
  return isRecord(value) &&
    isSurvivalWarning(value.warning) &&
    isSurvivalActionIntent(value.intent) &&
    isRealityAreaSurvivalPayload(value.clientPayload) &&
    isBusinessKind(value.serviceKind) &&
    value.serviceKind !== 'insurance' &&
    typeof value.available === 'boolean' &&
    (typeof value.lowestPrice === 'number' || value.lowestPrice === null) &&
    typeof value.canAfford === 'boolean' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isSurvivalActionBlocker)
}

function isRealityAreaSurvivalPayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: WorldSurvivalActionIntent }> {
  return isRecord(value) && isSurvivalActionIntent(value.type)
}

function isRealityAreaNeeds(value: unknown): value is RealityAreaNeeds {
  return isRecord(value) &&
    typeof value.hunger === 'number' &&
    typeof value.hydration === 'number' &&
    typeof value.energy === 'number' &&
    typeof value.hygiene === 'number' &&
    typeof value.fun === 'number'
}

function isRealityAreaWorkerCandidateDashboard(value: unknown): value is RealityAreaWorkerCandidateDashboard {
  if (!isRecord(value)) return false
  return typeof value.citizenId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.kind === 'real' || value.kind === 'sim') &&
    typeof value.simulated === 'boolean' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real') &&
    isWorkerCandidateAction(value.action) &&
    (typeof value.recommendedBusinessId === 'string' || value.recommendedBusinessId === null) &&
    (typeof value.recommendedBusinessName === 'string' || value.recommendedBusinessName === null) &&
    (isBusinessKind(value.recommendedBusinessKind) || value.recommendedBusinessKind === null) &&
    (isRealityAreaHirePayload(value.clientPayload) || value.clientPayload === null)
}

function isRealityAreaFirstBuildRecommendation(value: unknown): value is RealityAreaFirstBuildRecommendation {
  if (!isRecord(value)) return false
  return isBusinessKind(value.kind) &&
    typeof value.name === 'string' &&
    (typeof value.proposedBusinessId === 'string' || value.proposedBusinessId === null) &&
    isFirstBuildPriority(value.priority) &&
    isFirstBuildAction(value.action) &&
    typeof value.buildCost === 'number' &&
    typeof value.cashShortfall === 'number' &&
    typeof value.currentDemand === 'number' &&
    typeof value.currentSupply === 'number' &&
    typeof value.licenseSlots === 'number' &&
    typeof value.licensesRemaining === 'number' &&
    typeof value.nextLicensePopulation === 'number' &&
    typeof value.citizensUntilNextLicense === 'number' &&
    typeof value.saturation === 'number' &&
    typeof value.founderCanAfford === 'boolean' &&
    typeof value.canBuildNow === 'boolean' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isFirstBuildBlocker) &&
    typeof value.licensed === 'boolean' &&
    typeof value.saturated === 'boolean' &&
    typeof value.score === 'number' &&
    typeof value.estimatedHourlyRevenue === 'number' &&
    typeof value.estimatedHourlyWageCost === 'number' &&
    typeof value.estimatedHourlyProfit === 'number' &&
    (typeof value.estimatedPaybackHours === 'number' || value.estimatedPaybackHours === null) &&
    (isRealityAreaBuildPayload(value.clientPayload) || value.clientPayload === null) &&
    typeof value.reason === 'string'
}

function isFirstBuildPriority(value: unknown): value is FirstBuildRecommendation['priority'] {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
}

function isFirstBuildAction(value: unknown): value is FirstBuildRecommendation['action'] {
  return value === 'claim_area' ||
    value === 'build_now' ||
    value === 'save_credits' ||
    value === 'grow_demand' ||
    value === 'wait_for_demand' ||
    value === 'recover_first'
}

function isFirstBuildBlocker(value: unknown): value is FirstBuildBlocker {
  return value === 'area_unclaimed' ||
    value === 'insufficient_funds' ||
    value === 'license_unavailable' ||
    value === 'actor_unavailable'
}

function isRealityAreaBuildPayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'buildBusiness' }> {
  return isRecord(value) &&
    value.type === 'buildBusiness' &&
    isBusinessKind(value.businessKind) &&
    typeof value.businessId === 'string' &&
    (typeof value.name === 'string' || value.name === undefined)
}

function isRealityAreaHirePayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'hireWorker' }> {
  return isRecord(value) &&
    value.type === 'hireWorker' &&
    typeof value.businessId === 'string' &&
    typeof value.workerCitizenId === 'string'
}

function isRealityAreaRepayDebtPayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'repayDebt' }> {
  return isRecord(value) &&
    value.type === 'repayDebt' &&
    typeof value.debtId === 'string' &&
    typeof value.amount === 'number'
}

function isRealityAreaBuyInsurancePayload(value: unknown): value is Extract<WorldClientIntentPayload, { type: 'buyInsurance' }> {
  return isRecord(value) &&
    value.type === 'buyInsurance' &&
    typeof value.insuranceBusinessId === 'string'
}

function isDebtRepaymentBlocker(value: unknown): value is AreaDebtRepaymentBlocker {
  return value === 'actor_unavailable' || value === 'insufficient_funds'
}

function isInsuranceActionBlocker(value: unknown): value is AreaInsuranceActionBlocker {
  return value === 'actor_unavailable' ||
    value === 'already_insured' ||
    value === 'service_unavailable' ||
    value === 'insufficient_funds'
}

function isWorkerCandidateAction(value: unknown): value is AreaWorkerCandidateAction {
  return value === 'hire_now' ||
    value === 'requires_acceptance' ||
    value === 'waiting_for_position' ||
    value === 'founder_unavailable'
}

function isBusinessStatus(value: unknown): value is AreaBusinessStatus {
  return value === 'stable' || value === 'warning' || value === 'critical'
}

function isSurvivalRisk(value: unknown): value is WorldSurvivalRiskLevel {
  return value === 'stable' || value === 'warning' || value === 'danger' || value === 'hospitalized'
}

function isSurvivalWarning(value: unknown): value is WorldSurvivalWarningKind {
  return value === 'water' || value === 'food' || value === 'rest' || value === 'health'
}

function isSurvivalActionIntent(value: unknown): value is WorldSurvivalActionIntent {
  return value === 'buyWater' || value === 'buyFood' || value === 'buyHousing' || value === 'visitClinic'
}

function isSurvivalActionBlocker(value: unknown): value is WorldSurvivalActionBlocker {
  return value === 'service_unavailable' || value === 'insufficient_funds'
}

function isBusinessAlertKind(value: unknown): value is AreaBusinessAlert['kind'] {
  return value === 'understaffed' ||
    value === 'cash_risk' ||
    value === 'owner_unavailable' ||
    value === 'quality_degraded' ||
    value === 'negative_cash_flow'
}

function isBusinessKind(value: unknown): value is WorldBusinessKind {
  return BUSINESS_KINDS.includes(value as WorldBusinessKind)
}

function realityCitizenToWorldCitizen(citizen: RealityAreaCitizen): WorldCitizen {
  return {
    id: citizen.id,
    name: citizen.name,
    kind: citizen.kind,
    money: citizen.money,
    debt: citizen.debt,
    debts: citizen.debts?.map(realityDebtToWorldDebt),
    needs: { ...citizen.needs },
    health: citizen.health,
    state: citizen.state.kind === 'hospitalized'
      ? { kind: 'hospitalized', until: parseInstant(citizen.state.until) }
      : { kind: 'active' },
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    insurancePaidUntil: parseOptionalInstant(citizen.insurancePaidUntil),
    heirCitizenId: citizen.heirCitizenId,
  }
}

function realityDebtToWorldDebt(debt: RealityAreaDebt): WorldDebt {
  return {
    ...debt,
    issuedAt: parseInstant(debt.issuedAt),
  }
}

function realityBusinessToWorldBusiness(business: RealityAreaBusiness): WorldBusiness {
  return {
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    staffCitizenIds: [...business.staffCitizenIds],
    price: business.price,
    wagePerHour: business.wagePerHour,
    quality: business.quality,
    createdBy: business.createdBy,
  }
}

function realityTransactionToWorldTransaction(transaction: RealityAreaTransaction): WorldTransaction {
  return {
    ...transaction,
    at: parseInstant(transaction.at),
  }
}

function parseInstant(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseOptionalInstant(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isClaimSource(value: unknown): value is RealityAreaClaimSource {
  return value === 'manual' || value === 'ip' || value === 'geolocation' || value === 'telegram'
}

function readyFounderCredentials(
  citizen: Pick<Citizen, 'citizenId' | 'token' | 'founderNumber'>,
): { ok: true } | { ok: false; reason: 'missing_identity' | 'not_founder'; error: string } {
  if (!citizen.citizenId || !citizen.token) {
    return { ok: false, reason: 'missing_identity', error: 'Connect to the world first.' }
  }
  if (citizen.founderNumber <= 0) {
    return { ok: false, reason: 'not_founder', error: 'Founder seat required.' }
  }
  return { ok: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
