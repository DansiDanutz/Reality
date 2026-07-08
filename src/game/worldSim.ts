import { clamp } from './engine'
import type { Needs } from './types'

export type WorldBusinessKind = 'water' | 'food' | 'housing' | 'clinic' | 'insurance' | 'workers_hall'
export type WorldCitizenKind = 'sim' | 'real'
export type AreaClaimSource = 'manual' | 'ip' | 'geolocation' | 'telegram'

export type WorldCitizenState =
  | { kind: 'active' }
  | { kind: 'hospitalized'; until: number }

export type WorldDebtKind = 'medical'

export interface WorldDebt {
  id: string
  kind: WorldDebtKind
  creditorId: string
  amount: number
  issuedAt: number
  memo: string
}

export interface WorldCitizen {
  id: string
  name: string
  kind: WorldCitizenKind
  money: number
  debt: number
  debts?: WorldDebt[]
  needs: Needs
  health: number
  state: WorldCitizenState
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  insurancePaidUntil?: number
  heirCitizenId?: string
}

export interface WorldBusiness {
  id: string
  name: string
  kind: WorldBusinessKind
  ownerId: string
  cash: number
  staffCitizenIds: string[]
  price?: number
  wagePerHour?: number
  quality?: number
  createdBy?: string
  inheritedFrom?: string
}

export interface WorldAreaClaim {
  founderCitizenId: string
  label: string
  centerLat: number
  centerLng: number
  radiusKm: number
  claimedAt: number
  source: AreaClaimSource
}

export type WorldTransactionKind =
  | 'founder_credit'
  | 'sim_citizen_credit'
  | 'customer_purchase'
  | 'business_build'
  | 'worker_wage'
  | 'hospital_bill'
  | 'insurance_premium'
  | 'insurance_payout'
  | 'medical_debt'
  | 'debt_repayment'
  | 'workers_hall_build'

export type WorldPayoutEligibility = 'game_only' | 'payout_eligible'

export interface WorldTransaction {
  id: string
  at: number
  kind: WorldTransactionKind
  payoutEligibility: WorldPayoutEligibility
  fromId: string
  toId: string
  amount: number
  memo: string
}

export type WorldAreaEventKind = 'sim_citizen_departure'
export type WorldAreaEventSeverity = 'info' | 'warning' | 'critical'
export type WorldDepartureReason = 'water_unserved' | 'food_unserved' | 'housing_unserved'
export type WorldDepartureServiceKind = 'water' | 'food' | 'housing'

export interface WorldAreaEvent {
  id: string
  at: number
  kind: WorldAreaEventKind
  severity: WorldAreaEventSeverity
  citizenId: string
  citizenName: string
  simulated: boolean
  reason: WorldDepartureReason
  serviceKind: WorldDepartureServiceKind
  health: number
  needs: Needs
  message: string
}

export interface WorldArea {
  id: string
  name: string
  now: number
  claim?: WorldAreaClaim
  citizens: WorldCitizen[]
  businesses: WorldBusiness[]
  transactions: WorldTransaction[]
  areaEvents?: WorldAreaEvent[]
  founderReviewHistory?: FounderCovenantReviewHistoryItem[]
}

export interface WorldAreaSummary {
  purchases: number
  wagesPaid: number
  hospitalizations: number
  recoveries: number
  citizensLeft: number
  insurancePremiumsPaid: number
  insurancePoliciesLapsed: number
  debtsIssued: number
  revenueByBusiness: Record<string, number>
}

export interface AdvanceWorldAreaResult {
  area: WorldArea
  summary: WorldAreaSummary
}

export type FirstBuildPriority = 'critical' | 'high' | 'medium' | 'low'
export type FirstBuildAction = 'claim_area' | 'build_now' | 'save_credits' | 'grow_demand' | 'wait_for_demand' | 'recover_first'
export type FirstBuildBlocker = 'area_unclaimed' | 'insufficient_funds' | 'license_unavailable' | 'actor_unavailable'
export type WorldParticipantLabel = 'Sim Citizen' | 'Real Citizen'
export type WorldParticipantVisualTone = 'simulated' | 'real'

export interface FirstBuildRecommendation {
  kind: WorldBusinessKind
  name: string
  proposedBusinessId: string | null
  priority: FirstBuildPriority
  action: FirstBuildAction
  clientPayload: Extract<WorldClientIntentPayload, { type: 'buildBusiness' }> | null
  score: number
  buildCost: number
  cashShortfall: number
  currentDemand: number
  currentSupply: number
  licenseSlots: number
  licensesRemaining: number
  nextLicensePopulation: number
  citizensUntilNextLicense: number
  founderCanAfford: boolean
  canBuildNow: boolean
  blockers: FirstBuildBlocker[]
  licensed: boolean
  saturated: boolean
  estimatedHourlyRevenue: number
  estimatedHourlyWageCost: number
  estimatedHourlyProfit: number
  estimatedPaybackHours: number | null
  reason: string
}

export interface AreaJobsDashboard {
  employedCitizens: number
  unemployedCitizens: number
  hireableSimWorkers: number
  realWorkersRequiringAcceptance: number
  openPositions: number
  understaffedBusinesses: number
  workersHallCount: number
  workersHallRequired: boolean
  candidates: AreaWorkerCandidateDashboard[]
}

export type AreaWorkerCandidateAction = 'hire_now' | 'requires_acceptance' | 'waiting_for_position' | 'founder_unavailable'

export interface AreaWorkerCandidateDashboard {
  citizenId: string
  name: string
  displayName: string
  kind: WorldCitizenKind
  simulated: boolean
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
  action: AreaWorkerCandidateAction
  recommendedBusinessId: string | null
  recommendedBusinessName: string | null
  recommendedBusinessKind: WorldBusinessKind | null
  clientPayload: Extract<WorldClientIntentPayload, { type: 'hireWorker' }> | null
}

export interface AreaLicenseDashboard {
  slots: number
  used: number
  remaining: number
  saturation: number
  nextUnlockPopulation: number
  citizensUntilNextUnlock: number
}

export type WorldSurvivalRiskLevel = 'stable' | 'warning' | 'danger' | 'hospitalized'
export type WorldSurvivalWarningKind = 'water' | 'food' | 'rest' | 'health'
export type WorldSurvivalActionIntent = 'buyWater' | 'buyFood' | 'buyHousing' | 'visitClinic'
export type WorldSurvivalActionBlocker = 'service_unavailable' | 'insufficient_funds'

export interface AreaEventDashboard extends Omit<WorldAreaEvent, 'at'> {
  at: number | string
  displayName: string
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
}

export interface AreaEventsDashboard {
  eventCount: number
  simDepartures: number
  warningEvents: number
  criticalEvents: number
  recentEvents: AreaEventDashboard[]
}

export type WorldClientIntentPayload =
  | {
    type: 'buildBusiness'
    businessKind: WorldBusinessKind
    businessId: string
    name?: string
  }
  | {
    type: WorldSurvivalActionIntent
  }
  | {
    type: 'hireWorker'
    businessId: string
    workerCitizenId: string
  }
  | {
    type: 'buyInsurance'
    insuranceBusinessId: string
  }
  | {
    type: 'repayDebt'
    debtId: string
    amount: number
  }

export interface CitizenSurvivalAction {
  warning: WorldSurvivalWarningKind
  intent: WorldSurvivalActionIntent
  clientPayload: Extract<WorldClientIntentPayload, { type: WorldSurvivalActionIntent }>
  serviceKind: Exclude<WorldBusinessKind, 'insurance'>
  available: boolean
  lowestPrice: number | null
  canAfford: boolean
  blockers: WorldSurvivalActionBlocker[]
}

export interface CitizenSurvivalSignal {
  citizenId: string
  name: string
  displayName: string
  kind: WorldCitizenKind
  simulated: boolean
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
  risk: WorldSurvivalRiskLevel
  warnings: WorldSurvivalWarningKind[]
  actions: CitizenSurvivalAction[]
  hospitalizedUntil?: number
}

export interface AreaSurvivalDashboard {
  stableCitizens: number
  warningCitizens: number
  dangerCitizens: number
  hospitalizedCitizens: number
  signals: CitizenSurvivalSignal[]
}

export interface AreaBusinessDashboard {
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
  ledger: AreaBusinessLedgerDashboard
  status: AreaBusinessStatus
  alerts: AreaBusinessAlert[]
}

export type AreaBusinessStatus = 'stable' | 'warning' | 'critical'
export type AreaBusinessAlertSeverity = 'warning' | 'critical'
export type AreaBusinessAlertKind =
  | 'understaffed'
  | 'cash_risk'
  | 'owner_unavailable'
  | 'quality_degraded'
  | 'negative_cash_flow'

export interface AreaBusinessAlert {
  kind: AreaBusinessAlertKind
  severity: AreaBusinessAlertSeverity
}

export interface AreaBusinessLedgerDashboard {
  transactionCount: number
  revenue: number
  expenses: number
  netCashFlow: number
  wagesPaid: number
  receivablesIssued: number
  recentTransactions: AreaTransactionDashboard[]
}

export type AreaDebtRepaymentBlocker = 'actor_unavailable' | 'insufficient_funds'

export interface AreaDebtDashboard {
  id: string
  kind: WorldDebtKind
  creditorId: string
  amount: number
  issuedAt: number
  memo: string
  repaymentIntent: 'repayDebt'
  clientPayload: Extract<WorldClientIntentPayload, { type: 'repayDebt' }> | null
  recommendedPayment: number
  maxAffordablePayment: number
  canRepayNow: boolean
  blockers: AreaDebtRepaymentBlocker[]
}

export type AreaInsuranceActionBlocker =
  | 'actor_unavailable'
  | 'already_insured'
  | 'service_unavailable'
  | 'insufficient_funds'

export type AreaEstateProtectionBlocker =
  | 'death_disabled'
  | 'heir_naming_disabled'
  | 'estate_transfer_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_review_required'

export interface AreaInsuranceActionDashboard {
  intent: 'buyInsurance'
  clientPayload: Extract<WorldClientIntentPayload, { type: 'buyInsurance' }> | null
  insuranceBusinessId: string | null
  premium: number | null
  available: boolean
  canAfford: boolean
  canBuyNow: boolean
  blockers: AreaInsuranceActionBlocker[]
}

export interface AreaEstateProtectionDashboard {
  enabled: false
  namingEnabled: false
  transferEnabled: false
  waitlistFallbackEnabled: false
  manualReviewRequired: true
  namedHeirCitizenId: string | null
  namedHeirName: string | null
  protectedByInsurance: boolean
  status: 'disabled_until_death_enabled'
  blockers: AreaEstateProtectionBlocker[]
}

export interface AreaCitizenDashboard {
  id: string
  name: string
  displayName: string
  kind: WorldCitizenKind
  simulated: boolean
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
  state: WorldCitizenState['kind']
  health: number
  needs: Needs
  money: number
  debt: number
  debts: AreaDebtDashboard[]
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  heirCitizenId?: string
  insuranceActive: boolean
  insuranceAction: AreaInsuranceActionDashboard
  estateProtection: AreaEstateProtectionDashboard
}

export interface AreaTransactionDashboard {
  id: string
  at: number
  kind: WorldTransactionKind
  payoutEligibility: WorldPayoutEligibility
  fromId: string
  toId: string
  amount: number
  memo: string
}

export interface AreaLedgerDashboard {
  transactionCount: number
  totalsByKind: Record<WorldTransactionKind, number>
  payoutClassification: AreaLedgerPayoutClassificationDashboard
  recentTransactions: AreaTransactionDashboard[]
}

export interface AreaLedgerPayoutClassificationDashboard {
  gameOnlyTransactionCount: number
  gameOnlyAmount: number
  payoutEligibleTransactionCount: number
  payoutEligibleAmount: number
  manualPayoutReviewRequired: true
  realWithdrawalEligible: false
}

export type FounderCovenantStatus = 'unclaimed' | 'active' | 'watch' | 'manual_review'
export type FounderCovenantNextAction = 'claim_area' | 'none' | 'warn_founder' | 'manual_review'
export type FounderCovenantSignalSeverity = 'info' | 'warning' | 'critical'
export type FounderCovenantReviewChecklistStatus = 'met' | 'watch' | 'manual_review'
export type FounderCovenantReviewQueueNextStep = 'record_review' | 'main_founder_approval' | 'monitor'
export type FounderCovenantReviewInputKind =
  | 'in_game_activity'
  | 'area_health'
  | 'population_growth'
  | 'external_contribution'
  | 'ideas_feedback'
  | 'review_consistency'
export type FounderCovenantManualEvidenceKind = Extract<
  FounderCovenantReviewInputKind,
  'population_growth' | 'external_contribution' | 'ideas_feedback'
>
export type FounderCovenantReviewInputStatus = 'captured' | 'watch' | 'manual_needed'
export type FounderCovenantStageKind = 'active' | 'warning' | 'probation' | 'removed' | 'waitlist_replacement'
export type FounderCovenantStageStatus = 'current' | 'recommended' | 'locked'
export type FounderCovenantManualActionKind =
  | 'record_review'
  | 'send_warning'
  | 'start_probation'
  | 'recommend_replacement'
export type FounderCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'sim_departure'
  | 'founder_debt'
  | 'review_due'

export interface FounderCovenantSignal {
  kind: FounderCovenantSignalKind
  severity: FounderCovenantSignalSeverity
  message: string
  businessIds?: string[]
  businessKinds?: WorldBusinessKind[]
  amount?: number
}

export interface FounderCovenantActivityReview {
  checkedAt: number
  active: boolean
  useful: boolean
  building: boolean
  staffed: boolean
  indebted: boolean
  hospitalized: boolean
  atRisk: boolean
  score: number
}

export interface FounderCovenantReviewChecklistItem {
  key: string
  label: string
  status: FounderCovenantReviewChecklistStatus
  evidence: string
}

export interface FounderCovenantReviewInput {
  kind: FounderCovenantReviewInputKind
  label: string
  status: FounderCovenantReviewInputStatus
  evidence: string
  manualEvidenceRequired: boolean
}

export interface FounderCovenantStage {
  kind: FounderCovenantStageKind
  label: string
  status: FounderCovenantStageStatus
  reason: string
  requiresMainFounderApproval: boolean
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

export interface FounderCovenantReviewQueue {
  evidenceOnly: true
  automationEnabled: false
  executionEnabled: false
  nextStep: FounderCovenantReviewQueueNextStep
  recordReviewEnabled: boolean
  recommendedActionKinds: readonly FounderCovenantManualActionKind[]
  pendingApprovalKinds: readonly FounderCovenantApprovalRequestKind[]
  pendingApprovalCount: number
  pendingNotificationKinds: readonly FounderCovenantNotificationDraftKind[]
  pendingNotificationCount: number
  blockerCount: number
  blockers: readonly FounderCovenantApprovalBlocker[]
}

export interface FounderCovenantManualActionClientPayload {
  type: 'recordCovenantReview'
  actionKind: 'record_review'
  note?: string
  evidenceKinds?: readonly FounderCovenantManualEvidenceKind[]
}

export type FounderCovenantAuthorityRole = 'area_reviewer' | 'main_founder'
export type FounderCovenantAuthorityStatus = 'evidence_only' | 'approval_required'

export interface FounderCovenantAuthorityGate {
  requiredRole: FounderCovenantAuthorityRole
  status: FounderCovenantAuthorityStatus
  approvedById: null
  approvedAt: null
  executionEnabled: boolean
}

export interface FounderCovenantManualAction {
  kind: FounderCovenantManualActionKind
  label: string
  recommended: boolean
  requiresApproval: true
  automationEnabled: false
  authorityGate: FounderCovenantAuthorityGate
  reason: string
  clientPayload: FounderCovenantManualActionClientPayload | null
}

export type FounderCovenantApprovalRequestKind = Exclude<FounderCovenantManualActionKind, 'record_review'>
export type FounderCovenantApprovalRequestStatus = 'pending_manual_approval'
export type FounderCovenantApprovalBlocker =
  | 'approval_workflow_disabled'
  | 'telegram_delivery_disabled'
  | 'probation_execution_disabled'
  | 'replacement_disabled'
  | 'waitlist_handoff_disabled'

export interface FounderCovenantApprovalRequest {
  id: string
  at: number
  kind: FounderCovenantApprovalRequestKind
  label: string
  reason: string
  status: FounderCovenantApprovalRequestStatus
  recommended: true
  requiresApproval: true
  approvalEnabled: false
  automationEnabled: false
  executionEnabled: false
  authorityGate: FounderCovenantAuthorityGate
  notificationDraftId: string | null
  blockers: readonly FounderCovenantApprovalBlocker[]
}

export interface FounderCovenantReviewHistoryItem {
  id: string
  at: number
  reviewerId: string
  actionKind: FounderCovenantManualActionKind
  summary: string
  authorityGate: FounderCovenantAuthorityGate
  decision: FounderCovenantReviewDecisionSnapshot | null
  signals: FounderCovenantSignal[]
  activityReview: FounderCovenantActivityReview | null
  reviewQueue: FounderCovenantReviewQueue
  reviewInputs: FounderCovenantReviewInput[]
  stages: FounderCovenantStage[]
  reviewChecklist: FounderCovenantReviewChecklistItem[]
  manualActions: FounderCovenantManualAction[]
  approvalRequests: FounderCovenantApprovalRequest[]
  reviewSchedule: FounderCovenantReviewSchedule | null
}

export interface FounderCovenantReviewDecisionSnapshot {
  status: FounderCovenantStatus
  nextAction: FounderCovenantNextAction
  manualReviewRequired: boolean
}

export interface FounderCovenantLatestReview {
  id: string
  reviewedAt: number
  reviewerId: string
  actionKind: FounderCovenantManualActionKind
  summary: string
  authorityGate: FounderCovenantAuthorityGate
  decision: FounderCovenantReviewDecisionSnapshot | null
  signals: FounderCovenantSignal[]
  activityReview: FounderCovenantActivityReview | null
  reviewQueue: FounderCovenantReviewQueue
  reviewInputs: FounderCovenantReviewInput[]
  stages: FounderCovenantStage[]
  reviewChecklist: FounderCovenantReviewChecklistItem[]
  manualActions: FounderCovenantManualAction[]
  approvalRequests: FounderCovenantApprovalRequest[]
  reviewSchedule: FounderCovenantReviewSchedule | null
  evidenceOnly: true
  automationEnabled: false
}

export interface FounderCovenantReviewSchedule {
  lastReviewAt: number | null
  nextWeeklyReviewAt: number
  nextMonthlyReviewAt: number
  weeklyReviewDue: boolean
  monthlyReviewDue: boolean
  overdue: boolean
  automationEnabled: false
}

export type FounderCovenantNotificationDraftKind = 'founder_warning' | 'manual_review_required'
export type FounderCovenantNotificationChannel = 'telegram'

export interface FounderCovenantNotificationDraft {
  id: string
  at: number
  kind: FounderCovenantNotificationDraftKind
  channel: FounderCovenantNotificationChannel
  recipientCitizenId: string
  title: string
  body: string
  requiresApproval: true
  sendEnabled: false
  authorityGate: FounderCovenantAuthorityGate
}

export interface AreaFounderCovenantDashboard {
  founderCitizenId: string | null
  status: FounderCovenantStatus
  nextAction: FounderCovenantNextAction
  reviewCadence: 'weekly_monthly_manual'
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: FounderCovenantActivityReview
  reviewQueue: FounderCovenantReviewQueue
  reviewInputs: FounderCovenantReviewInput[]
  stages: FounderCovenantStage[]
  reviewChecklist: FounderCovenantReviewChecklistItem[]
  manualActions: FounderCovenantManualAction[]
  approvalRequests: FounderCovenantApprovalRequest[]
  reviewSchedule: FounderCovenantReviewSchedule | null
  latestReview: FounderCovenantLatestReview | null
  reviewHistory: FounderCovenantReviewHistoryItem[]
  notificationDrafts: FounderCovenantNotificationDraft[]
  signals: FounderCovenantSignal[]
}

export interface AreaNeedsDashboard {
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
  licenses: Record<WorldBusinessKind, AreaLicenseDashboard>
  saturation: Record<WorldBusinessKind, number>
  citizens: AreaCitizenDashboard[]
  existingBusinesses: AreaBusinessDashboard[]
  areaEvents: AreaEventsDashboard
  ledger: AreaLedgerDashboard
  jobs: AreaJobsDashboard
  survival: AreaSurvivalDashboard
  founderCovenant: AreaFounderCovenantDashboard
  firstBuild: FirstBuildRecommendation[]
}

export interface RecordFounderCovenantReviewInput {
  reviewedAt: number
  reviewerId: string
  actionKind: FounderCovenantManualActionKind
  note?: string
  evidenceKinds?: readonly FounderCovenantManualEvidenceKind[]
}

export type RecordFounderCovenantReviewError =
  | 'area_not_claimed'
  | 'invalid_review_time'
  | 'invalid_reviewer'
  | 'review_action_disabled'

export type RecordFounderCovenantReviewResult =
  | { ok: true; area: WorldArea; entry: FounderCovenantReviewHistoryItem }
  | { ok: false; area: WorldArea; error: RecordFounderCovenantReviewError }

export type ClaimWorldAreaError =
  | 'area_already_claimed'
  | 'founder_not_found'
  | 'invalid_area_label'
  | 'invalid_claim_source'
  | 'invalid_claim_time'
  | 'invalid_location'
  | 'area_too_small'
  | 'area_too_large'

export type ClaimWorldAreaResult =
  | { ok: true; area: WorldArea }
  | { ok: false; area: WorldArea; error: ClaimWorldAreaError }

export interface WorldBusinessBlueprint {
  kind: WorldBusinessKind
  name: string
  buildCost: number
  price?: number
  wagePerHour?: number
  quality?: number
}

export type WorldIntent =
  | {
    type: 'buildBusiness'
    actorCitizenId: string
    businessId: string
    blueprint: WorldBusinessBlueprint
  }
  | {
    type: 'buyWater'
    actorCitizenId: string
  }
  | {
    type: 'buyFood'
    actorCitizenId: string
  }
  | {
    type: 'buyHousing'
    actorCitizenId: string
  }
  | {
    type: 'visitClinic'
    actorCitizenId: string
  }
  | {
    type: 'hireWorker'
    actorCitizenId: string
    businessId: string
    workerCitizenId: string
  }
  | {
    type: 'buyInsurance'
    actorCitizenId: string
    insuranceBusinessId: string
  }
  | {
    type: 'repayDebt'
    actorCitizenId: string
    debtId: string
    amount: number
  }

export type WorldIntentError =
  | 'area_not_claimed'
  | 'actor_not_found'
  | 'actor_not_area_founder'
  | 'actor_not_business_owner'
  | 'actor_unavailable'
  | 'business_id_taken'
  | 'business_not_found'
  | 'business_saturated'
  | 'already_insured'
  | 'insufficient_funds'
  | 'invalid_business'
  | 'not_insurance_business'
  | 'service_not_available'
  | 'business_fully_staffed'
  | 'worker_not_found'
  | 'worker_unavailable'
  | 'worker_already_hired'
  | 'real_worker_requires_acceptance'
  | 'workers_hall_required'
  | 'debt_not_found'
  | 'invalid_debt_payment'

export type ApplyWorldIntentResult =
  | { ok: true; area: WorldArea }
  | { ok: false; area: WorldArea; error: WorldIntentError }

type RequireAreaFounderResult =
  | { ok: true; actor: WorldCitizen }
  | { ok: false; area: WorldArea; error: WorldIntentError }

interface StepContext {
  at: number
  hours: number
  servedByKind: Record<WorldBusinessKind, number>
  capacityUsed: Record<string, number>
  summary: WorldAreaSummary
}

interface ServiceEffect extends Partial<Needs> {
  health?: number
}

export const WORLD_SIM_HOUR_MS = 3_600_000
export const FOUNDER_COVENANT_WEEKLY_REVIEW_MS = 7 * 24 * WORLD_SIM_HOUR_MS
export const FOUNDER_COVENANT_MONTHLY_REVIEW_MS = 30 * 24 * WORLD_SIM_HOUR_MS
export const HOSPITALIZATION_HOURS = 8
export const INSURED_HOSPITALIZATION_HOURS = 5
export const COLLAPSE_HEALTH = 20
export const HOSPITAL_BILL = 350
export const INSURANCE_COVERAGE = 0.6
export const INSURANCE_POLICY_PERIOD_MS = 30 * 24 * WORLD_SIM_HOUR_MS
export const DEFAULT_WORKER_WAGE = 12
export const FOUNDER_STARTING_BALANCE = 200_000
export const SIM_CITIZEN_STARTING_BALANCE = 100
export const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
export const MAX_FOUNDER_AREA_RADIUS_KM = 5
export const MIN_BUSINESS_QUALITY = 0.35
export const UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR = 0.04
export const SIM_LEAVES_HEALTH = 35
export const SIM_LEAVES_NEED_LEVEL = 5

const SURVIVAL_WARNING_HYDRATION = 50
const SURVIVAL_WARNING_HUNGER = 50
const SURVIVAL_WARNING_ENERGY = 35
const SURVIVAL_WARNING_HEALTH = 65
const SURVIVAL_DANGER_NEED_LEVEL = 10
const SURVIVAL_DANGER_HEALTH = COLLAPSE_HEALTH + 10

const ACTIVE_NEED_RATES: Needs = {
  hunger: 3.8,
  hydration: 4.8,
  energy: 3.0,
  hygiene: 1.1,
  fun: 0.8,
}

const WORKING_NEED_RATES: Needs = {
  hunger: 5.4,
  hydration: 6.2,
  energy: 5.8,
  hygiene: 2.0,
  fun: 1.3,
}

const DEFAULT_PRICES: Record<WorldBusinessKind, number> = {
  water: 2,
  food: 14,
  housing: 28,
  clinic: 90,
  insurance: 45,
  workers_hall: 1,
}

export const DEFAULT_BUSINESS_BLUEPRINTS: Record<WorldBusinessKind, WorldBusinessBlueprint> = {
  water: { kind: 'water', name: 'Water Point', buildCost: 8_000, price: DEFAULT_PRICES.water, wagePerHour: 14 },
  food: { kind: 'food', name: 'Food Shop', buildCost: 12_000, price: DEFAULT_PRICES.food, wagePerHour: 15 },
  housing: { kind: 'housing', name: 'Basic Housing', buildCost: 25_000, price: DEFAULT_PRICES.housing, wagePerHour: 16 },
  clinic: { kind: 'clinic', name: 'Clinic', buildCost: 75_000, price: DEFAULT_PRICES.clinic, wagePerHour: 24 },
  insurance: { kind: 'insurance', name: 'Insurance Office', buildCost: 60_000, price: DEFAULT_PRICES.insurance, wagePerHour: 20 },
  workers_hall: { kind: 'workers_hall', name: 'Workers Hall', buildCost: 18_000, price: DEFAULT_PRICES.workers_hall, wagePerHour: 1 },
}

const SERVICE_EFFECTS: Record<WorldBusinessKind, ServiceEffect> = {
  water: { hydration: 35 },
  food: { hunger: 32, fun: 3 },
  housing: { energy: 32, hygiene: 8 },
  clinic: { health: 25 },
  insurance: {},
  workers_hall: {},
}

const BASE_CAPACITY_PER_HOUR: Record<WorldBusinessKind, number> = {
  water: 24,
  food: 14,
  housing: 8,
  clinic: 6,
  insurance: 8,
  workers_hall: 0,
}

const TARGET_STAFF_BY_KIND: Record<WorldBusinessKind, number> = {
  water: 1,
  food: 2,
  housing: 1,
  clinic: 3,
  insurance: 1,
  workers_hall: 0,
}

const LICENSE_POPULATION_STEP: Record<WorldBusinessKind, number> = {
  water: 35,
  food: 30,
  housing: 22,
  clinic: 80,
  insurance: 90,
  workers_hall: 1,
}

const MIN_LICENSES: Record<WorldBusinessKind, number> = {
  water: 1,
  food: 1,
  housing: 1,
  clinic: 0,
  insurance: 0,
  workers_hall: 1,
}

const BUSINESS_KINDS: WorldBusinessKind[] = ['water', 'food', 'housing', 'clinic', 'insurance', 'workers_hall']
const CLAIM_SOURCES: AreaClaimSource[] = ['manual', 'ip', 'geolocation', 'telegram']

export function claimWorldArea(input: WorldArea, claim: WorldAreaClaim): ClaimWorldAreaResult {
  const area = cloneArea(input)
  const label = claim.label.trim()
  if (area.claim) return { ok: false, area, error: 'area_already_claimed' }
  if (!claim.founderCitizenId.trim()) return { ok: false, area, error: 'founder_not_found' }
  if (!area.citizens.some((c) => c.id === claim.founderCitizenId && c.kind === 'real')) {
    return { ok: false, area, error: 'founder_not_found' }
  }
  if (!label) return { ok: false, area, error: 'invalid_area_label' }
  if (!Number.isFinite(claim.claimedAt) || claim.claimedAt < 0) {
    return { ok: false, area, error: 'invalid_claim_time' }
  }
  if (!CLAIM_SOURCES.includes(claim.source)) return { ok: false, area, error: 'invalid_claim_source' }
  if (
    !Number.isFinite(claim.centerLat) ||
    !Number.isFinite(claim.centerLng) ||
    claim.centerLat < -90 ||
    claim.centerLat > 90 ||
    claim.centerLng < -180 ||
    claim.centerLng > 180
  ) {
    return { ok: false, area, error: 'invalid_location' }
  }
  if (claim.radiusKm < MIN_FOUNDER_AREA_RADIUS_KM) return { ok: false, area, error: 'area_too_small' }
  if (claim.radiusKm > MAX_FOUNDER_AREA_RADIUS_KM) return { ok: false, area, error: 'area_too_large' }

  area.claim = { ...claim, label }
  return { ok: true, area }
}

export function applyWorldIntent(input: WorldArea, intent: WorldIntent): ApplyWorldIntentResult {
  const area = cloneArea(input)
  switch (intent.type) {
    case 'buildBusiness':
      return buildBusinessFromIntent(area, intent)
    case 'buyWater':
      return buyServiceFromIntent(area, intent, 'water')
    case 'buyFood':
      return buyServiceFromIntent(area, intent, 'food')
    case 'buyHousing':
      return buyServiceFromIntent(area, intent, 'housing')
    case 'visitClinic':
      return buyServiceFromIntent(area, intent, 'clinic')
    case 'hireWorker':
      return hireWorkerFromIntent(area, intent)
    case 'buyInsurance':
      return buyInsuranceFromIntent(area, intent)
    case 'repayDebt':
      return repayDebtFromIntent(area, intent)
  }
}

export function advanceWorldArea(input: WorldArea, toMs: number): AdvanceWorldAreaResult {
  const area = cloneArea(input)
  const summary = emptyWorldAreaSummary()
  if (toMs <= area.now) return { area, summary }

  let t = area.now
  while (t < toMs) {
    const next = Math.min(toMs, t + WORLD_SIM_HOUR_MS)
    const context: StepContext = {
      at: next,
      hours: (next - t) / WORLD_SIM_HOUR_MS,
      servedByKind: zeroKindRecord(),
      capacityUsed: {},
      summary,
    }
    advanceStep(area, context)
    area.now = next
    t = next
  }

  return { area, summary }
}

export function areaNeedsDashboard(area: WorldArea): AreaNeedsDashboard {
  const activeCitizens = area.citizens.filter((c) => c.state.kind === 'active')
  const founderMoney = founderMoneyForArea(area)
  const founderCanAct = founderCanActForArea(area)
  const supply = zeroKindRecord()
  const capacity = zeroKindRecord()
  for (const business of area.businesses) {
    supply[business.kind] += 1
    capacity[business.kind] += serviceCapacity(area, business, 1)
  }

  const demand = zeroKindRecord()
  const simDemand = zeroKindRecord()
  const realDemand = zeroKindRecord()
  const shortage = zeroKindRecord()
  for (const citizen of activeCitizens) {
    addCitizenDemand(citizen, citizen.kind === 'sim' ? simDemand : realDemand, area.now)
  }
  for (const kind of BUSINESS_KINDS) {
    demand[kind] = simDemand[kind] + realDemand[kind]
    shortage[kind] = Math.max(0, demand[kind] - capacity[kind])
  }

  const population = activeCitizens.length
  const licenseSlots = zeroKindRecord()
  const licenses = {} as Record<WorldBusinessKind, AreaLicenseDashboard>
  const saturation = zeroKindRecord()
  for (const kind of BUSINESS_KINDS) {
    const license = licenseDashboardForKind(population, supply[kind], kind)
    licenses[kind] = license
    licenseSlots[kind] = license.slots
    saturation[kind] = license.saturation
  }

  return {
    population: area.citizens.length,
    simPopulation: area.citizens.filter((c) => c.kind === 'sim').length,
    realPopulation: area.citizens.filter((c) => c.kind === 'real').length,
    demand,
    simDemand,
    realDemand,
    supply,
    capacity,
    shortage,
    licenseSlots,
    licenses,
    saturation,
    citizens: area.citizens.map((citizen) => citizenDashboard(area, citizen, area.now)),
    existingBusinesses: area.businesses.map((business) => businessDashboard(area, business)),
    areaEvents: areaEventsDashboard(area),
    ledger: ledgerDashboard(area),
    jobs: jobsDashboard(area, activeCitizens, founderCanAct !== false),
    survival: survivalDashboard(area),
    founderCovenant: founderCovenantDashboard(area, { demand, shortage }),
    firstBuild: firstBuildGuidance({
      areaId: area.claim ? area.id : undefined,
      demand,
      supply,
      licenseSlots,
      saturation,
      founderMoney,
      founderCanAct,
      population,
    }),
  }
}

export function recordFounderCovenantReview(
  area: WorldArea,
  input: RecordFounderCovenantReviewInput,
): RecordFounderCovenantReviewResult {
  if (!area.claim) return { ok: false, area, error: 'area_not_claimed' }
  if (!Number.isFinite(input.reviewedAt) || input.reviewedAt < 0 || input.reviewedAt !== area.now) {
    return { ok: false, area, error: 'invalid_review_time' }
  }
  const reviewerId = input.reviewerId.trim()
  if (!reviewerId) return { ok: false, area, error: 'invalid_reviewer' }
  if (input.actionKind !== 'record_review') return { ok: false, area, error: 'review_action_disabled' }

  const covenant = areaNeedsDashboard(area).founderCovenant
  const evidenceKinds = uniqueFounderCovenantManualEvidenceKinds(input.evidenceKinds ?? [])
  const entry: FounderCovenantReviewHistoryItem = {
    id: founderCovenantReviewId(area, input.reviewedAt, reviewerId),
    at: input.reviewedAt,
    reviewerId,
    actionKind: input.actionKind,
    summary: founderCovenantReviewSummary(covenant.activityReview, input.note, evidenceKinds),
    authorityGate: founderCovenantReviewEvidenceAuthority(),
    decision: {
      status: covenant.status,
      nextAction: covenant.nextAction,
      manualReviewRequired: covenant.manualReviewRequired,
    },
    signals: covenant.signals.map(founderCovenantSignalSnapshot),
    activityReview: { ...covenant.activityReview },
    reviewQueue: founderCovenantReviewQueueSnapshot(covenant.reviewQueue),
    reviewInputs: founderCovenantReviewInputsWithManualEvidence(covenant.reviewInputs, evidenceKinds),
    stages: covenant.stages.map(founderCovenantStageSnapshot),
    reviewChecklist: covenant.reviewChecklist.map(founderCovenantReviewChecklistSnapshot),
    manualActions: covenant.manualActions.map(founderCovenantManualActionSnapshot),
    approvalRequests: covenant.approvalRequests.map(founderCovenantApprovalRequestSnapshot),
    reviewSchedule: covenant.reviewSchedule ? { ...covenant.reviewSchedule } : null,
  }

  return {
    ok: true,
    area: {
      ...area,
      founderReviewHistory: [...(area.founderReviewHistory ?? []), entry],
    },
    entry,
  }
}

function founderCovenantReviewId(area: WorldArea, reviewedAt: number, reviewerId: string): string {
  const baseId = `${area.id}:${reviewedAt}:founder-review:${reviewerId}`
  const existingIds = new Set((area.founderReviewHistory ?? []).map((entry) => entry.id))
  if (!existingIds.has(baseId)) return baseId

  let sequence = 2
  while (existingIds.has(`${baseId}:${sequence}`)) sequence += 1
  return `${baseId}:${sequence}`
}

export function firstBuildGuidance(
  input: Pick<AreaNeedsDashboard, 'demand' | 'supply' | 'licenseSlots' | 'saturation'> & {
    areaId?: string
    founderMoney?: number
    founderCanAct?: boolean
    population?: number
  },
): FirstBuildRecommendation[] {
  return BUSINESS_KINDS
    .map((kind) => buildRecommendation(kind, input))
    .sort((a, b) => b.score - a.score || BUSINESS_KINDS.indexOf(a.kind) - BUSINESS_KINDS.indexOf(b.kind))
}

function areaEventsDashboard(area: WorldArea): AreaEventsDashboard {
  const events = area.areaEvents ?? []
  return {
    eventCount: events.length,
    simDepartures: events.filter((event) => event.kind === 'sim_citizen_departure' && event.simulated).length,
    warningEvents: events.filter((event) => event.severity === 'warning').length,
    criticalEvents: events.filter((event) => event.severity === 'critical').length,
    recentEvents: events.slice(-10).reverse().map((event) => {
      const simulated = event.simulated
      return {
        ...event,
        needs: { ...event.needs },
        displayName: simulated ? `${event.citizenName} (Sim)` : event.citizenName,
        participantLabel: simulated ? 'Sim Citizen' : 'Real Citizen',
        visualTone: simulated ? 'simulated' : 'real',
      }
    }),
  }
}

function founderMoneyForArea(area: WorldArea): number | undefined {
  if (!area.claim) return undefined
  return area.citizens.find((citizen) => citizen.id === area.claim?.founderCitizenId)?.money
}

function founderCanActForArea(area: WorldArea): boolean | undefined {
  if (!area.claim) return undefined
  return area.citizens.find((citizen) => citizen.id === area.claim?.founderCitizenId)?.state.kind === 'active'
}

export function licenseSlotsForPopulation(population: number, kind: WorldBusinessKind): number {
  return Math.max(MIN_LICENSES[kind], Math.floor(population / LICENSE_POPULATION_STEP[kind]))
}

export function nextLicenseUnlockPopulation(population: number, kind: WorldBusinessKind): number {
  return (licenseSlotsForPopulation(population, kind) + 1) * LICENSE_POPULATION_STEP[kind]
}

export function effectiveBusinessQuality(business: WorldBusiness, area: WorldArea): number {
  const owner = area.citizens.find((c) => c.id === business.ownerId)
  const activeStaff = activeStaffCount(area, business)
  const ownerUnavailable = owner?.state.kind === 'hospitalized'
  const unmanagedPenalty = ownerUnavailable && activeStaff === 0 ? 0.35 : 1
  return clamp((business.quality ?? 1) * unmanagedPenalty, 0.15, 1.5)
}

function buildRecommendation(
  kind: WorldBusinessKind,
  input: Pick<AreaNeedsDashboard, 'demand' | 'supply' | 'licenseSlots' | 'saturation'> & {
    areaId?: string
    founderMoney?: number
    founderCanAct?: boolean
    population?: number
  },
): FirstBuildRecommendation {
  const blueprint = DEFAULT_BUSINESS_BLUEPRINTS[kind]
  const demand = input.demand[kind]
  const supply = input.supply[kind]
  const licenseSlots = input.licenseSlots[kind]
  const licensesRemaining = Math.max(0, licenseSlots - supply)
  const licensed = licensesRemaining > 0
  const saturated = input.saturation[kind] >= 1
  const essential = kind === 'water' || kind === 'food' || kind === 'housing'
  let score = demand * 10
  if (essential && supply === 0) score += 30
  if (licensed) score += 12
  if (saturated) score -= 30
  const estimate = estimateFirstBuildEconomics(kind, demand, supply, licensed)
  const founderCanAfford = input.founderMoney !== undefined && input.founderMoney >= blueprint.buildCost
  const cashShortfall = input.founderMoney === undefined
    ? blueprint.buildCost
    : roundMoney(Math.max(0, blueprint.buildCost - input.founderMoney))
  const blockers = firstBuildBlockers({
    licensed,
    founderMoney: input.founderMoney,
    founderCanAfford,
    founderCanAct: input.founderCanAct,
  })
  const canBuildNow = blockers.length === 0
  const population = input.population ?? 0
  const nextLicensePopulation = nextLicenseUnlockPopulation(population, kind)
  const proposedBusinessId = input.areaId && input.founderMoney !== undefined
    ? proposedFirstBuildBusinessId(input.areaId, kind, supply)
    : null

  const priority = priorityOf({ demand, supply, essential, licensed, saturated })
  return {
    kind,
    name: blueprint.name,
    proposedBusinessId,
    priority,
    action: firstBuildAction({
      canBuildNow,
      demand,
      licensed,
      founderMoney: input.founderMoney,
      founderCanAfford,
      founderCanAct: input.founderCanAct,
    }),
    clientPayload: proposedBusinessId
      ? {
        type: 'buildBusiness',
        businessKind: kind,
        businessId: proposedBusinessId,
        name: blueprint.name,
      }
      : null,
    score: roundMoney(score),
    buildCost: blueprint.buildCost,
    cashShortfall,
    currentDemand: demand,
    currentSupply: supply,
    licenseSlots,
    licensesRemaining,
    nextLicensePopulation,
    citizensUntilNextLicense: Math.max(0, nextLicensePopulation - population),
    founderCanAfford,
    canBuildNow,
    blockers,
    licensed,
    saturated,
    ...estimate,
    estimatedPaybackHours: estimate.estimatedHourlyProfit > 0
      ? roundMoney(blueprint.buildCost / estimate.estimatedHourlyProfit)
      : null,
    reason: recommendationReason(kind, { demand, supply, licensed, saturated }),
  }
}

function proposedFirstBuildBusinessId(areaId: string, kind: WorldBusinessKind, currentSupply: number): string {
  const safeAreaId = areaId.replace(/[^A-Za-z0-9:_-]/g, '-').slice(0, 48) || 'area'
  return `business:${safeAreaId}:${kind}:${currentSupply + 1}`
}

function licenseDashboardForKind(population: number, used: number, kind: WorldBusinessKind): AreaLicenseDashboard {
  const slots = licenseSlotsForPopulation(population, kind)
  const nextUnlockPopulation = nextLicenseUnlockPopulation(population, kind)
  return {
    slots,
    used,
    remaining: Math.max(0, slots - used),
    saturation: used / Math.max(1, slots),
    nextUnlockPopulation,
    citizensUntilNextUnlock: Math.max(0, nextUnlockPopulation - population),
  }
}

function firstBuildBlockers(input: {
  licensed: boolean
  founderMoney?: number
  founderCanAfford: boolean
  founderCanAct?: boolean
}): FirstBuildBlocker[] {
  const blockers: FirstBuildBlocker[] = []
  if (input.founderMoney === undefined) blockers.push('area_unclaimed')
  if (input.founderMoney !== undefined && input.founderCanAct === false) blockers.push('actor_unavailable')
  if (!input.licensed) blockers.push('license_unavailable')
  if (input.founderMoney !== undefined && !input.founderCanAfford) blockers.push('insufficient_funds')
  return blockers
}

function ledgerDashboard(area: WorldArea): AreaLedgerDashboard {
  const totalsByKind = zeroTransactionKindRecord()
  for (const transaction of area.transactions) {
    totalsByKind[transaction.kind] = roundMoney(totalsByKind[transaction.kind] + transaction.amount)
  }

  return {
    transactionCount: area.transactions.length,
    totalsByKind,
    payoutClassification: ledgerPayoutClassification(area.transactions),
    recentTransactions: area.transactions.slice(-10).reverse().map(transactionDashboard),
  }
}

function transactionDashboard(transaction: WorldTransaction): AreaTransactionDashboard {
  return { ...transaction }
}

function ledgerPayoutClassification(transactions: WorldTransaction[]): AreaLedgerPayoutClassificationDashboard {
  let gameOnlyTransactionCount = 0
  let gameOnlyAmount = 0
  let payoutEligibleTransactionCount = 0
  let payoutEligibleAmount = 0

  for (const transaction of transactions) {
    if (transaction.payoutEligibility === 'game_only') {
      gameOnlyTransactionCount += 1
      gameOnlyAmount = roundMoney(gameOnlyAmount + transaction.amount)
    } else {
      payoutEligibleTransactionCount += 1
      payoutEligibleAmount = roundMoney(payoutEligibleAmount + transaction.amount)
    }
  }

  return {
    gameOnlyTransactionCount,
    gameOnlyAmount,
    payoutEligibleTransactionCount,
    payoutEligibleAmount,
    manualPayoutReviewRequired: true,
    realWithdrawalEligible: false,
  }
}

function citizenDashboard(area: WorldArea, citizen: WorldCitizen, at: number): AreaCitizenDashboard {
  const presentation = citizenPresentation(citizen)
  return {
    id: citizen.id,
    name: citizen.name,
    displayName: presentation.displayName,
    kind: citizen.kind,
    simulated: presentation.simulated,
    participantLabel: presentation.participantLabel,
    visualTone: presentation.visualTone,
    state: citizen.state.kind,
    health: citizen.health,
    needs: { ...citizen.needs },
    money: citizen.money,
    debt: citizen.debt,
    debts: debtDashboard(citizen),
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    heirCitizenId: citizen.heirCitizenId,
    insuranceActive: hasActiveInsurance(citizen, at),
    insuranceAction: insuranceActionDashboard(area, citizen, at),
    estateProtection: estateProtectionDashboard(area, citizen, at),
  }
}

function estateProtectionDashboard(area: WorldArea, citizen: WorldCitizen, at: number): AreaEstateProtectionDashboard {
  const heir = citizen.heirCitizenId
    ? area.citizens.find((candidate) => candidate.id === citizen.heirCitizenId && candidate.kind === 'real')
    : undefined
  return {
    enabled: false,
    namingEnabled: false,
    transferEnabled: false,
    waitlistFallbackEnabled: false,
    manualReviewRequired: true,
    namedHeirCitizenId: heir?.id ?? null,
    namedHeirName: heir?.name ?? null,
    protectedByInsurance: hasActiveInsurance(citizen, at),
    status: 'disabled_until_death_enabled',
    blockers: [
      'death_disabled',
      'heir_naming_disabled',
      'estate_transfer_disabled',
      'waitlist_handoff_disabled',
      'manual_review_required',
    ],
  }
}

function debtDashboard(citizen: WorldCitizen): AreaDebtDashboard[] {
  return (citizen.debts ?? []).map((debt) => {
    const maxAffordablePayment = roundMoney(Math.min(citizen.money, debt.amount))
    const blockers: AreaDebtRepaymentBlocker[] = []
    if (citizen.state.kind !== 'active') blockers.push('actor_unavailable')
    if (maxAffordablePayment <= 0) blockers.push('insufficient_funds')
    return {
      ...debt,
      repaymentIntent: 'repayDebt',
      clientPayload: maxAffordablePayment > 0
        ? { type: 'repayDebt', debtId: debt.id, amount: maxAffordablePayment }
        : null,
      recommendedPayment: maxAffordablePayment,
      maxAffordablePayment,
      canRepayNow: blockers.length === 0,
      blockers,
    }
  })
}

function totalDebt(citizen: WorldCitizen): number {
  const itemizedDebt = (citizen.debts ?? []).reduce((total, debt) => total + debt.amount, 0)
  return roundMoney(Math.max(citizen.debt, itemizedDebt))
}

function insuranceActionDashboard(area: WorldArea, citizen: WorldCitizen, at: number): AreaInsuranceActionDashboard {
  const insurers = area.businesses
    .filter((business) => business.kind === 'insurance')
    .sort((a, b) =>
      (a.price ?? DEFAULT_PRICES.insurance) - (b.price ?? DEFAULT_PRICES.insurance) || a.id.localeCompare(b.id),
    )
  const insurer = insurers[0]
  const premium = insurer ? insurer.price ?? DEFAULT_PRICES.insurance : null
  const activeInsurance = hasActiveInsurance(citizen, at)
  const canAfford = premium !== null && citizen.money >= premium
  const blockers: AreaInsuranceActionBlocker[] = []

  if (citizen.state.kind !== 'active') blockers.push('actor_unavailable')
  if (activeInsurance) blockers.push('already_insured')
  if (!insurer) blockers.push('service_unavailable')
  if (insurer && !canAfford) blockers.push('insufficient_funds')

  return {
    intent: 'buyInsurance',
    clientPayload: insurer ? { type: 'buyInsurance', insuranceBusinessId: insurer.id } : null,
    insuranceBusinessId: insurer?.id ?? null,
    premium,
    available: Boolean(insurer),
    canAfford,
    canBuyNow: blockers.length === 0,
    blockers,
  }
}

function founderCovenantDashboard(
  area: WorldArea,
  input: {
    demand: Record<WorldBusinessKind, number>
    shortage: Record<WorldBusinessKind, number>
  },
): AreaFounderCovenantDashboard {
  if (!area.claim) {
    const activityReview: FounderCovenantActivityReview = {
      checkedAt: area.now,
      active: false,
      useful: false,
      building: false,
      staffed: false,
      indebted: false,
      hospitalized: false,
      atRisk: false,
      score: 0,
    }
    const manualActions = founderCovenantManualActions({
      status: 'unclaimed',
      nextAction: 'claim_area',
      activityReview,
    })
    const approvalRequests: FounderCovenantApprovalRequest[] = []
    const notificationDrafts: FounderCovenantNotificationDraft[] = []
    return {
      founderCitizenId: null,
      status: 'unclaimed',
      nextAction: 'claim_area',
      reviewCadence: 'weekly_monthly_manual',
      manualReviewRequired: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      activityReview,
      reviewQueue: founderCovenantReviewQueue({ manualActions, approvalRequests, notificationDrafts }),
      reviewInputs: founderCovenantUnclaimedReviewInputs(),
      stages: founderCovenantStages({
        status: 'unclaimed',
        nextAction: 'claim_area',
        manualActions,
      }),
      reviewChecklist: [{
        key: 'claim_area',
        label: 'Claim area',
        status: 'manual_review',
        evidence: 'No founder has claimed this area yet.',
      }],
      manualActions,
      approvalRequests,
      reviewSchedule: null,
      latestReview: founderCovenantLatestReview(area),
      reviewHistory: founderCovenantReviewHistory(area),
      notificationDrafts,
      signals: [],
    }
  }

  const founderCitizenId = area.claim.founderCitizenId
  const founder = area.citizens.find((citizen) => citizen.id === founderCitizenId)
  const founderBusinesses = area.businesses.filter((business) => business.ownerId === founderCitizenId)
  const founderBusinessIds = new Set(founderBusinesses.map((business) => business.id))
  const signals: FounderCovenantSignal[] = []
  const founderActive = founder?.state.kind === 'active'
  const founderHospitalized = founder?.state.kind === 'hospitalized'
  const building = founderBusinesses.length > 0
  const founderDebt = founder ? totalDebt(founder) : 0
  const understaffedBusinesses = founderBusinesses.filter((business) =>
    activeStaffCount(area, business) < TARGET_STAFF_BY_KIND[business.kind],
  )
  const reviewSchedule = founderCovenantReviewSchedule(area)
  const unreviewedSimDepartures = unreviewedSimDepartureEvents(area, reviewSchedule?.lastReviewAt ?? null)
  const staffed = building && understaffedBusinesses.length === 0
  const essentialShortages = (['water', 'food', 'housing'] as const)
    .filter((kind) => input.shortage[kind] > 0)
  const servedCustomers = area.transactions.some((transaction) =>
    transaction.kind === 'customer_purchase' && founderBusinessIds.has(transaction.toId)
  )
  const demandServedByFounder = founderBusinesses.some((business) =>
    input.demand[business.kind] > 0 && input.shortage[business.kind] < input.demand[business.kind]
  )
  const useful = building && (servedCustomers || demandServedByFounder || essentialShortages.length === 0)

  if (!founder || !founderActive) {
    signals.push({
      kind: 'founder_unavailable',
      severity: 'critical',
      message: 'Founder is unavailable; review the seat manually before any replacement decision.',
    })
  }

  if (!building) {
    signals.push({
      kind: 'no_business_built',
      severity: 'warning',
      message: 'Founder has not built a local business yet.',
    })
  }

  if (understaffedBusinesses.length > 0) {
    signals.push({
      kind: 'understaffed_businesses',
      severity: 'warning',
      message: 'Founder-owned businesses need workers before the area can run reliably.',
      businessIds: understaffedBusinesses.map((business) => business.id),
    })
  }

  if (essentialShortages.length > 0) {
    signals.push({
      kind: 'essential_shortage',
      severity: 'warning',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: essentialShortages,
      amount: roundMoney(essentialShortages.reduce((total, kind) => total + input.shortage[kind], 0)),
    })
  }

  if (unreviewedSimDepartures.length > 0) {
    const departedServiceKinds = uniqueDepartureServiceKinds(unreviewedSimDepartures.map((event) => event.serviceKind))
    signals.push({
      kind: 'sim_departure',
      severity: 'warning',
      message: `${unreviewedSimDepartures.length} Sim Citizen${unreviewedSimDepartures.length === 1 ? '' : 's'} left after the latest review because essential services stayed unserved.`,
      businessKinds: departedServiceKinds,
      amount: unreviewedSimDepartures.length,
    })
  }

  if (founderDebt > 0) {
    signals.push({
      kind: 'founder_debt',
      severity: 'info',
      message: 'Founder has unpaid debt that should be reviewed before profit or succession decisions.',
      amount: founderDebt,
    })
  }

  if (reviewSchedule?.overdue) {
    signals.push({
      kind: 'review_due',
      severity: 'warning',
      message: founderCovenantReviewDueMessage(reviewSchedule),
    })
  }

  const manualReviewRequired = signals.some((signal) => signal.severity === 'critical')
  const status: FounderCovenantStatus = manualReviewRequired ? 'manual_review' : signals.length > 0 ? 'watch' : 'active'
  const activityReview: FounderCovenantActivityReview = {
    checkedAt: area.now,
    active: founderActive,
    useful,
    building,
    staffed,
    indebted: founderDebt > 0,
    hospitalized: founderHospitalized,
    atRisk: status !== 'active',
    score: founder
      ? founderActivityScore({
        active: founderActive,
        useful,
        building,
        staffed,
        indebted: founderDebt > 0,
      })
      : 0,
  }
  const nextAction: FounderCovenantNextAction = manualReviewRequired
    ? 'manual_review'
    : reviewSchedule?.overdue
      ? 'manual_review'
    : signals.some((signal) => signal.severity === 'warning')
      ? 'warn_founder'
      : 'none'
  const reviewChecklist = founderCovenantReviewChecklist({
    activityReview,
    manualReviewRequired,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
  })
  const manualActions = founderCovenantManualActions({ status, nextAction, activityReview })
  const notificationDrafts = founderCovenantNotificationDrafts(area, {
    founderCitizenId,
    nextAction,
  })
  const approvalRequests = founderCovenantApprovalRequests(area, {
    founderCitizenId,
    manualActions,
    notificationDrafts,
  })
  const reviewQueue = founderCovenantReviewQueue({
    manualActions,
    approvalRequests,
    notificationDrafts,
  })
  const stages = founderCovenantStages({
    status,
    nextAction,
    manualActions,
  })
  const reviewInputs = founderCovenantReviewInputs({
    activityReview,
    signals,
    reviewSchedule,
    realPopulation: area.citizens.filter((citizen) => citizen.kind === 'real').length,
    simPopulation: area.citizens.filter((citizen) => citizen.kind === 'sim').length,
  })

  return {
    founderCitizenId,
    status,
    nextAction,
    reviewCadence: 'weekly_monthly_manual',
    manualReviewRequired,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview,
    reviewQueue,
    reviewInputs,
    stages,
    reviewChecklist,
    manualActions,
    approvalRequests,
    reviewSchedule,
    latestReview: founderCovenantLatestReview(area),
    reviewHistory: founderCovenantReviewHistory(area),
    notificationDrafts,
    signals,
  }
}

function founderCovenantUnclaimedReviewInputs(): FounderCovenantReviewInput[] {
  return [
    {
      kind: 'in_game_activity',
      label: 'In-game activity',
      status: 'manual_needed',
      evidence: 'Founder must claim an area before activity can be reviewed.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'area_health',
      label: 'Area health',
      status: 'manual_needed',
      evidence: 'Area health review starts after claim.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'population_growth',
      label: 'Population growth',
      status: 'manual_needed',
      evidence: 'Invite and population review starts after claim.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'external_contribution',
      label: 'External contribution',
      status: 'manual_needed',
      evidence: 'Code, design, docs, and testing evidence are reviewed manually.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'ideas_feedback',
      label: 'Ideas and feedback',
      status: 'manual_needed',
      evidence: 'Ideas, bug reports, and economy feedback are reviewed manually.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'review_consistency',
      label: 'Review consistency',
      status: 'manual_needed',
      evidence: 'Weekly/monthly cadence starts after claim.',
      manualEvidenceRequired: true,
    },
  ]
}

function founderCovenantReviewInputs(input: {
  activityReview: FounderCovenantActivityReview
  signals: FounderCovenantSignal[]
  reviewSchedule: FounderCovenantReviewSchedule | null
  realPopulation: number
  simPopulation: number
}): FounderCovenantReviewInput[] {
  const serviceIssues = input.signals.some((signal) =>
    signal.kind === 'essential_shortage' || signal.kind === 'understaffed_businesses' || signal.kind === 'sim_departure'
  )
  const activityCaptured = input.activityReview.active && (input.activityReview.building || input.activityReview.useful)
  return [
    {
      kind: 'in_game_activity',
      label: 'In-game activity',
      status: activityCaptured ? 'captured' : 'watch',
      evidence: activityCaptured
        ? 'Founder activity is captured from local businesses, staffing, and purchases.'
        : 'Founder needs more visible in-game building or demand-serving activity.',
      manualEvidenceRequired: false,
    },
    {
      kind: 'area_health',
      label: 'Area health',
      status: serviceIssues ? 'watch' : 'captured',
      evidence: serviceIssues
        ? 'Area health has service or staffing issues to review.'
        : 'Area health signals are captured from demand, shortages, and staffing.',
      manualEvidenceRequired: false,
    },
    {
      kind: 'population_growth',
      label: 'Population growth',
      status: input.realPopulation > 1 ? 'captured' : 'manual_needed',
      evidence: input.realPopulation > 1
        ? `${input.realPopulation} real participant(s) and ${input.simPopulation} Sim Citizen(s) are visible in the area.`
        : 'Invite quality and local population growth need manual proof until invite tracking exists.',
      manualEvidenceRequired: input.realPopulation <= 1,
    },
    {
      kind: 'external_contribution',
      label: 'External contribution',
      status: 'manual_needed',
      evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'ideas_feedback',
      label: 'Ideas and feedback',
      status: 'manual_needed',
      evidence: 'Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
      manualEvidenceRequired: true,
    },
    {
      kind: 'review_consistency',
      label: 'Review consistency',
      status: input.reviewSchedule?.overdue ? 'watch' : 'captured',
      evidence: input.reviewSchedule?.overdue
        ? 'Weekly/monthly review cadence is due or overdue.'
        : 'Weekly/monthly review cadence is being tracked.',
      manualEvidenceRequired: false,
    },
  ]
}

function unreviewedSimDepartureEvents(area: WorldArea, lastReviewAt: number | null): WorldAreaEvent[] {
  return (area.areaEvents ?? []).filter((event) => {
    if (event.kind !== 'sim_citizen_departure' || !event.simulated) return false
    if (lastReviewAt === null || !Number.isFinite(lastReviewAt)) return true
    return Number.isFinite(event.at) && event.at > lastReviewAt
  })
}

function uniqueDepartureServiceKinds(kinds: readonly WorldDepartureServiceKind[]): WorldBusinessKind[] {
  return (['water', 'food', 'housing'] as const).filter((kind) => kinds.includes(kind))
}

function founderCovenantStages(input: {
  status: FounderCovenantStatus
  nextAction: FounderCovenantNextAction
  manualActions: FounderCovenantManualAction[]
}): FounderCovenantStage[] {
  const warningRecommended = input.manualActions.some((action) => action.kind === 'send_warning' && action.recommended)
  const probationRecommended = input.manualActions.some((action) => action.kind === 'start_probation' && action.recommended)
  const replacementRecommended = input.manualActions.some((action) =>
    action.kind === 'recommend_replacement' && action.recommended
  )
  const unclaimed = input.status === 'unclaimed'
  return [
    founderCovenantStage({
      kind: 'active',
      label: 'Active',
      status: input.status === 'active' ? 'current' : 'locked',
      reason: unclaimed
        ? 'Founder must claim an area before covenant stages start.'
        : input.status === 'active'
          ? 'Founder currently has no covenant warnings.'
          : 'Founder has covenant signals requiring reviewer attention.',
      requiresMainFounderApproval: false,
    }),
    founderCovenantStage({
      kind: 'warning',
      label: 'Warning',
      status: warningRecommended ? 'recommended' : 'locked',
      reason: warningRecommended
        ? 'Covenant signals suggest a manual founder warning.'
        : input.nextAction === 'manual_review'
          ? 'Manual review supersedes warning while critical signals are unresolved.'
          : 'No manual warning is currently suggested.',
      requiresMainFounderApproval: true,
    }),
    founderCovenantStage({
      kind: 'probation',
      label: 'Probation',
      status: probationRecommended ? 'recommended' : 'locked',
      reason: probationRecommended
        ? 'Reviewer may open probation, but execution remains disabled.'
        : 'Founder score and signals do not suggest probation.',
      requiresMainFounderApproval: true,
    }),
    founderCovenantStage({
      kind: 'removed',
      label: 'Removed',
      status: replacementRecommended ? 'recommended' : 'locked',
      reason: replacementRecommended
        ? 'Founder is unavailable; removal remains a manually approved later workflow.'
        : 'Removal is not suggested by current covenant signals.',
      requiresMainFounderApproval: true,
    }),
    founderCovenantStage({
      kind: 'waitlist_replacement',
      label: 'Waitlist replacement',
      status: 'locked',
      reason: replacementRecommended
        ? 'Waitlist handoff is still disabled even when replacement is recommended.'
        : 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
      requiresMainFounderApproval: true,
    }),
  ]
}

function founderCovenantStage(input: {
  kind: FounderCovenantStageKind
  label: string
  status: FounderCovenantStageStatus
  reason: string
  requiresMainFounderApproval: boolean
}): FounderCovenantStage {
  return {
    ...input,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewChecklist(input: {
  activityReview: FounderCovenantActivityReview
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
}): FounderCovenantReviewChecklistItem[] {
  const review = input.activityReview
  return [
    {
      key: 'active',
      label: 'Active',
      status: review.active ? 'met' : 'manual_review',
      evidence: review.active ? 'Founder can act in the area.' : 'Founder is unavailable and needs manual review.',
    },
    {
      key: 'useful',
      label: 'Useful',
      status: review.useful ? 'met' : 'watch',
      evidence: review.useful ? 'Founder activity is serving local demand.' : 'No useful demand-serving activity is visible yet.',
    },
    {
      key: 'building',
      label: 'Building',
      status: review.building ? 'met' : 'watch',
      evidence: review.building ? 'Founder owns at least one local business.' : 'Founder has not built a local business yet.',
    },
    {
      key: 'staffed',
      label: 'Staffed',
      status: review.staffed ? 'met' : 'watch',
      evidence: review.staffed ? 'Founder businesses have their required staff.' : 'Founder businesses need staff before review can clear.',
    },
    {
      key: 'debt',
      label: 'Debt',
      status: review.indebted ? 'watch' : 'met',
      evidence: review.indebted ? 'Founder has unpaid debt to review before profit or succession.' : 'No founder debt is currently recorded.',
    },
    {
      key: 'hospital',
      label: 'Hospital',
      status: review.hospitalized ? 'manual_review' : 'met',
      evidence: review.hospitalized ? 'Founder is hospitalized; replacement remains manual.' : 'Founder is not hospitalized.',
    },
    {
      key: 'risk',
      label: 'At risk',
      status: input.manualReviewRequired ? 'manual_review' : review.atRisk ? 'watch' : 'met',
      evidence: review.atRisk ? 'Covenant signals need weekly/monthly review.' : 'No risk signals currently require review.',
    },
    {
      key: 'manual_authority',
      label: 'Manual authority',
      status: !input.replacementEnabled && !input.waitlistHandoffEnabled ? 'met' : 'manual_review',
      evidence: !input.replacementEnabled && !input.waitlistHandoffEnabled
        ? 'Automatic removal and waitlist handoff are disabled.'
        : 'Removal controls must remain manually approved.',
    },
  ]
}

function founderCovenantManualActions(input: {
  status: FounderCovenantStatus
  nextAction: FounderCovenantNextAction
  activityReview: FounderCovenantActivityReview
}): FounderCovenantManualAction[] {
  const review = input.activityReview
  const warningRecommended = input.nextAction === 'warn_founder'
  const probationRecommended = input.status === 'manual_review' || review.score < 60
  const replacementRecommended = input.status === 'manual_review' && !review.active
  return [
    {
      kind: 'record_review',
      label: 'Record review',
      recommended: input.status !== 'unclaimed',
      requiresApproval: true,
      automationEnabled: false,
      authorityGate: founderCovenantManualActionAuthority('record_review', input.status !== 'unclaimed'),
      reason: input.status === 'unclaimed'
        ? 'Founder review starts after area claim.'
        : 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
      clientPayload: input.status === 'unclaimed'
        ? null
        : {
          type: 'recordCovenantReview',
          actionKind: 'record_review',
        },
    },
    {
      kind: 'send_warning',
      label: 'Send warning',
      recommended: warningRecommended,
      requiresApproval: true,
      automationEnabled: false,
      authorityGate: founderCovenantManualActionAuthority('send_warning', false),
      reason: warningRecommended
        ? 'Covenant signals suggest a manual founder warning.'
        : 'No manual warning is currently suggested by covenant signals.',
      clientPayload: null,
    },
    {
      kind: 'start_probation',
      label: 'Start probation',
      recommended: probationRecommended,
      requiresApproval: true,
      automationEnabled: false,
      authorityGate: founderCovenantManualActionAuthority('start_probation', false),
      reason: probationRecommended
        ? 'Reviewer may open probation, but the game will not remove the founder automatically.'
        : 'Founder score and signals do not suggest probation.',
      clientPayload: null,
    },
    {
      kind: 'recommend_replacement',
      label: 'Recommend replacement',
      recommended: replacementRecommended,
      requiresApproval: true,
      automationEnabled: false,
      authorityGate: founderCovenantManualActionAuthority('recommend_replacement', false),
      reason: replacementRecommended
        ? 'Founder is unavailable; replacement remains a manually approved later workflow.'
        : 'Replacement is not suggested and waitlist handoff is disabled.',
      clientPayload: null,
    },
  ]
}

function founderCovenantManualActionAuthority(
  kind: FounderCovenantManualActionKind,
  executionEnabled: boolean,
): FounderCovenantAuthorityGate {
  if (kind === 'record_review') {
    return {
      requiredRole: 'area_reviewer',
      status: 'evidence_only',
      approvedById: null,
      approvedAt: null,
      executionEnabled,
    }
  }

  return {
    requiredRole: 'main_founder',
    status: 'approval_required',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  }
}

function founderCovenantApprovalRequests(
  area: WorldArea,
  input: {
    founderCitizenId: string
    manualActions: FounderCovenantManualAction[]
    notificationDrafts: FounderCovenantNotificationDraft[]
  },
): FounderCovenantApprovalRequest[] {
  return input.manualActions
    .filter(isRecommendedFounderCovenantApprovalAction)
    .map((action) => ({
      id: `${area.id}:${area.now}:covenant-approval:${action.kind}:${input.founderCitizenId}`,
      at: area.now,
      kind: action.kind,
      label: action.label,
      reason: action.reason,
      status: 'pending_manual_approval',
      recommended: true,
      requiresApproval: true,
      approvalEnabled: false,
      automationEnabled: false,
      executionEnabled: false,
      authorityGate: { ...action.authorityGate, executionEnabled: false },
      notificationDraftId: founderCovenantApprovalNotificationDraftId(action, input.notificationDrafts),
      blockers: founderCovenantApprovalBlockers(action),
    }))
}

function isRecommendedFounderCovenantApprovalAction(
  action: FounderCovenantManualAction,
): action is FounderCovenantManualAction & { kind: FounderCovenantApprovalRequestKind; recommended: true } {
  return action.kind !== 'record_review' && action.recommended
}

function founderCovenantApprovalNotificationDraftId(
  action: FounderCovenantManualAction & { kind: FounderCovenantApprovalRequestKind },
  drafts: FounderCovenantNotificationDraft[],
): string | null {
  const matchingKind: FounderCovenantNotificationDraftKind = action.kind === 'send_warning'
    ? 'founder_warning'
    : 'manual_review_required'
  return drafts.find((draft) => draft.kind === matchingKind)?.id ?? null
}

function founderCovenantApprovalBlockers(
  action: FounderCovenantManualAction & { kind: FounderCovenantApprovalRequestKind },
): FounderCovenantApprovalBlocker[] {
  if (action.kind === 'send_warning') return ['approval_workflow_disabled', 'telegram_delivery_disabled']
  if (action.kind === 'start_probation') return ['approval_workflow_disabled', 'probation_execution_disabled']
  return ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled']
}

function founderCovenantReviewQueue(input: {
  manualActions: FounderCovenantManualAction[]
  approvalRequests: FounderCovenantApprovalRequest[]
  notificationDrafts: FounderCovenantNotificationDraft[]
}): FounderCovenantReviewQueue {
  const recordReviewEnabled = input.manualActions.some((action) =>
    action.kind === 'record_review' && action.clientPayload !== null
  )
  const recommendedActionKinds = input.manualActions
    .filter((action) => action.recommended)
    .map((action) => action.kind)
  const pendingApprovalKinds = input.approvalRequests.map((request) => request.kind)
  const pendingNotificationKinds = input.notificationDrafts.map((draft) => draft.kind)
  const blockers = Array.from(new Set(input.approvalRequests.flatMap((request) => request.blockers)))
  return {
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    nextStep: input.approvalRequests.length > 0
      ? 'main_founder_approval'
      : recordReviewEnabled
        ? 'record_review'
        : 'monitor',
    recordReviewEnabled,
    recommendedActionKinds,
    pendingApprovalKinds,
    pendingApprovalCount: input.approvalRequests.length,
    pendingNotificationKinds,
    pendingNotificationCount: input.notificationDrafts.length,
    blockerCount: input.approvalRequests.reduce((total, request) => total + request.blockers.length, 0),
    blockers,
  }
}

function founderCovenantReviewHistory(area: WorldArea): FounderCovenantReviewHistoryItem[] {
  return [...(area.founderReviewHistory ?? [])]
    .sort((left, right) => right.at - left.at)
    .slice(0, 5)
    .map(founderCovenantReviewHistoryItem)
}

function founderCovenantLatestReview(area: WorldArea): FounderCovenantLatestReview | null {
  const latest = founderCovenantReviewHistory(area)[0]
  if (!latest) return null
  return {
    id: latest.id,
    reviewedAt: latest.at,
    reviewerId: latest.reviewerId,
    actionKind: latest.actionKind,
    summary: latest.summary,
    authorityGate: { ...latest.authorityGate },
    decision: latest.decision ? { ...latest.decision } : null,
    signals: latest.signals.map(founderCovenantSignalSnapshot),
    activityReview: latest.activityReview ? { ...latest.activityReview } : null,
    reviewQueue: founderCovenantReviewQueueSnapshot(latest.reviewQueue),
    reviewInputs: latest.reviewInputs.map(founderCovenantReviewInputSnapshot),
    stages: latest.stages.map(founderCovenantStageSnapshot),
    reviewChecklist: latest.reviewChecklist.map(founderCovenantReviewChecklistSnapshot),
    manualActions: latest.manualActions.map(founderCovenantManualActionSnapshot),
    approvalRequests: latest.approvalRequests.map(founderCovenantApprovalRequestSnapshot),
    reviewSchedule: latest.reviewSchedule ? { ...latest.reviewSchedule } : null,
    evidenceOnly: true,
    automationEnabled: false,
  }
}

function founderCovenantReviewHistoryItem(entry: FounderCovenantReviewHistoryItem): FounderCovenantReviewHistoryItem {
  const legacyEntry = entry as Partial<FounderCovenantReviewHistoryItem>
  const manualActions = Array.isArray(legacyEntry.manualActions)
    ? legacyEntry.manualActions.map(founderCovenantManualActionSnapshot)
    : []
  const approvalRequests = Array.isArray(legacyEntry.approvalRequests)
    ? legacyEntry.approvalRequests.map(founderCovenantApprovalRequestSnapshot)
    : []
  const reviewInputs = Array.isArray(legacyEntry.reviewInputs)
    ? legacyEntry.reviewInputs.map(founderCovenantReviewInputSnapshot)
    : []
  const stages = Array.isArray(legacyEntry.stages)
    ? legacyEntry.stages.map(founderCovenantStageSnapshot)
    : []
  return {
    ...entry,
    authorityGate: founderCovenantReviewEvidenceAuthority(),
    decision: legacyEntry.decision ? { ...legacyEntry.decision } : null,
    signals: (entry.signals ?? []).map(founderCovenantSignalSnapshot),
    activityReview: legacyEntry.activityReview ? { ...legacyEntry.activityReview } : null,
    reviewQueue: legacyEntry.reviewQueue
      ? founderCovenantReviewQueueSnapshot(legacyEntry.reviewQueue)
      : founderCovenantReviewQueueFromSnapshot({ manualActions, approvalRequests }),
    reviewInputs,
    stages,
    reviewChecklist: Array.isArray(legacyEntry.reviewChecklist)
      ? legacyEntry.reviewChecklist.map(founderCovenantReviewChecklistSnapshot)
      : [],
    manualActions,
    approvalRequests,
    reviewSchedule: legacyEntry.reviewSchedule ? { ...legacyEntry.reviewSchedule } : null,
  }
}

function founderCovenantReviewSummary(
  activityReview: FounderCovenantActivityReview,
  note: string | undefined,
  evidenceKinds: readonly FounderCovenantManualEvidenceKind[],
): string {
  const trimmedNote = note?.trim()
  if (trimmedNote) return trimmedNote
  const evidence = evidenceKinds.length > 0
    ? ` Manual evidence: ${evidenceKinds.map(founderCovenantReviewInputLabel).join(', ')}.`
    : ''
  return `Manual founder covenant review recorded. Activity score: ${activityReview.score}.${evidence}`
}

function founderCovenantReviewInputsWithManualEvidence(
  inputs: readonly FounderCovenantReviewInput[],
  evidenceKinds: readonly FounderCovenantManualEvidenceKind[],
): FounderCovenantReviewInput[] {
  if (evidenceKinds.length === 0) return inputs.map(founderCovenantReviewInputSnapshot)
  const evidence = new Set(evidenceKinds)
  return inputs.map((input) => {
    if (!evidence.has(input.kind as FounderCovenantManualEvidenceKind)) {
      return founderCovenantReviewInputSnapshot(input)
    }
    return {
      ...input,
      status: 'captured',
      evidence: `${input.label} evidence was attached by the reviewer.`,
      manualEvidenceRequired: false,
    }
  })
}

function uniqueFounderCovenantManualEvidenceKinds(
  kinds: readonly FounderCovenantManualEvidenceKind[],
): FounderCovenantManualEvidenceKind[] {
  const allowed: readonly FounderCovenantManualEvidenceKind[] = [
    'population_growth',
    'external_contribution',
    'ideas_feedback',
  ]
  return allowed.filter((kind) => kinds.includes(kind))
}

function founderCovenantReviewInputLabel(kind: FounderCovenantManualEvidenceKind): string {
  if (kind === 'population_growth') return 'Population growth'
  if (kind === 'external_contribution') return 'External contribution'
  return 'Ideas and feedback'
}

function founderCovenantReviewEvidenceAuthority(): FounderCovenantAuthorityGate {
  return {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  }
}

function founderCovenantSignalSnapshot(signal: FounderCovenantSignal): FounderCovenantSignal {
  return {
    ...signal,
    ...(signal.businessIds ? { businessIds: [...signal.businessIds] } : {}),
    ...(signal.businessKinds ? { businessKinds: [...signal.businessKinds] } : {}),
  }
}

function founderCovenantReviewChecklistSnapshot(
  item: FounderCovenantReviewChecklistItem,
): FounderCovenantReviewChecklistItem {
  return { ...item }
}

function founderCovenantReviewInputSnapshot(input: FounderCovenantReviewInput): FounderCovenantReviewInput {
  return { ...input }
}

function founderCovenantStageSnapshot(stage: FounderCovenantStage): FounderCovenantStage {
  return {
    ...stage,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantManualActionSnapshot(action: FounderCovenantManualAction): FounderCovenantManualAction {
  return {
    ...action,
    authorityGate: { ...action.authorityGate, executionEnabled: false },
    clientPayload: null,
  }
}

function founderCovenantApprovalRequestSnapshot(
  request: FounderCovenantApprovalRequest,
): FounderCovenantApprovalRequest {
  return {
    ...request,
    approvalEnabled: false,
    automationEnabled: false,
    executionEnabled: false,
    authorityGate: { ...request.authorityGate, executionEnabled: false },
    blockers: [...request.blockers],
  }
}

function founderCovenantReviewQueueSnapshot(queue: FounderCovenantReviewQueue): FounderCovenantReviewQueue {
  return {
    ...queue,
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    recommendedActionKinds: [...queue.recommendedActionKinds],
    pendingApprovalKinds: Array.isArray(queue.pendingApprovalKinds) ? [...queue.pendingApprovalKinds] : [],
    pendingNotificationKinds: Array.isArray(queue.pendingNotificationKinds) ? [...queue.pendingNotificationKinds] : [],
    blockers: [...queue.blockers],
  }
}

function founderCovenantReviewQueueFromSnapshot(input: {
  manualActions: FounderCovenantManualAction[]
  approvalRequests: FounderCovenantApprovalRequest[]
}): FounderCovenantReviewQueue {
  const recordReviewEnabled = input.manualActions.some((action) =>
    action.kind === 'record_review' && action.recommended
  )
  const recommendedActionKinds = input.manualActions
    .filter((action) => action.recommended)
    .map((action) => action.kind)
  const pendingApprovalKinds = input.approvalRequests.map((request) => request.kind)
  const blockers = Array.from(new Set(input.approvalRequests.flatMap((request) => request.blockers)))
  const notificationDraftIds = new Set(input.approvalRequests
    .map((request) => request.notificationDraftId)
    .filter((id): id is string => typeof id === 'string'))
  const pendingNotificationKinds = Array.from(new Set(input.approvalRequests
    .filter((request) => request.notificationDraftId !== null)
    .map((request) => founderCovenantApprovalNotificationKind(request.kind))))
  return {
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    nextStep: input.approvalRequests.length > 0
      ? 'main_founder_approval'
      : recordReviewEnabled
        ? 'record_review'
        : 'monitor',
    recordReviewEnabled,
    recommendedActionKinds,
    pendingApprovalKinds,
    pendingApprovalCount: input.approvalRequests.length,
    pendingNotificationKinds,
    pendingNotificationCount: notificationDraftIds.size,
    blockerCount: input.approvalRequests.reduce((total, request) => total + request.blockers.length, 0),
    blockers,
  }
}

function founderCovenantApprovalNotificationKind(
  kind: FounderCovenantApprovalRequestKind,
): FounderCovenantNotificationDraftKind {
  return kind === 'send_warning' ? 'founder_warning' : 'manual_review_required'
}

function founderCovenantReviewSchedule(area: WorldArea): FounderCovenantReviewSchedule | null {
  if (!area.claim) return null
  const lastReviewAt = latestFounderReviewAt(area)
  const scheduleAnchor = lastReviewAt ?? area.claim.claimedAt
  const nextWeeklyReviewAt = scheduleAnchor + FOUNDER_COVENANT_WEEKLY_REVIEW_MS
  const nextMonthlyReviewAt = scheduleAnchor + FOUNDER_COVENANT_MONTHLY_REVIEW_MS
  const weeklyReviewDue = area.now >= nextWeeklyReviewAt
  const monthlyReviewDue = area.now >= nextMonthlyReviewAt
  return {
    lastReviewAt,
    nextWeeklyReviewAt,
    nextMonthlyReviewAt,
    weeklyReviewDue,
    monthlyReviewDue,
    overdue: weeklyReviewDue || monthlyReviewDue,
    automationEnabled: false,
  }
}

function latestFounderReviewAt(area: WorldArea): number | null {
  const reviewedAt = (area.founderReviewHistory ?? [])
    .map((entry) => entry.at)
    .filter((at) => Number.isFinite(at))
  return reviewedAt.length > 0 ? Math.max(...reviewedAt) : null
}

function founderCovenantReviewDueMessage(schedule: FounderCovenantReviewSchedule): string {
  const cadence = schedule.monthlyReviewDue ? 'monthly' : 'weekly'
  return `Founder covenant ${cadence} review is due; record manual evidence before any warning, probation, or replacement decision.`
}

function founderCovenantNotificationDrafts(
  area: WorldArea,
  input: {
    founderCitizenId: string
    nextAction: FounderCovenantNextAction
  },
): FounderCovenantNotificationDraft[] {
  if (input.nextAction === 'none' || input.nextAction === 'claim_area') return []
  const manualReview = input.nextAction === 'manual_review'
  const kind: FounderCovenantNotificationDraftKind = manualReview ? 'manual_review_required' : 'founder_warning'
  return [{
    id: `${area.id}:${area.now}:covenant-notification:${kind}:${input.founderCitizenId}`,
    at: area.now,
    kind,
    channel: 'telegram',
    recipientCitizenId: input.founderCitizenId,
    title: manualReview ? 'Founder covenant manual review required' : 'Founder covenant warning recommended',
    body: manualReview
      ? 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.'
      : 'Founder covenant signals suggest a warning. A reviewer must approve delivery before Telegram is used.',
    requiresApproval: true,
    sendEnabled: false,
    authorityGate: {
      requiredRole: 'main_founder',
      status: 'approval_required',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
  }]
}

function founderActivityScore(input: {
  active: boolean
  useful: boolean
  building: boolean
  staffed: boolean
  indebted: boolean
}): number {
  return (input.active ? 30 : 0) +
    (input.useful ? 25 : 0) +
    (input.building ? 20 : 0) +
    (input.staffed ? 15 : 0) +
    (!input.indebted ? 10 : 0)
}

function citizenPresentation(citizen: WorldCitizen): {
  displayName: string
  simulated: boolean
  participantLabel: WorldParticipantLabel
  visualTone: WorldParticipantVisualTone
} {
  const simulated = citizen.kind === 'sim'
  return {
    displayName: simulated ? `${citizen.name} (Sim)` : citizen.name,
    simulated,
    participantLabel: simulated ? 'Sim Citizen' : 'Real Citizen',
    visualTone: simulated ? 'simulated' : 'real',
  }
}

function addCitizenDemand(citizen: WorldCitizen, demand: Record<WorldBusinessKind, number>, at: number): void {
  if (citizen.needs.hydration < 70) demand.water += 1
  if (citizen.needs.hunger < 70) demand.food += 1
  if (!citizen.homeBusinessId || citizen.needs.energy < 60) demand.housing += 1
  if (citizen.health < 80) demand.clinic += 1
  if (!hasActiveInsurance(citizen, at)) demand.insurance += 1
}

function hasActiveJob(area: WorldArea, citizen: WorldCitizen): boolean {
  if (citizen.state.kind !== 'active' || !citizen.jobBusinessId) return false
  const business = area.businesses.find((candidate) => candidate.id === citizen.jobBusinessId)
  return Boolean(business?.staffCitizenIds.includes(citizen.id))
}

function jobsDashboard(area: WorldArea, activeCitizens: WorldCitizen[], founderCanManage = true): AreaJobsDashboard {
  let openPositions = 0
  let understaffedBusinesses = 0
  const hiringSlots: WorldBusiness[] = []
  for (const business of area.businesses) {
    const targetStaff = TARGET_STAFF_BY_KIND[business.kind]
    const openForBusiness = Math.max(0, targetStaff - activeStaffCount(area, business))
    openPositions += openForBusiness
    if (openForBusiness > 0) understaffedBusinesses += 1
    for (let slot = 0; slot < openForBusiness; slot += 1) hiringSlots.push(business)
  }

  const employedCitizens = activeCitizens.filter((citizen) => hasActiveJob(area, citizen)).length
  const workersHallCount = area.businesses.filter((business) => business.kind === 'workers_hall').length
  const candidates = activeCitizens
    .filter((citizen) => citizen.id !== area.claim?.founderCitizenId && !hasActiveJob(area, citizen) && !citizen.jobBusinessId)
    .map((citizen, index) => workerCandidateDashboard(citizen, hiringSlots[index] ?? null, founderCanManage))
  return {
    employedCitizens,
    unemployedCitizens: activeCitizens.length - employedCitizens,
    hireableSimWorkers: candidates.filter((candidate) => candidate.action === 'hire_now').length,
    realWorkersRequiringAcceptance: candidates.filter((candidate) => candidate.action === 'requires_acceptance').length,
    openPositions,
    understaffedBusinesses,
    workersHallCount,
    workersHallRequired: openPositions > 0 && workersHallCount === 0,
    candidates,
  }
}

function workerCandidateDashboard(
  citizen: WorldCitizen,
  recommendedBusiness: WorldBusiness | null,
  founderCanManage: boolean,
): AreaWorkerCandidateDashboard {
  const presentation = citizenPresentation(citizen)
  const canHireNow = founderCanManage && citizen.kind === 'sim' && recommendedBusiness !== null
  return {
    citizenId: citizen.id,
    name: citizen.name,
    displayName: presentation.displayName,
    kind: citizen.kind,
    simulated: presentation.simulated,
    participantLabel: presentation.participantLabel,
    visualTone: presentation.visualTone,
    action: workerCandidateAction(citizen, recommendedBusiness, founderCanManage),
    recommendedBusinessId: recommendedBusiness?.id ?? null,
    recommendedBusinessName: recommendedBusiness?.name ?? null,
    recommendedBusinessKind: recommendedBusiness?.kind ?? null,
    clientPayload: canHireNow
      ? { type: 'hireWorker', businessId: recommendedBusiness.id, workerCitizenId: citizen.id }
      : null,
  }
}

function workerCandidateAction(
  citizen: WorldCitizen,
  recommendedBusiness: WorldBusiness | null,
  founderCanManage: boolean,
): AreaWorkerCandidateAction {
  if (citizen.kind !== 'sim') return 'requires_acceptance'
  if (!founderCanManage && recommendedBusiness) return 'founder_unavailable'
  if (recommendedBusiness) return 'hire_now'
  return 'waiting_for_position'
}

function businessDashboard(area: WorldArea, business: WorldBusiness): AreaBusinessDashboard {
  const activeStaff = activeStaffCount(area, business)
  const targetStaff = TARGET_STAFF_BY_KIND[business.kind]
  const quality = effectiveBusinessQuality(business, area)
  const ledger = businessLedgerDashboard(area, business)
  const alerts = businessAlerts(area, business, {
    activeStaff,
    targetStaff,
    quality,
    ledger,
  })
  return {
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    price: business.price ?? DEFAULT_PRICES[business.kind],
    wagePerHour: business.wagePerHour ?? DEFAULT_WORKER_WAGE,
    quality,
    activeStaff,
    targetStaff,
    openPositions: Math.max(0, targetStaff - activeStaff),
    hourlyCapacity: serviceCapacity(area, business, 1),
    ledger,
    status: businessStatus(alerts),
    alerts,
  }
}

function businessAlerts(
  area: WorldArea,
  business: WorldBusiness,
  input: {
    activeStaff: number
    targetStaff: number
    quality: number
    ledger: AreaBusinessLedgerDashboard
  },
): AreaBusinessAlert[] {
  const alerts: AreaBusinessAlert[] = []
  const owner = area.citizens.find((citizen) => citizen.id === business.ownerId)
  if (input.activeStaff < input.targetStaff) {
    alerts.push({
      kind: 'understaffed',
      severity: input.activeStaff === 0 && input.targetStaff > 0 ? 'critical' : 'warning',
    })
  }
  const nextHourWageDue = (business.wagePerHour ?? DEFAULT_WORKER_WAGE) * input.activeStaff
  if (input.activeStaff > 0 && business.cash < nextHourWageDue) {
    alerts.push({ kind: 'cash_risk', severity: 'critical' })
  }
  if (owner?.state.kind === 'hospitalized' && input.activeStaff === 0) {
    alerts.push({ kind: 'owner_unavailable', severity: 'critical' })
  }
  if (input.quality <= MIN_BUSINESS_QUALITY || input.quality < 0.6) {
    alerts.push({ kind: 'quality_degraded', severity: input.quality <= MIN_BUSINESS_QUALITY ? 'critical' : 'warning' })
  }
  if (input.ledger.transactionCount > 0 && input.ledger.netCashFlow < 0) {
    alerts.push({ kind: 'negative_cash_flow', severity: 'warning' })
  }
  return alerts
}

function businessStatus(alerts: AreaBusinessAlert[]): AreaBusinessStatus {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical'
  if (alerts.length > 0) return 'warning'
  return 'stable'
}

function businessLedgerDashboard(area: WorldArea, business: WorldBusiness): AreaBusinessLedgerDashboard {
  const relatedTransactions = area.transactions.filter((transaction) =>
    transaction.fromId === business.id || transaction.toId === business.id,
  )
  let revenue = 0
  let expenses = 0
  let wagesPaid = 0
  let receivablesIssued = 0

  for (const transaction of relatedTransactions) {
    if (transaction.toId === business.id) {
      if (isCashRevenue(transaction.kind)) revenue = roundMoney(revenue + transaction.amount)
      if (transaction.kind === 'medical_debt') receivablesIssued = roundMoney(receivablesIssued + transaction.amount)
    }
    if (transaction.fromId === business.id) {
      if (transaction.kind === 'worker_wage') wagesPaid = roundMoney(wagesPaid + transaction.amount)
      if (isCashExpense(transaction.kind)) expenses = roundMoney(expenses + transaction.amount)
    }
  }

  return {
    transactionCount: relatedTransactions.length,
    revenue,
    expenses,
    netCashFlow: roundMoney(revenue - expenses),
    wagesPaid,
    receivablesIssued,
    recentTransactions: relatedTransactions.slice(-5).reverse().map(transactionDashboard),
  }
}

function isCashRevenue(kind: WorldTransactionKind): boolean {
  return kind === 'customer_purchase' ||
    kind === 'insurance_premium' ||
    kind === 'hospital_bill' ||
    kind === 'insurance_payout' ||
    kind === 'debt_repayment'
}

function isCashExpense(kind: WorldTransactionKind): boolean {
  return kind === 'worker_wage' || kind === 'insurance_payout'
}

function survivalDashboard(area: WorldArea): AreaSurvivalDashboard {
  const signals = area.citizens.map((citizen) => citizenSurvivalSignal(area, citizen))
  return {
    stableCitizens: signals.filter((signal) => signal.risk === 'stable').length,
    warningCitizens: signals.filter((signal) => signal.risk === 'warning').length,
    dangerCitizens: signals.filter((signal) => signal.risk === 'danger').length,
    hospitalizedCitizens: signals.filter((signal) => signal.risk === 'hospitalized').length,
    signals,
  }
}

function citizenSurvivalSignal(area: WorldArea, citizen: WorldCitizen): CitizenSurvivalSignal {
  const presentation = citizenPresentation(citizen)
  if (citizen.state.kind === 'hospitalized') {
    return {
      citizenId: citizen.id,
      name: citizen.name,
      displayName: presentation.displayName,
      kind: citizen.kind,
      simulated: presentation.simulated,
      participantLabel: presentation.participantLabel,
      visualTone: presentation.visualTone,
      risk: 'hospitalized',
      warnings: ['health'],
      actions: [survivalActionForWarning(area, citizen, 'health')],
      hospitalizedUntil: citizen.state.until,
    }
  }

  const warnings: WorldSurvivalWarningKind[] = []
  if (citizen.needs.hydration <= SURVIVAL_WARNING_HYDRATION) warnings.push('water')
  if (citizen.needs.hunger <= SURVIVAL_WARNING_HUNGER) warnings.push('food')
  if (citizen.needs.energy <= SURVIVAL_WARNING_ENERGY) warnings.push('rest')
  if (citizen.health <= SURVIVAL_WARNING_HEALTH) warnings.push('health')

  const danger =
    citizen.needs.hydration <= SURVIVAL_DANGER_NEED_LEVEL ||
    citizen.needs.hunger <= SURVIVAL_DANGER_NEED_LEVEL ||
    citizen.needs.energy <= SURVIVAL_DANGER_NEED_LEVEL ||
    citizen.health <= SURVIVAL_DANGER_HEALTH

  return {
    citizenId: citizen.id,
    name: citizen.name,
    displayName: presentation.displayName,
    kind: citizen.kind,
    simulated: presentation.simulated,
    participantLabel: presentation.participantLabel,
    visualTone: presentation.visualTone,
    risk: danger ? 'danger' : warnings.length > 0 ? 'warning' : 'stable',
    warnings,
    actions: warnings.map((warning) => survivalActionForWarning(area, citizen, warning)),
  }
}

function survivalActionForWarning(
  area: WorldArea,
  citizen: WorldCitizen,
  warning: WorldSurvivalWarningKind,
): CitizenSurvivalAction {
  const { intent, serviceKind } = survivalActionTarget(warning)
  const prices = area.businesses
    .filter((business) => business.kind === serviceKind && serviceCapacity(area, business, 1) > 0)
    .map((business) => business.price ?? DEFAULT_PRICES[serviceKind])
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null
  const available = lowestPrice !== null
  const canAfford = lowestPrice !== null && citizen.money >= lowestPrice
  const blockers: WorldSurvivalActionBlocker[] = []
  if (!available) blockers.push('service_unavailable')
  if (available && !canAfford) blockers.push('insufficient_funds')
  return {
    warning,
    intent,
    clientPayload: { type: intent },
    serviceKind,
    available,
    lowestPrice,
    canAfford,
    blockers,
  }
}

function survivalActionTarget(warning: WorldSurvivalWarningKind): {
  intent: WorldSurvivalActionIntent
  serviceKind: Exclude<WorldBusinessKind, 'insurance'>
} {
  switch (warning) {
    case 'water':
      return { intent: 'buyWater', serviceKind: 'water' }
    case 'food':
      return { intent: 'buyFood', serviceKind: 'food' }
    case 'rest':
      return { intent: 'buyHousing', serviceKind: 'housing' }
    case 'health':
      return { intent: 'visitClinic', serviceKind: 'clinic' }
  }
}

function estimateFirstBuildEconomics(
  kind: WorldBusinessKind,
  demand: number,
  supply: number,
  licensed: boolean,
): Pick<FirstBuildRecommendation, 'estimatedHourlyRevenue' | 'estimatedHourlyWageCost' | 'estimatedHourlyProfit'> {
  const blueprint = DEFAULT_BUSINESS_BLUEPRINTS[kind]
  const demandShare = licensed ? demand / (supply + 1) : 0
  const servedDemand = Math.min(demandShare, BASE_CAPACITY_PER_HOUR[kind])
  const estimatedHourlyRevenue = roundMoney(servedDemand * (blueprint.price ?? DEFAULT_PRICES[kind]))
  const estimatedHourlyWageCost = licensed
    ? roundMoney(TARGET_STAFF_BY_KIND[kind] * (blueprint.wagePerHour ?? DEFAULT_WORKER_WAGE))
    : 0
  return {
    estimatedHourlyRevenue,
    estimatedHourlyWageCost,
    estimatedHourlyProfit: roundMoney(estimatedHourlyRevenue - estimatedHourlyWageCost),
  }
}

function priorityOf(input: { demand: number; supply: number; essential: boolean; licensed: boolean; saturated: boolean }): FirstBuildPriority {
  if (input.essential && input.supply === 0 && input.demand > 0 && input.licensed) return 'critical'
  if (input.demand >= 3 && input.licensed && !input.saturated) return 'high'
  if (input.demand > 0 && input.licensed && !input.saturated) return 'medium'
  return 'low'
}

function firstBuildAction(input: {
  canBuildNow: boolean
  demand: number
  licensed: boolean
  founderMoney?: number
  founderCanAfford: boolean
  founderCanAct?: boolean
}): FirstBuildAction {
  if (input.founderMoney === undefined) return 'claim_area'
  if (input.founderCanAct === false) return 'recover_first'
  if (!input.licensed) return 'grow_demand'
  if (!input.founderCanAfford) return 'save_credits'
  if (!input.canBuildNow) return 'save_credits'
  if (input.demand <= 0) return 'wait_for_demand'
  return 'build_now'
}

function recommendationReason(
  kind: WorldBusinessKind,
  input: { demand: number; supply: number; licensed: boolean; saturated: boolean },
): string {
  if (!input.licensed) return `${kind} is saturated for the current population. Grow demand before adding another.`
  if (input.supply === 0 && input.demand > 0) return `No ${kind} service exists yet, and ${input.demand} citizens need it.`
  if (input.demand > 0) return `${input.demand} citizens currently need more ${kind} capacity.`
  if (input.saturated) return `${kind} supply is already at the current license limit.`
  return `${kind} is available, but demand is not urgent yet.`
}

function buildBusinessFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buildBusiness' }>,
): ApplyWorldIntentResult {
  const actorCheck = requireAreaFounder(area, intent.actorCitizenId)
  if (!actorCheck.ok) return actorCheck
  const { actor } = actorCheck
  const blueprint = normalizeBlueprint(intent.blueprint)
  const businessId = intent.businessId.trim()
  if (!blueprint || !businessId) return { ok: false, area, error: 'invalid_business' }
  if (area.businesses.some((business) => business.id === businessId)) {
    return { ok: false, area, error: 'business_id_taken' }
  }

  const dashboard = areaNeedsDashboard(area)
  if (dashboard.supply[blueprint.kind] >= dashboard.licenseSlots[blueprint.kind]) {
    return { ok: false, area, error: 'business_saturated' }
  }
  if (actor.money < blueprint.buildCost) return { ok: false, area, error: 'insufficient_funds' }

  actor.money = roundMoney(actor.money - blueprint.buildCost)
  area.businesses.push({
    id: businessId,
    name: blueprint.name,
    kind: blueprint.kind,
    ownerId: actor.id,
    cash: 0,
    staffCitizenIds: [],
    price: blueprint.price,
    wagePerHour: blueprint.wagePerHour,
    quality: blueprint.quality,
    createdBy: actor.id,
  })
  recordTransaction(area, area.now, {
    kind: 'business_build',
    fromId: actor.id,
    toId: 'system:builders',
    amount: blueprint.buildCost,
    memo: `${actor.name} built ${blueprint.name} in ${area.name}.`,
  })
  return { ok: true, area }
}

function hireWorkerFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'hireWorker' }>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }

  const business = area.businesses.find((candidate) => candidate.id === intent.businessId)
  if (!business) return { ok: false, area, error: 'business_not_found' }
  if (business.ownerId !== actor.id) return { ok: false, area, error: 'actor_not_business_owner' }
  if (business.staffCitizenIds.includes(intent.workerCitizenId)) {
    return { ok: false, area, error: 'worker_already_hired' }
  }

  const worker = area.citizens.find((citizen) => citizen.id === intent.workerCitizenId)
  if (!worker) return { ok: false, area, error: 'worker_not_found' }
  if (worker.kind === 'real') return { ok: false, area, error: 'real_worker_requires_acceptance' }
  if (!area.businesses.some((candidate) => candidate.kind === 'workers_hall')) {
    return { ok: false, area, error: 'workers_hall_required' }
  }
  if (worker.state.kind !== 'active' || (worker.jobBusinessId && worker.jobBusinessId !== business.id)) {
    return { ok: false, area, error: 'worker_unavailable' }
  }
  if (activeStaffCount(area, business) >= TARGET_STAFF_BY_KIND[business.kind]) {
    return { ok: false, area, error: 'business_fully_staffed' }
  }

  worker.jobBusinessId = business.id
  business.staffCitizenIds.push(worker.id)
  return { ok: true, area }
}

function buyInsuranceFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buyInsurance' }>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }
  if (hasActiveInsurance(actor, area.now)) return { ok: false, area, error: 'already_insured' }

  const insurer = area.businesses.find((business) => business.id === intent.insuranceBusinessId)
  if (!insurer) return { ok: false, area, error: 'business_not_found' }
  if (insurer.kind !== 'insurance') return { ok: false, area, error: 'not_insurance_business' }

  const premium = insurer.price ?? DEFAULT_PRICES.insurance
  if (actor.money < premium) return { ok: false, area, error: 'insufficient_funds' }

  actor.money = roundMoney(actor.money - premium)
  actor.insuranceBusinessId = insurer.id
  actor.insurancePaidUntil = area.now + INSURANCE_POLICY_PERIOD_MS
  insurer.cash = roundMoney(insurer.cash + premium)
  recordTransaction(area, area.now, {
    kind: 'insurance_premium',
    fromId: actor.id,
    toId: insurer.id,
    amount: premium,
    memo: `${actor.name} bought insurance from ${insurer.name}.`,
  })
  return { ok: true, area }
}

function buyServiceFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'buyWater' | 'buyFood' | 'buyHousing' | 'visitClinic' }>,
  kind: Exclude<WorldBusinessKind, 'insurance'>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }

  const context: StepContext = {
    at: area.now,
    hours: 1,
    servedByKind: zeroKindRecord(),
    capacityUsed: {},
    summary: emptyWorldAreaSummary(),
  }
  const business = chooseBusiness(area, kind, context)
  if (!business) return { ok: false, area, error: 'service_not_available' }

  const price = business.price ?? DEFAULT_PRICES[kind]
  if (actor.money < price) return { ok: false, area, error: 'insufficient_funds' }

  completeServicePurchase(area, actor, business, kind, context)
  return { ok: true, area }
}

function repayDebtFromIntent(
  area: WorldArea,
  intent: Extract<WorldIntent, { type: 'repayDebt' }>,
): ApplyWorldIntentResult {
  const actor = area.citizens.find((citizen) => citizen.id === intent.actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }

  if (!Number.isFinite(intent.amount) || intent.amount <= 0) {
    return { ok: false, area, error: 'invalid_debt_payment' }
  }

  const debt = actor.debts?.find((candidate) => candidate.id === intent.debtId)
  if (!debt || debt.amount <= 0) return { ok: false, area, error: 'debt_not_found' }

  const payment = roundMoney(Math.min(intent.amount, debt.amount))
  if (payment <= 0) return { ok: false, area, error: 'invalid_debt_payment' }
  if (actor.money < payment) return { ok: false, area, error: 'insufficient_funds' }

  actor.money = roundMoney(actor.money - payment)
  actor.debt = roundMoney(Math.max(0, actor.debt - payment))
  debt.amount = roundMoney(debt.amount - payment)
  if (debt.amount <= 0) actor.debts = actor.debts?.filter((candidate) => candidate.id !== debt.id)

  const creditor = area.businesses.find((business) => business.id === debt.creditorId)
  if (creditor) creditor.cash = roundMoney(creditor.cash + payment)
  recordTransaction(area, area.now, {
    kind: 'debt_repayment',
    fromId: actor.id,
    toId: debt.creditorId,
    amount: payment,
    memo: `${actor.name} repaid debt to ${debt.creditorId}.`,
  })
  return { ok: true, area }
}

function requireAreaFounder(area: WorldArea, actorCitizenId: string): RequireAreaFounderResult {
  if (!area.claim) return { ok: false, area, error: 'area_not_claimed' }
  const actor = area.citizens.find((citizen) => citizen.id === actorCitizenId)
  if (!actor) return { ok: false, area, error: 'actor_not_found' }
  if (actor.state.kind !== 'active') return { ok: false, area, error: 'actor_unavailable' }
  if (actor.id !== area.claim.founderCitizenId) return { ok: false, area, error: 'actor_not_area_founder' }
  return { ok: true, actor }
}

function normalizeBlueprint(blueprint: WorldBusinessBlueprint): WorldBusinessBlueprint | null {
  if (!BUSINESS_KINDS.includes(blueprint.kind)) return null
  if (!blueprint.name.trim()) return null
  const shopBlueprint = DEFAULT_BUSINESS_BLUEPRINTS[blueprint.kind]
  if (!matchesShopMoney(blueprint.buildCost, shopBlueprint.buildCost)) return null
  if (!matchesOptionalShopMoney(blueprint.price, shopBlueprint.price)) return null
  if (!matchesOptionalShopMoney(blueprint.wagePerHour, shopBlueprint.wagePerHour)) return null
  if (!matchesOptionalShopMoney(blueprint.quality, shopBlueprint.quality)) return null
  return {
    ...shopBlueprint,
    name: blueprint.name.trim(),
  }
}

function matchesOptionalShopMoney(value: number | undefined, shopValue: number | undefined): boolean {
  if (value === undefined) return true
  if (shopValue === undefined) return false
  return matchesShopMoney(value, shopValue)
}

function matchesShopMoney(value: number, shopValue: number): boolean {
  return Number.isFinite(value) && value > 0 && roundMoney(value) === roundMoney(shopValue)
}

function advanceStep(area: WorldArea, context: StepContext): void {
  const departingCitizens = new Map<string, WorldDepartureReason>()
  const recoveredCitizenIds = new Set<string>()
  for (const citizen of area.citizens) {
    if (citizen.state.kind === 'hospitalized') {
      if (recoverIfReady(citizen, context.at)) {
        recoveredCitizenIds.add(citizen.id)
        context.summary.recoveries += 1
      }
    }
  }

  degradeUnmanagedBusinesses(area, context.hours)
  renewInsurancePolicies(area, context)
  payWorkerWages(area, context)

  for (const citizen of area.citizens) {
    if (citizen.state.kind !== 'active') continue
    if (recoveredCitizenIds.has(citizen.id)) continue
    decayCitizen(area, citizen, context.hours)
    buyNeededServices(area, citizen, context)
    const departureReason = simDepartureReason(area, citizen, context)
    if (departureReason) {
      departingCitizens.set(citizen.id, departureReason)
      continue
    }
    if (shouldHospitalize(citizen)) hospitalize(area, citizen, context)
  }
  removeDepartingCitizens(area, departingCitizens, context)
}

function recoverIfReady(citizen: WorldCitizen, at: number): boolean {
  if (citizen.state.kind !== 'hospitalized' || citizen.state.until > at) return false
  citizen.state = { kind: 'active' }
  citizen.health = Math.max(citizen.health, 55)
  citizen.needs = {
    ...citizen.needs,
    hunger: Math.max(citizen.needs.hunger, 45),
    hydration: Math.max(citizen.needs.hydration, 45),
    energy: Math.max(citizen.needs.energy, 35),
  }
  return true
}

function degradeUnmanagedBusinesses(area: WorldArea, hours: number): void {
  if (hours <= 0) return
  const loss = UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR * hours
  for (const business of area.businesses) {
    const owner = area.citizens.find((citizen) => citizen.id === business.ownerId)
    if (owner?.state.kind !== 'hospitalized' || activeStaffCount(area, business) > 0) continue
    business.quality = roundMoney(Math.max(MIN_BUSINESS_QUALITY, (business.quality ?? 1) - loss))
  }
}

function renewInsurancePolicies(area: WorldArea, context: StepContext): void {
  for (const citizen of area.citizens) {
    if (!citizen.insuranceBusinessId || hasActiveInsurance(citizen, context.at)) {
      continue
    }

    const insurer = area.businesses.find((business) => business.id === citizen.insuranceBusinessId && business.kind === 'insurance')
    if (!insurer) {
      lapseInsurance(citizen, context)
      continue
    }

    const premium = insurer.price ?? DEFAULT_PRICES.insurance
    if (citizen.money < premium) {
      lapseInsurance(citizen, context)
      continue
    }

    citizen.money = roundMoney(citizen.money - premium)
    citizen.insurancePaidUntil = context.at + INSURANCE_POLICY_PERIOD_MS
    insurer.cash = roundMoney(insurer.cash + premium)
    context.summary.insurancePremiumsPaid = roundMoney(context.summary.insurancePremiumsPaid + premium)
    recordTransaction(area, context.at, {
      kind: 'insurance_premium',
      fromId: citizen.id,
      toId: insurer.id,
      amount: premium,
      memo: `${citizen.name} renewed insurance with ${insurer.name}.`,
    })
  }
}

function lapseInsurance(citizen: WorldCitizen, context: StepContext): void {
  delete citizen.insuranceBusinessId
  delete citizen.insurancePaidUntil
  context.summary.insurancePoliciesLapsed += 1
}

function hasActiveInsurance(citizen: WorldCitizen, at: number): boolean {
  return Boolean(citizen.insuranceBusinessId && citizen.insurancePaidUntil !== undefined && citizen.insurancePaidUntil > at)
}

function payWorkerWages(area: WorldArea, context: StepContext): void {
  for (const business of area.businesses) {
    const wage = business.wagePerHour ?? DEFAULT_WORKER_WAGE
    const due = roundMoney(wage * context.hours)
    if (due <= 0) continue
    const retainedStaffIds: string[] = []
    for (const workerId of business.staffCitizenIds) {
      const worker = area.citizens.find((c) => c.id === workerId)
      if (!worker) continue
      if (worker.state.kind !== 'active') {
        retainedStaffIds.push(workerId)
        continue
      }
      if (worker.jobBusinessId !== business.id) continue
      const paid = Math.min(due, business.cash)
      if (paid <= 0) continue
      business.cash = roundMoney(business.cash - paid)
      worker.money = roundMoney(worker.money + paid)
      context.summary.wagesPaid = roundMoney(context.summary.wagesPaid + paid)
      recordTransaction(area, context.at, {
        kind: 'worker_wage',
        fromId: business.id,
        toId: worker.id,
        amount: paid,
        memo: `${business.name} paid ${worker.name} for ${context.hours.toFixed(2)}h of work.`,
      })
      if (paid >= due) {
        retainedStaffIds.push(workerId)
      } else if (worker.jobBusinessId === business.id) {
        delete worker.jobBusinessId
      }
    }
    for (const workerId of business.staffCitizenIds) {
      if (retainedStaffIds.includes(workerId)) continue
      const worker = area.citizens.find((c) => c.id === workerId)
      if (worker?.state.kind === 'active' && worker.jobBusinessId === business.id) delete worker.jobBusinessId
    }
    business.staffCitizenIds = retainedStaffIds
  }
}

function decayCitizen(area: WorldArea, citizen: WorldCitizen, hours: number): void {
  const rates = hasActiveJob(area, citizen) ? WORKING_NEED_RATES : ACTIVE_NEED_RATES
  citizen.needs = {
    hunger: clamp(citizen.needs.hunger - rates.hunger * hours),
    hydration: clamp(citizen.needs.hydration - rates.hydration * hours),
    energy: clamp(citizen.needs.energy - rates.energy * hours),
    hygiene: clamp(citizen.needs.hygiene - rates.hygiene * hours),
    fun: clamp(citizen.needs.fun - rates.fun * hours),
  }

  if (citizen.needs.hydration <= 0) citizen.health = clamp(citizen.health - 8 * hours)
  else if (citizen.needs.hunger <= 0) citizen.health = clamp(citizen.health - 4 * hours)
  else if (citizen.needs.energy <= 0) citizen.health = clamp(citizen.health - 2 * hours)
  else if (citizen.needs.hydration > 65 && citizen.needs.hunger > 65 && citizen.needs.energy > 55) {
    citizen.health = clamp(citizen.health + 1.2 * hours)
  }
}

function buyNeededServices(area: WorldArea, citizen: WorldCitizen, context: StepContext): void {
  if (citizen.needs.hydration <= 50) purchaseService(area, citizen, 'water', context)
  if (citizen.needs.hunger <= 50) purchaseService(area, citizen, 'food', context)
  if (citizen.needs.energy <= 35) purchaseService(area, citizen, 'housing', context)
  if (citizen.health <= 65) purchaseService(area, citizen, 'clinic', context)
  if (citizen.kind === 'sim' && !hasActiveInsurance(citizen, context.at)) purchaseInsurancePolicy(area, citizen, context)
}

function simDepartureReason(area: WorldArea, citizen: WorldCitizen, context: StepContext): WorldDepartureReason | null {
  if (citizen.kind !== 'sim' || citizen.state.kind !== 'active') return null
  if (area.claim?.founderCitizenId === citizen.id) return null
  if (area.businesses.some((business) => business.ownerId === citizen.id)) return null
  if (citizen.health > SIM_LEAVES_HEALTH) return null

  if (citizen.needs.hydration <= SIM_LEAVES_NEED_LEVEL && !hasRemainingServiceCapacity(area, 'water', context)) {
    return 'water_unserved'
  }
  if (citizen.needs.hunger <= SIM_LEAVES_NEED_LEVEL && !hasRemainingServiceCapacity(area, 'food', context)) {
    return 'food_unserved'
  }
  if (citizen.needs.energy <= SIM_LEAVES_NEED_LEVEL && !hasRemainingServiceCapacity(area, 'housing', context)) {
    return 'housing_unserved'
  }
  return null
}

function hasRemainingServiceCapacity(area: WorldArea, kind: WorldBusinessKind, context: StepContext): boolean {
  return area.businesses.some((business) => {
    if (business.kind !== kind) return false
    const used = context.capacityUsed[business.id] ?? 0
    return used < serviceCapacity(area, business, context.hours)
  })
}

function removeDepartingCitizens(
  area: WorldArea,
  departures: Map<string, WorldDepartureReason>,
  context: StepContext,
): void {
  if (departures.size === 0) return
  const departingIds = new Set(departures.keys())
  const departureEvents: WorldAreaEvent[] = []
  for (const [citizenId, reason] of departures) {
    const citizen = area.citizens.find((candidate) => candidate.id === citizenId)
    if (citizen) departureEvents.push(simDepartureEvent(area, citizen, context.at, reason))
  }
  if (departureEvents.length > 0) {
    area.areaEvents = [...(area.areaEvents ?? []), ...departureEvents]
  }
  area.citizens = area.citizens.filter((citizen) => !departingIds.has(citizen.id))
  for (const business of area.businesses) {
    business.staffCitizenIds = business.staffCitizenIds.filter((id) => !departingIds.has(id))
  }
  context.summary.citizensLeft += departures.size
}

function simDepartureEvent(
  area: WorldArea,
  citizen: WorldCitizen,
  at: number,
  reason: WorldDepartureReason,
): WorldAreaEvent {
  const serviceKind = departureServiceKind(reason)
  return {
    id: `${area.id}:${at}:sim-departure:${citizen.id}:${serviceKind}`,
    at,
    kind: 'sim_citizen_departure',
    severity: 'warning',
    citizenId: citizen.id,
    citizenName: citizen.name,
    simulated: true,
    reason,
    serviceKind,
    health: citizen.health,
    needs: { ...citizen.needs },
    message: `${citizen.name} left the area because ${serviceKind} stayed unserved while health was low.`,
  }
}

function departureServiceKind(reason: WorldDepartureReason): WorldDepartureServiceKind {
  switch (reason) {
    case 'water_unserved':
      return 'water'
    case 'food_unserved':
      return 'food'
    case 'housing_unserved':
      return 'housing'
  }
}

function purchaseService(
  area: WorldArea,
  citizen: WorldCitizen,
  kind: WorldBusinessKind,
  context: StepContext,
): boolean {
  const business = chooseBusiness(area, kind, context)
  if (!business) return false
  const price = business.price ?? DEFAULT_PRICES[kind]
  if (citizen.money < price) return false

  completeServicePurchase(area, citizen, business, kind, context)
  return true
}

function completeServicePurchase(
  area: WorldArea,
  citizen: WorldCitizen,
  business: WorldBusiness,
  kind: WorldBusinessKind,
  context: StepContext,
): void {
  const price = business.price ?? DEFAULT_PRICES[kind]
  reserveBusinessCapacity(context, business)
  citizen.money = roundMoney(citizen.money - price)
  business.cash = roundMoney(business.cash + price)
  context.summary.purchases += 1
  context.summary.revenueByBusiness[business.id] = roundMoney((context.summary.revenueByBusiness[business.id] ?? 0) + price)
  recordTransaction(area, context.at, {
    kind: 'customer_purchase',
    fromId: citizen.id,
    toId: business.id,
    amount: price,
    memo: `${citizen.name} bought ${kind} from ${business.name}.`,
  })

  applyServiceEffect(citizen, SERVICE_EFFECTS[kind], effectiveBusinessQuality(business, area))
  if (kind === 'housing') citizen.homeBusinessId = business.id
}

function purchaseInsurancePolicy(
  area: WorldArea,
  citizen: WorldCitizen,
  context: StepContext,
): boolean {
  const insurer = chooseBusiness(area, 'insurance', context)
  if (!insurer) return false
  const premium = insurer.price ?? DEFAULT_PRICES.insurance
  if (citizen.money < premium) return false

  reserveBusinessCapacity(context, insurer)
  citizen.money = roundMoney(citizen.money - premium)
  citizen.insuranceBusinessId = insurer.id
  citizen.insurancePaidUntil = context.at + INSURANCE_POLICY_PERIOD_MS
  insurer.cash = roundMoney(insurer.cash + premium)
  context.summary.insurancePremiumsPaid = roundMoney(context.summary.insurancePremiumsPaid + premium)
  recordTransaction(area, context.at, {
    kind: 'insurance_premium',
    fromId: citizen.id,
    toId: insurer.id,
    amount: premium,
    memo: `${citizen.name} bought insurance from ${insurer.name}.`,
  })
  return true
}

function chooseBusiness(area: WorldArea, kind: WorldBusinessKind, context: StepContext): WorldBusiness | null {
  const candidates = area.businesses
    .filter((business) => business.kind === kind && serviceCapacity(area, business, context.hours) > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (candidates.length === 0) return null

  const start = context.servedByKind[kind] % candidates.length
  for (let offset = 0; offset < candidates.length; offset++) {
    const business = candidates[(start + offset) % candidates.length]
    const capacity = serviceCapacity(area, business, context.hours)
    const used = context.capacityUsed[business.id] ?? 0
    if (used < capacity) return business
  }
  return null
}

function reserveBusinessCapacity(context: StepContext, business: WorldBusiness): void {
  context.capacityUsed[business.id] = (context.capacityUsed[business.id] ?? 0) + 1
  context.servedByKind[business.kind] += 1
}

function serviceCapacity(area: WorldArea, business: WorldBusiness, hours: number): number {
  const activeStaff = activeStaffCount(area, business)
  const staffMultiplier = activeStaff === 0 ? 1 : 1 + activeStaff * 0.75
  const quality = effectiveBusinessQuality(business, area)
  return Math.floor(BASE_CAPACITY_PER_HOUR[business.kind] * hours * staffMultiplier * quality)
}

function activeStaffCount(area: WorldArea, business: WorldBusiness): number {
  return business.staffCitizenIds
    .map((id) => area.citizens.find((c) => c.id === id))
    .filter((c): c is WorldCitizen => c?.state.kind === 'active' && c.jobBusinessId === business.id).length
}

function applyServiceEffect(citizen: WorldCitizen, effect: ServiceEffect, quality: number): void {
  const nextNeeds = { ...citizen.needs }
  for (const key of Object.keys(nextNeeds) as (keyof Needs)[]) {
    const boost = effect[key]
    if (boost !== undefined) nextNeeds[key] = clamp(nextNeeds[key] + boost * quality)
  }
  citizen.needs = nextNeeds
  if (effect.health !== undefined) citizen.health = clamp(citizen.health + effect.health * quality)
}

function shouldHospitalize(citizen: WorldCitizen): boolean {
  return citizen.health <= COLLAPSE_HEALTH || (citizen.needs.hydration <= 0 && citizen.money < DEFAULT_PRICES.water)
}

function hospitalize(area: WorldArea, citizen: WorldCitizen, context: StepContext): void {
  citizen.health = Math.max(citizen.health, 30)
  context.summary.hospitalizations += 1
  const insurancePaid = settleHospitalBill(area, citizen, context)
  const recoveryHours = insurancePaid ? INSURED_HOSPITALIZATION_HOURS : HOSPITALIZATION_HOURS
  citizen.state = { kind: 'hospitalized', until: context.at + recoveryHours * WORLD_SIM_HOUR_MS }
}

function settleHospitalBill(area: WorldArea, citizen: WorldCitizen, context: StepContext): boolean {
  const clinic = area.businesses.find((business) => business.kind === 'clinic')
  const receiverId = clinic?.id ?? 'system:hospital'
  let remaining = HOSPITAL_BILL
  let insurancePaid = false

  const insurer = hasActiveInsurance(citizen, context.at)
    ? area.businesses.find((business) => business.id === citizen.insuranceBusinessId && business.kind === 'insurance')
    : undefined
  if (insurer) {
    const coverage = Math.min(roundMoney(HOSPITAL_BILL * INSURANCE_COVERAGE), insurer.cash)
    if (coverage > 0) {
      insurancePaid = true
      insurer.cash = roundMoney(insurer.cash - coverage)
      if (clinic) clinic.cash = roundMoney(clinic.cash + coverage)
      remaining = roundMoney(remaining - coverage)
      recordTransaction(area, context.at, {
        kind: 'insurance_payout',
        fromId: insurer.id,
        toId: receiverId,
        amount: coverage,
        memo: `${insurer.name} covered part of ${citizen.name}'s hospital bill.`,
      })
    }
  }

  const citizenPaid = Math.min(remaining, citizen.money)
  if (citizenPaid > 0) {
    citizen.money = roundMoney(citizen.money - citizenPaid)
    if (clinic) clinic.cash = roundMoney(clinic.cash + citizenPaid)
    remaining = roundMoney(remaining - citizenPaid)
    recordTransaction(area, context.at, {
      kind: 'hospital_bill',
      fromId: citizen.id,
      toId: receiverId,
      amount: citizenPaid,
      memo: `${citizen.name} paid a hospital bill.`,
    })
  }

  if (remaining > 0) {
    issueMedicalDebt(citizen, receiverId, remaining, context)
    recordTransaction(area, context.at, {
      kind: 'medical_debt',
      fromId: citizen.id,
      toId: receiverId,
      amount: remaining,
      memo: `${citizen.name} left the hospital bill as medical debt.`,
    })
  }

  return insurancePaid
}

function issueMedicalDebt(citizen: WorldCitizen, creditorId: string, amount: number, context: StepContext): void {
  const debtAmount = roundMoney(amount)
  citizen.debt = roundMoney(citizen.debt + debtAmount)
  citizen.debts = [
    ...(citizen.debts ?? []),
    {
      id: `${citizen.id}:${context.at}:${(citizen.debts?.length ?? 0) + 1}:medical`,
      kind: 'medical',
      creditorId,
      amount: debtAmount,
      issuedAt: context.at,
      memo: `${citizen.name} owes medical debt to ${creditorId}.`,
    },
  ]
  context.summary.debtsIssued = roundMoney(context.summary.debtsIssued + debtAmount)
}

function recordTransaction(
  area: WorldArea,
  at: number,
  tx: Omit<WorldTransaction, 'id' | 'at' | 'payoutEligibility'>,
): void {
  area.transactions.push({
    id: `${area.id}:${at}:${area.transactions.length + 1}:${tx.kind}`,
    at,
    payoutEligibility: 'game_only',
    ...tx,
    amount: roundMoney(tx.amount),
  })
}

function cloneArea(area: WorldArea): WorldArea {
  return {
    ...area,
    claim: area.claim ? { ...area.claim } : undefined,
    citizens: area.citizens.map(cloneCitizen),
    businesses: area.businesses.map((business) => ({
      ...business,
      staffCitizenIds: [...business.staffCitizenIds],
    })),
    transactions: area.transactions.map((tx) => ({ ...tx })),
    areaEvents: area.areaEvents?.map((event) => ({
      ...event,
      needs: { ...event.needs },
    })),
  }
}

function cloneCitizen(citizen: WorldCitizen): WorldCitizen {
  return {
    ...citizen,
    debts: citizen.debts?.map((debt) => ({ ...debt })),
    needs: { ...citizen.needs },
    state: citizen.state.kind === 'hospitalized'
      ? { kind: 'hospitalized', until: citizen.state.until }
      : { kind: 'active' },
  }
}

function zeroKindRecord(): Record<WorldBusinessKind, number> {
  return { water: 0, food: 0, housing: 0, clinic: 0, insurance: 0, workers_hall: 0 }
}

function zeroTransactionKindRecord(): Record<WorldTransactionKind, number> {
  return {
    founder_credit: 0,
    sim_citizen_credit: 0,
    customer_purchase: 0,
    business_build: 0,
    worker_wage: 0,
    hospital_bill: 0,
    insurance_premium: 0,
    insurance_payout: 0,
    medical_debt: 0,
    debt_repayment: 0,
    workers_hall_build: 0,
  }
}

function emptyWorldAreaSummary(): WorldAreaSummary {
  return {
    purchases: 0,
    wagesPaid: 0,
    hospitalizations: 0,
    recoveries: 0,
    citizensLeft: 0,
    insurancePremiumsPaid: 0,
    insurancePoliciesLapsed: 0,
    debtsIssued: 0,
    revenueByBusiness: {},
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
