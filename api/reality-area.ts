import { createHash, timingSafeEqual } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyRealityOperatorQueueToken, type RealityOperatorQueueTokenClaims } from './reality-operator-token'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FOUNDER_STARTER_CREDIT = 200_000
const SIM_CITIZEN_STARTER_CREDIT = 100
const MIN_FOUNDER_AREA_RADIUS_KM = 0.25
const MAX_FOUNDER_AREA_RADIUS_KM = 5
const PLATFORM_BANK_ID = 'reality-founder-bank'
const SIM_CREDIT_ACCOUNT_ID = 'system:sim-credit'
const BUILDER_RECEIVER_ID = 'system:builders'
const SYSTEM_HOSPITAL_ACCOUNT_ID = 'system:hospital'
const FOUNDER_LEGACY_TREASURY_ACCOUNT_ID = 'system:founder-legacy-treasury'
const PLATFORM_FEE_ACCOUNT_ID = 'system:reality-platform-fees'
const FOUNDER_LEGACY_ROYALTY_RATE = 0.1
const LAND_LEASE_PLATFORM_FEE_RATE = 0.05
const LAND_LEASE_TEMPLATE_TERM_DAYS = 30
const AREA_STATE_VERSION = 1
const SERVER_CLOCK_TOKEN_ENV = 'REALITY_SERVER_CLOCK_TOKEN'
const SERVER_CLOCK_TOKEN_HEADER = 'x-reality-server-clock-token'
const OPERATOR_AUTH_SECRET_ENV = 'REALITY_OPERATOR_AUTH_SECRET'
const SERVER_CLOCK_DEFAULT_AREA_LIMIT = 25
const SERVER_CLOCK_MAX_AREA_LIMIT = 100
const SERVER_CLOCK_DEFAULT_AREA_PAGES = 1
const SERVER_CLOCK_MAX_AREA_PAGES = 5
const SERVER_CLOCK_CURSOR_MAX_LENGTH = 1024
const FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_AREA_LIMIT = SERVER_CLOCK_DEFAULT_AREA_LIMIT
const FOUNDER_COVENANT_REVIEW_QUEUE_MAX_AREA_LIMIT = SERVER_CLOCK_MAX_AREA_LIMIT
const FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_AREA_PAGES = SERVER_CLOCK_DEFAULT_AREA_PAGES
const FOUNDER_COVENANT_REVIEW_QUEUE_MAX_AREA_PAGES = SERVER_CLOCK_MAX_AREA_PAGES
const FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH = SERVER_CLOCK_CURSOR_MAX_LENGTH
const INSURANCE_POLICY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000
const FOUNDER_COVENANT_WEEKLY_REVIEW_MS = 7 * 24 * 60 * 60 * 1000
const FOUNDER_COVENANT_MONTHLY_REVIEW_MS = 30 * 24 * 60 * 60 * 1000
const INSURANCE_COVERAGE = 0.6
const CLAIM_SOURCES = ['manual', 'ip', 'geolocation', 'telegram'] as const
const BUSINESS_KINDS = ['water', 'food', 'housing', 'clinic', 'insurance'] as const
const TRANSACTION_KINDS = [
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
] as const

type AreaClaimSource = typeof CLAIM_SOURCES[number]
type FounderAreaBusinessKind = typeof BUSINESS_KINDS[number]
type FounderAreaTransactionKind = typeof TRANSACTION_KINDS[number]
type FounderAreaTransactionPayoutEligibility = 'game_only' | 'payout_eligible'
type FounderAreaEventKind = 'sim_citizen_departure'
type FounderAreaEventSeverity = 'info' | 'warning' | 'critical'
type FounderAreaDepartureReason = 'water_unserved' | 'food_unserved' | 'housing_unserved'
type FounderAreaDepartureServiceKind = 'water' | 'food' | 'housing'

interface CitizenAuthRecord {
  citizenId: string
  founderNumber: number
  telegramUserId?: string
  telegramAccountId?: string
  telegramUsername?: string
  telegramName?: string
  telegramLinkedAt?: string
}

interface FounderAreaClaim {
  founderCitizenId: string
  founderNumber: number
  label: string
  centerLat: number
  centerLng: number
  radiusKm: number
  claimedAt: string
  source: AreaClaimSource
  telegramUserId?: string
  telegramAccountId?: string
}

interface FounderAreaTransaction {
  id: string
  at: string
  kind: FounderAreaTransactionKind
  payoutEligibility: FounderAreaTransactionPayoutEligibility
  fromId: string
  toId: string
  amount: number
  memo: string
}

interface FounderAreaEvent {
  id: string
  at: string
  kind: FounderAreaEventKind
  severity: FounderAreaEventSeverity
  citizenId: string
  citizenName: string
  simulated: boolean
  reason: FounderAreaDepartureReason
  serviceKind: FounderAreaDepartureServiceKind
  health: number
  needs: FounderAreaNeeds
  message: string
}

interface FounderAreaNeeds {
  hunger: number
  hydration: number
  energy: number
  hygiene: number
  fun: number
}

interface FounderAreaCitizen {
  id: string
  name: string
  kind: 'real' | 'sim'
  money: number
  debt: number
  debts?: FounderAreaDebt[]
  needs: FounderAreaNeeds
  health: number
  state: { kind: 'active' } | { kind: 'hospitalized'; until: string }
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  insurancePaidUntil?: string
  heirCitizenId?: string
}

interface FounderAreaDebt {
  id: string
  kind: 'medical'
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
}

interface FounderAreaBusiness {
  id: string
  name: string
  kind: FounderAreaBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  staffCitizenIds: string[]
  createdAt: string
  createdBy: string
}

type FounderAreaCovenantStatus = 'active' | 'watch' | 'manual_review'
type FounderAreaCovenantNextAction = 'none' | 'warn_founder' | 'manual_review'
type FounderAreaCovenantSignalSeverity = 'info' | 'warning' | 'critical'
type FounderAreaCovenantReviewChecklistStatus = 'met' | 'watch' | 'manual_review'
type FounderAreaCovenantReviewQueueNextStep = 'record_review' | 'main_founder_approval' | 'monitor'
type FounderAreaCovenantReviewInputKind =
  | 'in_game_activity'
  | 'area_health'
  | 'population_growth'
  | 'external_contribution'
  | 'ideas_feedback'
  | 'review_consistency'
type FounderAreaCovenantManualEvidenceKind = Extract<
  FounderAreaCovenantReviewInputKind,
  'population_growth' | 'external_contribution' | 'ideas_feedback'
>
type FounderAreaCovenantReviewInputStatus = 'captured' | 'watch' | 'manual_needed'
type FounderAreaCovenantStageKind = 'active' | 'warning' | 'probation' | 'removed' | 'waitlist_replacement'
type FounderAreaCovenantStageStatus = 'current' | 'recommended' | 'locked'
type FounderAreaCovenantManualActionKind =
  | 'record_review'
  | 'send_warning'
  | 'start_probation'
  | 'recommend_replacement'
type FounderAreaCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'sim_departure'
  | 'founder_debt'
  | 'review_due'

interface FounderAreaCovenantSignal {
  kind: FounderAreaCovenantSignalKind
  severity: FounderAreaCovenantSignalSeverity
  message: string
  businessIds?: string[]
  businessKinds?: FounderAreaBusinessKind[]
  amount?: number
}

interface FounderAreaCovenantActivityReview {
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

interface FounderAreaCovenantReviewChecklistItem {
  key: string
  label: string
  status: FounderAreaCovenantReviewChecklistStatus
  evidence: string
}

interface FounderAreaCovenantReviewInput {
  kind: FounderAreaCovenantReviewInputKind
  label: string
  status: FounderAreaCovenantReviewInputStatus
  evidence: string
  manualEvidenceRequired: boolean
}

interface FounderAreaCovenantStage {
  kind: FounderAreaCovenantStageKind
  label: string
  status: FounderAreaCovenantStageStatus
  reason: string
  requiresMainFounderApproval: boolean
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

interface FounderAreaCovenantReviewQueue {
  evidenceOnly: true
  automationEnabled: false
  executionEnabled: false
  nextStep: FounderAreaCovenantReviewQueueNextStep
  recordReviewEnabled: boolean
  recommendedActionKinds: readonly FounderAreaCovenantManualActionKind[]
  pendingApprovalKinds: readonly FounderAreaCovenantApprovalRequestKind[]
  pendingApprovalCount: number
  pendingNotificationKinds: readonly FounderAreaCovenantNotificationDraftKind[]
  pendingNotificationCount: number
  blockerCount: number
  blockers: readonly FounderAreaCovenantApprovalBlocker[]
}

interface FounderAreaCovenantManualActionClientPayload {
  type: 'recordCovenantReview'
  actionKind: 'record_review'
  note?: string
}

type FounderAreaCovenantAuthorityRole = 'area_reviewer' | 'main_founder'
type FounderAreaCovenantAuthorityStatus = 'evidence_only' | 'approval_required'

interface FounderAreaCovenantAuthorityGate {
  requiredRole: FounderAreaCovenantAuthorityRole
  status: FounderAreaCovenantAuthorityStatus
  approvedById: null
  approvedAt: null
  executionEnabled: boolean
}

interface FounderAreaCovenantManualAction {
  kind: FounderAreaCovenantManualActionKind
  label: string
  recommended: boolean
  requiresApproval: true
  automationEnabled: false
  authorityGate: FounderAreaCovenantAuthorityGate
  reason: string
  clientPayload: FounderAreaCovenantManualActionClientPayload | null
}

type FounderAreaCovenantApprovalRequestKind = Exclude<FounderAreaCovenantManualActionKind, 'record_review'>
type FounderAreaCovenantApprovalRequestStatus = 'pending_manual_approval'
type FounderAreaCovenantApprovalBlocker =
  | 'approval_workflow_disabled'
  | 'telegram_delivery_disabled'
  | 'probation_execution_disabled'
  | 'replacement_disabled'
  | 'waitlist_handoff_disabled'

interface FounderAreaCovenantApprovalRequest {
  id: string
  at: string
  kind: FounderAreaCovenantApprovalRequestKind
  label: string
  reason: string
  status: FounderAreaCovenantApprovalRequestStatus
  recommended: true
  requiresApproval: true
  approvalEnabled: false
  automationEnabled: false
  executionEnabled: false
  authorityGate: FounderAreaCovenantAuthorityGate
  notificationDraftId: string | null
  blockers: readonly FounderAreaCovenantApprovalBlocker[]
}

interface FounderAreaCovenantReviewHistoryItem {
  id: string
  at: string
  reviewerId: string
  actionKind: FounderAreaCovenantManualActionKind
  summary: string
  authorityGate: FounderAreaCovenantAuthorityGate
  decision: FounderAreaCovenantReviewDecisionSnapshot | null
  signals: FounderAreaCovenantSignal[]
  activityReview: FounderAreaCovenantActivityReview | null
  reviewQueue: FounderAreaCovenantReviewQueue
  reviewInputs: FounderAreaCovenantReviewInput[]
  stages: FounderAreaCovenantStage[]
  reviewChecklist: FounderAreaCovenantReviewChecklistItem[]
  manualActions: FounderAreaCovenantManualAction[]
  approvalRequests: FounderAreaCovenantApprovalRequest[]
  reviewSchedule: FounderAreaCovenantReviewSchedule | null
}

interface FounderAreaCovenantReviewDecisionSnapshot {
  status: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  manualReviewRequired: boolean
}

interface FounderAreaCovenantLatestReview {
  id: string
  reviewedAt: string
  reviewerId: string
  actionKind: FounderAreaCovenantManualActionKind
  summary: string
  authorityGate: FounderAreaCovenantAuthorityGate
  decision: FounderAreaCovenantReviewDecisionSnapshot | null
  signals: FounderAreaCovenantSignal[]
  activityReview: FounderAreaCovenantActivityReview | null
  reviewQueue: FounderAreaCovenantReviewQueue
  reviewInputs: FounderAreaCovenantReviewInput[]
  stages: FounderAreaCovenantStage[]
  reviewChecklist: FounderAreaCovenantReviewChecklistItem[]
  manualActions: FounderAreaCovenantManualAction[]
  approvalRequests: FounderAreaCovenantApprovalRequest[]
  reviewSchedule: FounderAreaCovenantReviewSchedule | null
  evidenceOnly: true
  automationEnabled: false
}

interface FounderAreaCovenantReviewSchedule {
  lastReviewAt: string | null
  nextWeeklyReviewAt: string
  nextMonthlyReviewAt: string
  weeklyReviewDue: boolean
  monthlyReviewDue: boolean
  overdue: boolean
  automationEnabled: false
}

type FounderAreaCovenantNotificationDraftKind = 'founder_warning' | 'manual_review_required'
type FounderAreaCovenantNotificationChannel = 'telegram'
type FounderAreaSettlementRail = 'ton'
type FounderAreaSettlementMode = 'ledger_only'
type FounderAreaSettlementBlocker =
  | 'ton_connect_disabled'
  | 'deposits_disabled'
  | 'withdrawals_disabled'
  | 'land_reservations_disabled'
  | 'leases_disabled'
  | 'manual_payout_review_required'
  | 'compliance_review_required'
type FounderAreaPayoutReadinessBlocker =
  | 'game_credits_only'
  | 'payouts_disabled'
  | 'withdrawals_disabled'
  | 'kyc_disabled'
  | 'tax_profile_disabled'
  | 'manual_payout_review_required'
  | 'compliance_review_required'
  | 'ton_settlement_disabled'
type FounderAreaLegacyRoyaltyBlocker =
  | 'replacement_workflow_disabled'
  | 'waitlist_handoff_disabled'
  | 'treasury_payout_disabled'
  | 'compliance_review_required'
type FounderAreaHandoffBlocker =
  | 'replacement_workflow_disabled'
  | 'waitlist_handoff_disabled'
  | 'candidate_selection_disabled'
  | 'main_founder_approval_required'
  | 'manual_review_required'
type FounderAreaLandRightsBlocker =
  | 'land_reservations_disabled'
  | 'land_purchases_disabled'
  | 'leases_disabled'
  | 'rent_collection_disabled'
  | 'operator_acceptance_disabled'
  | 'manual_review_required'
  | 'compliance_review_required'
type FounderAreaGrowthBlocker =
  | 'telegram_invite_links_disabled'
  | 'invite_tracking_disabled'
  | 'automatic_growth_rewards_disabled'
  | 'manual_review_required'

const DISABLED_SETTLEMENT_INTENT_TYPES = [
  'connectTonWallet',
  'disconnectTonWallet',
  'depositCredits',
  'withdrawCredits',
  'reserveLand',
  'createLandLease',
] as const
type DisabledSettlementIntentType = typeof DISABLED_SETTLEMENT_INTENT_TYPES[number]

const DISABLED_ESTATE_PROTECTION_INTENT_TYPES = [
  'nameHeir',
  'setHeir',
  'clearHeir',
  'acceptEstateTransfer',
  'claimEstateFromWaitlist',
] as const
type DisabledEstateProtectionIntentType = typeof DISABLED_ESTATE_PROTECTION_INTENT_TYPES[number]

interface FounderAreaCovenantNotificationDraft {
  id: string
  at: string
  kind: FounderAreaCovenantNotificationDraftKind
  channel: FounderAreaCovenantNotificationChannel
  recipientCitizenId: string
  title: string
  body: string
  requiresApproval: true
  sendEnabled: false
  authorityGate: FounderAreaCovenantAuthorityGate
}

interface FounderAreaCovenantReview {
  founderCitizenId: string
  status: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  reviewCadence: 'weekly_monthly_manual'
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: FounderAreaCovenantActivityReview
  reviewQueue: FounderAreaCovenantReviewQueue
  reviewInputs: FounderAreaCovenantReviewInput[]
  stages: FounderAreaCovenantStage[]
  reviewChecklist: FounderAreaCovenantReviewChecklistItem[]
  manualActions: FounderAreaCovenantManualAction[]
  approvalRequests: FounderAreaCovenantApprovalRequest[]
  reviewSchedule: FounderAreaCovenantReviewSchedule
  latestReview: FounderAreaCovenantLatestReview | null
  reviewHistory: FounderAreaCovenantReviewHistoryItem[]
  notificationDrafts: FounderAreaCovenantNotificationDraft[]
  signals: FounderAreaCovenantSignal[]
}

interface FounderAreaJobsDashboard {
  employedCitizens: number
  unemployedCitizens: number
  hireableSimWorkers: number
  realWorkersRequiringAcceptance: number
  openPositions: number
  understaffedBusinesses: number
  candidates: FounderAreaWorkerCandidateDashboard[]
}

type FounderAreaWorkerCandidateAction =
  | 'hire_now'
  | 'requires_acceptance'
  | 'waiting_for_position'
  | 'founder_unavailable'

interface FounderAreaWorkerCandidateDashboard {
  citizenId: string
  name: string
  displayName: string
  kind: FounderAreaCitizen['kind']
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  action: FounderAreaWorkerCandidateAction
  recommendedBusinessId: string | null
  recommendedBusinessName: string | null
  recommendedBusinessKind: FounderAreaBusinessKind | null
  clientPayload: {
    type: 'hireWorker'
    businessId: string
    workerCitizenId: string
  } | null
}

interface FounderAreaLicenseDashboard {
  slots: number
  used: number
  remaining: number
  saturation: number
}

type FounderAreaFirstBuildPriority = 'critical' | 'high' | 'medium' | 'low'
type FounderAreaFirstBuildAction = 'claim_area' | 'build_now' | 'save_credits' | 'grow_demand' | 'wait_for_demand' | 'recover_first'
type FounderAreaFirstBuildBlocker = 'area_unclaimed' | 'insufficient_funds' | 'license_unavailable' | 'actor_unavailable'

interface FounderAreaFirstBuildRecommendation {
  kind: FounderAreaBusinessKind
  name: string
  proposedBusinessId: string | null
  priority: FounderAreaFirstBuildPriority
  action: FounderAreaFirstBuildAction
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
  blockers: FounderAreaFirstBuildBlocker[]
  licensed: boolean
  saturated: boolean
  score: number
  estimatedHourlyRevenue: number
  estimatedHourlyWageCost: number
  estimatedHourlyProfit: number
  estimatedPaybackHours: number | null
  clientPayload: {
    type: 'buildBusiness'
    businessKind: FounderAreaBusinessKind
    businessId: string
    name: string
  } | null
  reason: string
}

type FounderAreaBusinessStatus = 'stable' | 'warning' | 'critical'
type FounderAreaBusinessAlertSeverity = 'warning' | 'critical'
type FounderAreaBusinessAlertKind =
  | 'understaffed'
  | 'cash_risk'
  | 'owner_unavailable'
  | 'quality_degraded'
  | 'negative_cash_flow'

interface FounderAreaBusinessAlert {
  kind: FounderAreaBusinessAlertKind
  severity: FounderAreaBusinessAlertSeverity
}

interface FounderAreaBusinessLedgerDashboard {
  transactionCount: number
  revenue: number
  expenses: number
  netCashFlow: number
  wagesPaid: number
  receivablesIssued: number
  recentTransactions: FounderAreaTransaction[]
}

interface FounderAreaBusinessDashboard {
  id: string
  name: string
  kind: FounderAreaBusinessKind
  ownerId: string
  cash: number
  price: number
  wagePerHour: number
  quality: number
  activeStaff: number
  targetStaff: number
  openPositions: number
  hourlyCapacity: number
  ledger: FounderAreaBusinessLedgerDashboard
  status: FounderAreaBusinessStatus
  alerts: FounderAreaBusinessAlert[]
}

type FounderAreaDebtRepaymentBlocker = 'actor_unavailable' | 'insufficient_funds'
type FounderAreaInsuranceActionBlocker =
  | 'actor_unavailable'
  | 'already_insured'
  | 'service_unavailable'
  | 'insufficient_funds'
type FounderAreaEstateProtectionBlocker =
  | 'death_disabled'
  | 'heir_naming_disabled'
  | 'estate_transfer_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_review_required'

interface FounderAreaCitizenDebtDashboard {
  id: string
  kind: FounderAreaDebt['kind']
  creditorId: string
  amount: number
  issuedAt: string
  memo: string
  repaymentIntent: 'repayDebt'
  clientPayload: { type: 'repayDebt'; debtId: string; amount: number } | null
  recommendedPayment: number
  maxAffordablePayment: number
  canRepayNow: boolean
  blockers: FounderAreaDebtRepaymentBlocker[]
}

interface FounderAreaInsuranceActionDashboard {
  intent: 'buyInsurance'
  clientPayload: { type: 'buyInsurance'; insuranceBusinessId: string } | null
  insuranceBusinessId: string | null
  premium: number | null
  available: boolean
  canAfford: boolean
  canBuyNow: boolean
  blockers: FounderAreaInsuranceActionBlocker[]
}

interface FounderAreaEstateProtectionDashboard {
  enabled: false
  namingEnabled: false
  transferEnabled: false
  waitlistFallbackEnabled: false
  manualReviewRequired: true
  namedHeirCitizenId: string | null
  namedHeirName: string | null
  protectedByInsurance: boolean
  status: 'disabled_until_death_enabled'
  blockers: FounderAreaEstateProtectionBlocker[]
}

interface FounderAreaCitizenDashboard {
  id: string
  name: string
  displayName: string
  kind: FounderAreaCitizen['kind']
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  state: FounderAreaCitizen['state']['kind']
  health: number
  needs: FounderAreaNeeds
  money: number
  debt: number
  debts: FounderAreaCitizenDebtDashboard[]
  homeBusinessId?: string
  jobBusinessId?: string
  insuranceBusinessId?: string
  heirCitizenId?: string
  insuranceActive: boolean
  insuranceAction: FounderAreaInsuranceActionDashboard
  estateProtection: FounderAreaEstateProtectionDashboard
}

type FounderAreaSurvivalRiskLevel = 'stable' | 'warning' | 'danger' | 'hospitalized'
type FounderAreaSurvivalWarningKind = 'water' | 'food' | 'rest' | 'health'
type FounderAreaSurvivalActionIntent = 'buyWater' | 'buyFood' | 'buyHousing' | 'visitClinic'
type FounderAreaSurvivalActionBlocker = 'service_unavailable' | 'insufficient_funds'

interface FounderAreaSurvivalAction {
  warning: FounderAreaSurvivalWarningKind
  intent: FounderAreaSurvivalActionIntent
  clientPayload: { type: FounderAreaSurvivalActionIntent }
  serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>
  available: boolean
  lowestPrice: number | null
  canAfford: boolean
  blockers: FounderAreaSurvivalActionBlocker[]
}

interface FounderAreaSurvivalSignal {
  citizenId: string
  name: string
  displayName: string
  kind: FounderAreaCitizen['kind']
  simulated: boolean
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
  risk: FounderAreaSurvivalRiskLevel
  warnings: FounderAreaSurvivalWarningKind[]
  actions: FounderAreaSurvivalAction[]
  hospitalizedUntil?: string
}

interface FounderAreaSurvivalDashboard {
  stableCitizens: number
  warningCitizens: number
  dangerCitizens: number
  hospitalizedCitizens: number
  signals: FounderAreaSurvivalSignal[]
}

interface FounderAreaLedgerDashboard {
  transactionCount: number
  totalsByKind: Record<FounderAreaTransactionKind, number>
  payoutClassification: FounderAreaLedgerPayoutClassificationDashboard
  recentTransactions: FounderAreaTransaction[]
}

interface FounderAreaLedgerPayoutClassificationDashboard {
  gameOnlyTransactionCount: number
  gameOnlyAmount: number
  payoutEligibleTransactionCount: 0
  payoutEligibleAmount: 0
  manualPayoutReviewRequired: true
  realWithdrawalEligible: false
}

interface FounderAreaEventDashboard extends FounderAreaEvent {
  displayName: string
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
}

interface FounderAreaEventsDashboard {
  eventCount: number
  simDepartures: number
  warningEvents: number
  criticalEvents: number
  recentEvents: FounderAreaEventDashboard[]
}

interface FounderAreaSettlementDashboard {
  rail: FounderAreaSettlementRail
  mode: FounderAreaSettlementMode
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
  blockers: readonly FounderAreaSettlementBlocker[]
}

interface FounderAreaPayoutReadinessDashboard {
  enabled: false
  mode: 'game_credits_only'
  gameplayLedgerSource: 'reality_server'
  gameCredits: number
  payoutEligibleCredits: 0
  realWithdrawalsEnabled: false
  manualPayoutApprovalEnabled: false
  kycRequired: true
  kycStatus: 'not_started'
  taxProfileRequired: true
  taxProfileStatus: 'not_started'
  complianceReviewRequired: true
  noProfitPromise: true
  tonSettlementEnabled: false
  stablecoinRailPlanned: true
  blockers: readonly FounderAreaPayoutReadinessBlocker[]
}

interface FounderAreaLegacyRoyaltyDashboard {
  enabled: false
  payoutEnabled: false
  replacementWorkflowEnabled: false
  manualReviewRequired: true
  appliesTo: 'inherited_founder_created_businesses_only'
  royaltyRate: number
  treasuryAccountId: typeof FOUNDER_LEGACY_TREASURY_ACCOUNT_ID
  royaltyEligibleBusinessIds: string[]
  royaltyExcludedBusinessIds: string[]
  blockers: readonly FounderAreaLegacyRoyaltyBlocker[]
}

interface FounderAreaHandoffTransferPackage {
  founderNumber: number
  founderCitizenId: string
  areaId: string
  businessCount: number
  founderCreatedBusinessCount: number
  inheritedBusinessCount: number
  outstandingDebt: number
  debtObligationCount: number
  protectedByInsurance: boolean
  legacyRoyaltyRate: number
  legacyTreasuryAccountId: typeof FOUNDER_LEGACY_TREASURY_ACCOUNT_ID
}

interface FounderAreaHandoffDashboard {
  enabled: false
  mode: 'manual_disabled'
  candidateSelectionEnabled: false
  replacementWorkflowEnabled: false
  waitlistHandoffEnabled: false
  seatTransferEnabled: false
  areaTransferEnabled: false
  businessTransferEnabled: false
  debtTransferEnabled: false
  legacyRulesTransferEnabled: false
  manualReviewRequired: true
  successorCandidateSource: 'none' | 'named_heir'
  successorCandidateCitizenId: string | null
  successorCandidateName: string | null
  transferPackage: FounderAreaHandoffTransferPackage
  blockers: readonly FounderAreaHandoffBlocker[]
}

interface FounderAreaLandLeaseTemplate {
  enabled: false
  termDays: typeof LAND_LEASE_TEMPLATE_TERM_DAYS
  fixedMonthlyRent: null
  rentCurrency: 'game_credits'
  payerCitizenId: null
  receiverCitizenId: string
  platformFeeRate: typeof LAND_LEASE_PLATFORM_FEE_RATE
  platformFeeReceiverId: typeof PLATFORM_FEE_ACCOUNT_ID
  requiresOperator: true
  requiresDemand: true
}

interface FounderAreaLandRightsDashboard {
  enabled: false
  mode: 'disabled_until_survival_business_loop_review'
  publicWording: 'reservation_building_rights'
  landSalesEnabled: false
  reservationsEnabled: false
  purchasesEnabled: false
  leasesEnabled: false
  rentCollectionEnabled: false
  platformFeeEnabled: false
  areaId: string
  areaLabel: string
  ownerCitizenId: string
  radiusKm: number
  businessCount: number
  operatorCount: 0
  leaseTemplate: FounderAreaLandLeaseTemplate
  blockers: readonly FounderAreaLandRightsBlocker[]
}

interface FounderAreaGrowthDashboard {
  channel: 'telegram'
  inviteLinkEnabled: false
  inviteTrackingEnabled: false
  automaticRewardsEnabled: false
  manualEvidenceRequired: true
  realPopulation: number
  simPopulation: number
  trackedInvites: 0
  blockers: readonly FounderAreaGrowthBlocker[]
}

interface FounderAreaDashboard {
  areaId: string
  updatedAt: string
  founderIdentity: FounderAreaIdentityDashboard
  population: number
  simPopulation: number
  realPopulation: number
  demand: Record<FounderAreaBusinessKind, number>
  simDemand: Record<FounderAreaBusinessKind, number>
  realDemand: Record<FounderAreaBusinessKind, number>
  supply: Record<FounderAreaBusinessKind, number>
  capacity: Record<FounderAreaBusinessKind, number>
  shortage: Record<FounderAreaBusinessKind, number>
  jobs: FounderAreaJobsDashboard
  licenseSlots: Record<FounderAreaBusinessKind, number>
  saturation: Record<FounderAreaBusinessKind, number>
  licenses: Record<FounderAreaBusinessKind, FounderAreaLicenseDashboard>
  firstBuild: FounderAreaFirstBuildRecommendation[]
  existingBusinesses: FounderAreaBusinessDashboard[]
  citizens: FounderAreaCitizenDashboard[]
  survival: FounderAreaSurvivalDashboard
  ledger: FounderAreaLedgerDashboard
  areaEvents: FounderAreaEventsDashboard
  growth: FounderAreaGrowthDashboard
  settlement: FounderAreaSettlementDashboard
  payoutReadiness: FounderAreaPayoutReadinessDashboard
  legacyRoyalty: FounderAreaLegacyRoyaltyDashboard
  handoff: FounderAreaHandoffDashboard
  landRights: FounderAreaLandRightsDashboard
  founderCovenant: FounderAreaCovenantReview
}

interface FounderAreaIdentityDashboard {
  citizenId: string
  founderNumber: number
  claimSource: AreaClaimSource
  telegramUserId: string | null
  telegramAccountId: string | null
}

interface FounderAreaState {
  version: typeof AREA_STATE_VERSION
  areaId: string
  founderCitizenId: string
  founderNumber: number
  balance: number
  claim: FounderAreaClaim
  businesses: FounderAreaBusiness[]
  citizens: FounderAreaCitizen[]
  transactions: FounderAreaTransaction[]
  areaEvents?: FounderAreaEvent[]
  founderReviewHistory?: FounderAreaCovenantReviewHistoryItem[]
  founderCovenant: FounderAreaCovenantReview
  updatedAt: string
}

type FounderAreaStateInput = Omit<FounderAreaState, 'founderCovenant'> & {
  founderCovenant?: FounderAreaCovenantReview
}

type ClaimAreaIntent =
  | {
    ok: true
    label: string
    centerLat: number
    centerLng: number
    radiusKm: number
    source: AreaClaimSource
  }
  | { ok: false; error: ClaimAreaIntentError }

type ClaimAreaIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_area_label'
  | 'invalid_location'
  | 'area_too_small'
  | 'area_too_large'
  | 'invalid_claim_source'

type BuildBusinessIntent =
  | {
    ok: true
    businessKind: FounderAreaBusinessKind
    businessId: string
    name: string
  }
  | { ok: false; error: BuildBusinessIntentError }

type BuildBusinessIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_kind'
  | 'invalid_business_id'
  | 'invalid_business_name'

type ApplyBuildBusinessError =
  | BuildBusinessIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'business_id_taken'
  | 'business_saturated'
  | 'insufficient_funds'

type ServicePurchaseIntent =
  | {
    ok: true
    type: ServicePurchaseIntentType
    serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>
  }
  | { ok: false; error: ServicePurchaseIntentError }

type ServicePurchaseIntentType = 'buyWater' | 'buyFood' | 'buyHousing' | 'visitClinic'
type ServicePurchaseIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyServicePurchaseError =
  | ServicePurchaseIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'service_not_available'
  | 'insufficient_funds'

type BuyInsuranceIntent =
  | {
    ok: true
    insuranceBusinessId: string
  }
  | { ok: false; error: BuyInsuranceIntentError }

type BuyInsuranceIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_id'

type ApplyBuyInsuranceError =
  | BuyInsuranceIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'business_not_found'
  | 'not_insurance_business'
  | 'already_insured'
  | 'insufficient_funds'

type HireWorkerIntent =
  | {
    ok: true
    businessId: string
    workerCitizenId: string
  }
  | { ok: false; error: HireWorkerIntentError }

type HireWorkerIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_business_id'
  | 'invalid_worker_id'

type ApplyHireWorkerError =
  | HireWorkerIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'business_not_found'
  | 'business_fully_staffed'
  | 'worker_already_hired'
  | 'worker_not_found'
  | 'worker_unavailable'
  | 'real_worker_requires_acceptance'

type AdvanceHourIntent =
  | { ok: true }
  | { ok: false; error: AdvanceHourIntentError }

type AdvanceHourIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyAdvanceHourError =
  | AdvanceHourIntentError
  | 'area_not_claimed'
  | 'clock_not_ready'
  | 'server_clock_unauthorized'

type RefreshAreaIntent =
  | { ok: true }
  | { ok: false; error: RefreshAreaIntentError }

type RefreshAreaIntentError = 'unsupported_intent' | 'client_controlled_server_field'

type ApplyRefreshAreaError =
  | RefreshAreaIntentError
  | 'area_not_claimed'

type ServerClockTickAreasIntent =
  | { ok: true; limit: number; pages: number; cursor?: string }
  | { ok: false; error: ServerClockTickAreasIntentError }

type ServerClockTickAreasIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_limit'
  | 'invalid_pages'
  | 'invalid_cursor'

type ServerClockTickAreasError =
  | ServerClockTickAreasIntentError
  | 'server_clock_unauthorized'

type ServerClockAreaTickStatus = 'caught_up' | 'current' | 'invalid' | 'unavailable'

interface ServerClockAreaTickResult {
  citizenId: string | null
  areaId: string | null
  status: ServerClockAreaTickStatus
  updatedAt: string | null
  transactionsAdded: number
}

interface ServerClockTickAreasSummary {
  checkedAt: string
  limit: number
  pages: number
  pagesScanned: number
  cursor: string | null
  nextCursor: string | null
  scanned: number
  caughtUp: number
  current: number
  failed: number
  hasMore: boolean
  results: ServerClockAreaTickResult[]
}

type FounderCovenantReviewQueueIntent =
  | { ok: true; limit: number; pages: number; cursor?: string }
  | { ok: false; error: FounderCovenantReviewQueueIntentError }

type FounderCovenantReviewQueueIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_limit'
  | 'invalid_pages'
  | 'invalid_cursor'

type FounderCovenantReviewQueueError =
  | FounderCovenantReviewQueueIntentError
  | 'server_clock_unauthorized'

interface FounderCovenantReviewQueueSignalCounts {
  total: number
  info: number
  warning: number
  critical: number
}

interface FounderCovenantReviewQueueEconomicExposure {
  founderCash: number
  outstandingDebt: number
  debtCount: number
  businessCash: number
  businessCount: number
  unstaffedBusinessCount: number
  insured: boolean
  hospitalized: boolean
  gameCreditsOnly: true
  payoutEligibleCredits: 0
  manualPayoutReviewRequired: true
}

interface FounderCovenantReviewQueueLatestReview {
  reviewedAt: string
  reviewerId: string
  actionKind: 'record_review'
  summary: string
  evidenceOnly: true
  automationEnabled: false
}

type FounderCovenantReviewReadinessStatus =
  | 'blocked'
  | 'needs_evidence'
  | 'overdue'
  | 'ready'
  | 'monitoring'

interface FounderCovenantReviewReadiness {
  status: FounderCovenantReviewReadinessStatus
  label: string
  summary: string
  evidenceRequiredCount: number
  approvalRequestCount: number
  blockerCount: number
  overdue: boolean
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

interface FounderCovenantReviewQueueItem {
  areaId: string
  areaLabel: string
  founderCitizenId: string
  founderNumber: number
  updatedAt: string
  checkedAt: string
  lastReviewAt: string | null
  latestReview: FounderCovenantReviewQueueLatestReview | null
  nextWeeklyReviewAt: string
  nextMonthlyReviewAt: string
  overdue: boolean
  covenantStatus: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: FounderAreaCovenantActivityReview
  reviewInputs: readonly FounderAreaCovenantReviewInput[]
  stages: readonly FounderAreaCovenantStage[]
  reviewReadiness: FounderCovenantReviewReadiness
  reviewChecklist: readonly FounderAreaCovenantReviewChecklistItem[]
  manualActions: readonly FounderAreaCovenantManualAction[]
  economicExposure: FounderCovenantReviewQueueEconomicExposure
  reviewQueue: FounderAreaCovenantReviewQueue
  signalCounts: FounderCovenantReviewQueueSignalCounts
  signalKinds: FounderAreaCovenantSignalKind[]
  recommendedActionKinds: readonly FounderAreaCovenantManualActionKind[]
  pendingApprovalRequests: readonly FounderAreaCovenantApprovalRequest[]
  pendingApprovalKinds: readonly FounderAreaCovenantApprovalRequestKind[]
  pendingNotificationDrafts: readonly FounderAreaCovenantNotificationDraft[]
  pendingNotificationKinds: readonly FounderAreaCovenantNotificationDraftKind[]
  blockerCount: number
  scanStatus: ServerClockAreaTickStatus
  transactionsAdded: number
}

interface FounderCovenantReviewQueueScanResult {
  citizenId: string | null
  areaId: string | null
  status: ServerClockAreaTickStatus
  updatedAt: string | null
  transactionsAdded: number
}

interface FounderCovenantReviewQueueDashboard {
  generatedAt: string
  evidenceOnly: true
  automationEnabled: false
  executionEnabled: false
  replacementEnabled: false
  waitlistHandoffEnabled: false
  approvalWorkflowEnabled: false
  limit: number
  pages: number
  pagesScanned: number
  cursor: string | null
  nextCursor: string | null
  scanned: number
  caughtUp: number
  current: number
  failed: number
  hasMore: boolean
  totals: {
    founders: number
    active: number
    useful: number
    building: number
    staffed: number
    indebted: number
    hospitalized: number
    atRisk: number
    manualReviewRequired: number
    overdue: number
    totalFounderCash: number
    totalOutstandingDebt: number
    totalBusinessCash: number
    unstaffedBusinesses: number
    insuredFounders: number
    pendingApprovals: number
    pendingNotifications: number
    blockers: number
  }
  items: FounderCovenantReviewQueueItem[]
  results: FounderCovenantReviewQueueScanResult[]
}

type RepayDebtIntent =
  | {
    ok: true
    debtId: string
    amount: number
  }
  | { ok: false; error: RepayDebtIntentError }

type RepayDebtIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_debt_id'
  | 'invalid_debt_payment'

type ApplyRepayDebtError =
  | RepayDebtIntentError
  | 'area_not_claimed'
  | 'actor_unavailable'
  | 'debt_not_found'
  | 'insufficient_funds'

type RecordCovenantReviewIntent =
  | {
    ok: true
    actionKind: FounderAreaCovenantManualActionKind
    note?: string
    evidenceKinds: FounderAreaCovenantManualEvidenceKind[]
  }
  | { ok: false; error: RecordCovenantReviewIntentError }

type RecordCovenantReviewIntentError =
  | 'unsupported_intent'
  | 'client_controlled_server_field'
  | 'invalid_review_action'
  | 'invalid_review_note'
  | 'invalid_review_evidence'

type ApplyRecordCovenantReviewError =
  | RecordCovenantReviewIntentError
  | 'area_not_claimed'
  | 'review_action_disabled'

type OperatorRecordCovenantReviewIntent =
  | {
    ok: true
    founderCitizenId: string
    areaId: string
    actionKind: FounderAreaCovenantManualActionKind
    note?: string
    evidenceKinds: FounderAreaCovenantManualEvidenceKind[]
  }
  | { ok: false; error: OperatorRecordCovenantReviewIntentError }

type OperatorRecordCovenantReviewIntentError =
  | RecordCovenantReviewIntentError
  | 'client_controlled_server_field'
  | 'invalid_founder_identity'
  | 'invalid_area_identity'

type ApplyOperatorRecordCovenantReviewError =
  | ApplyRecordCovenantReviewError
  | OperatorRecordCovenantReviewIntentError
  | 'operator_unauthorized'
  | 'area_mismatch'

const SERVICE_PURCHASE_INTENTS: Record<ServicePurchaseIntentType, Exclude<FounderAreaBusinessKind, 'insurance'>> = {
  buyWater: 'water',
  buyFood: 'food',
  buyHousing: 'housing',
  visitClinic: 'clinic',
}

const SERVER_OWNED_IDENTITY_FIELDS = [
  'telegramUserId',
  'telegramAccountId',
  'telegramUsername',
  'telegramName',
  'telegramLinkedAt',
] as const

const SERVER_OWNED_SETTLEMENT_FIELDS = [
  'settlement',
  'tonWalletAddress',
  'tonConnectProof',
  'payoutEligibleCredits',
  'payoutReadiness',
  'realWithdrawalsEnabled',
  'manualPayoutApprovalEnabled',
  'kycRequired',
  'kycStatus',
  'taxProfileRequired',
  'taxProfileStatus',
  'noProfitPromise',
  'stablecoinRailPlanned',
  'payoutEligibility',
  'walletConnectionEnabled',
  'depositsEnabled',
  'withdrawalsEnabled',
  'landReservationsEnabled',
  'landLeasesEnabled',
  'highFrequencyOnChainTransactions',
] as const

const SERVER_OWNED_LEGACY_ROYALTY_FIELDS = [
  'legacyRoyalty',
  'legacyRoyaltyRate',
  'legacyTreasuryAccountId',
  'royaltyEligibleBusinessIds',
  'royaltyExcludedBusinessIds',
  'legacyRoyaltyPayoutEnabled',
] as const

const SERVER_OWNED_HANDOFF_FIELDS = [
  'handoff',
  'transferPackage',
  'successorCandidateSource',
  'successorCandidateCitizenId',
  'successorCandidateName',
  'candidateSelectionEnabled',
  'replacementWorkflowEnabled',
  'waitlistHandoffEnabled',
  'seatTransferEnabled',
  'areaTransferEnabled',
  'businessTransferEnabled',
  'debtTransferEnabled',
  'legacyRulesTransferEnabled',
  'waitlistCandidateId',
  'replacementCandidateId',
  'successorCitizenId',
] as const

const SERVER_OWNED_LAND_RIGHTS_FIELDS = [
  'landRights',
  'leaseTemplate',
  'landSalesEnabled',
  'reservationsEnabled',
  'purchasesEnabled',
  'leasesEnabled',
  'rentCollectionEnabled',
  'platformFeeEnabled',
  'fixedMonthlyRent',
  'rentCurrency',
  'payerCitizenId',
  'receiverCitizenId',
  'platformFeeRate',
  'platformFeeReceiverId',
  'operatorCitizenId',
  'leaseContractId',
] as const

const FORBIDDEN_CLAIM_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
])

const FORBIDDEN_HIRE_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'heirCitizenId',
  'staffCitizenIds',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_ADVANCE_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'heirCitizenId',
  'staffCitizenIds',
  'businessId',
  'workerCitizenId',
  'hour',
  'hours',
  'businesses',
  'transactions',
  'citizens',
  'summary',
])

const FORBIDDEN_REFRESH_FIELDS = new Set([
  ...FORBIDDEN_ADVANCE_FIELDS,
])

const FORBIDDEN_REPAY_DEBT_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'price',
  'wagePerHour',
  'heirCitizenId',
  'creditorId',
  'debt',
  'debts',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_REVIEW_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'heirCitizenId',
  'reviewerId',
  'authorityGate',
  'reviewedAt',
  'evidenceOnly',
  'approvedById',
  'approvedAt',
  'founderCitizenId',
  'decision',
  'status',
  'nextAction',
  'manualReviewRequired',
  'activityReview',
  'reviewQueue',
  'reviewInputs',
  'stages',
  'stage',
  'requiresMainFounderApproval',
  'manualOnly',
  'reviewChecklist',
  'manualActions',
  'approvalRequests',
  'approvalEnabled',
  'executionEnabled',
  'notificationDraftId',
  'blockers',
  'clientPayload',
  'reviewSchedule',
  'checkedAt',
  'score',
  'replacementEnabled',
  'waitlistHandoffEnabled',
  'automationEnabled',
  'signals',
  'summary',
  'businesses',
  'transactions',
  'citizens',
])
const OPERATOR_REVIEW_ALLOWED_FIELDS = ['type', 'founderCitizenId', 'areaId', 'actionKind', 'note', 'evidenceKinds']
const FORBIDDEN_OPERATOR_REVIEW_FIELDS = new Set(
  [...FORBIDDEN_REVIEW_FIELDS].filter((key) => key !== 'areaId' && key !== 'founderCitizenId'),
)

const FORBIDDEN_SERVICE_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'businessId',
  'businessKind',
  'serviceKind',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'heirCitizenId',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_INSURANCE_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'businessId',
  'businessKind',
  'serviceKind',
  'ownerId',
  'now',
  'balance',
  'money',
  'cash',
  'amount',
  'price',
  'wagePerHour',
  'insurancePaidUntil',
  'heirCitizenId',
  'businesses',
  'transactions',
  'citizens',
])

const FORBIDDEN_BUILD_FIELDS = new Set([
  ...SERVER_OWNED_IDENTITY_FIELDS,
  ...SERVER_OWNED_SETTLEMENT_FIELDS,
  ...SERVER_OWNED_LEGACY_ROYALTY_FIELDS,
  ...SERVER_OWNED_HANDOFF_FIELDS,
  ...SERVER_OWNED_LAND_RIGHTS_FIELDS,
  'actorCitizenId',
  'authenticatedCitizenId',
  'authenticatedFounderId',
  'areaId',
  'ownerId',
  'createdBy',
  'now',
  'balance',
  'money',
  'cash',
  'buildCost',
  'price',
  'wagePerHour',
  'quality',
  'heirCitizenId',
  'blueprint',
  'businesses',
  'transactions',
  'citizens',
])

const BUSINESS_BLUEPRINTS: Record<FounderAreaBusinessKind, {
  name: string
  buildCost: number
  price: number
  wagePerHour: number
}> = {
  water: { name: 'Water Point', buildCost: 8_000, price: 2, wagePerHour: 14 },
  food: { name: 'Food Shop', buildCost: 12_000, price: 14, wagePerHour: 15 },
  housing: { name: 'Basic Housing', buildCost: 25_000, price: 28, wagePerHour: 16 },
  clinic: { name: 'Clinic', buildCost: 75_000, price: 90, wagePerHour: 24 },
  insurance: { name: 'Insurance Office', buildCost: 60_000, price: 45, wagePerHour: 20 },
}

const MIN_LICENSE_SLOTS: Record<FounderAreaBusinessKind, number> = {
  water: 1,
  food: 1,
  housing: 1,
  clinic: 0,
  insurance: 0,
}

const LICENSE_POPULATION_STEP: Record<FounderAreaBusinessKind, number> = {
  water: 35,
  food: 30,
  housing: 22,
  clinic: 80,
  insurance: 90,
}

const TARGET_STAFF_BY_KIND: Record<FounderAreaBusinessKind, number> = {
  water: 1,
  food: 2,
  housing: 1,
  clinic: 3,
  insurance: 1,
}
const FOUNDER_COVENANT_MANUAL_EVIDENCE_KINDS: readonly FounderAreaCovenantManualEvidenceKind[] = [
  'population_growth',
  'external_contribution',
  'ideas_feedback',
]

const FULL_NEEDS: FounderAreaNeeds = {
  hunger: 90,
  hydration: 90,
  energy: 90,
  hygiene: 90,
  fun: 90,
}

const NEED_DECAY_PER_HOUR: FounderAreaNeeds = {
  hunger: 4,
  hydration: 5,
  energy: 3,
  hygiene: 1,
  fun: 1,
}

const NEED_PURCHASE_THRESHOLD = 65
const HEALTH_PURCHASE_THRESHOLD = 75
const COLLAPSE_HEALTH = 20
const HOSPITAL_BILL = 350
const HOSPITALIZATION_HOURS = 8
const INSURED_HOSPITALIZATION_HOURS = 5
const RECOVERY_HEALTH = 55
const MIN_BUSINESS_QUALITY = 0.35
const UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR = 0.04
const SIM_LEAVES_HEALTH = 35
const SIM_LEAVES_NEED_LEVEL = 5
const SURVIVAL_WARNING_HYDRATION = 50
const SURVIVAL_WARNING_HUNGER = 50
const SURVIVAL_WARNING_ENERGY = 35
const SURVIVAL_WARNING_HEALTH = 65
const SURVIVAL_DANGER_NEED_LEVEL = 10
const SURVIVAL_DANGER_HEALTH = COLLAPSE_HEALTH + 10
const SERVICE_EFFECTS: Record<Exclude<FounderAreaBusinessKind, 'insurance'>, Partial<FounderAreaNeeds> & { health?: number }> = {
  water: { hydration: 35 },
  food: { hunger: 35 },
  housing: { energy: 35 },
  clinic: { health: 30 },
}
const BASE_SERVICE_CAPACITY_PER_HOUR: Record<FounderAreaBusinessKind, number> = {
  water: 24,
  food: 14,
  housing: 8,
  clinic: 6,
  insurance: 8,
}
const STAFF_CAPACITY_MULTIPLIER = 0.75
const SERVER_AREA_TICK_MS = 3_600_000
const MAX_SERVER_AREA_CATCH_UP_HOURS = 24

export function areaStatePath(citizenId: string): string {
  return `reality-areas/${citizenId}.json`
}

export function normalizeClaimAreaIntent(input: unknown): ClaimAreaIntent {
  if (!isRecord(input) || input.type !== 'claimArea') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_CLAIM_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const label = text(input.label).slice(0, 80)
  if (!label) return { ok: false, error: 'invalid_area_label' }

  const centerLat = Number(input.centerLat)
  const centerLng = Number(input.centerLng)
  if (
    !Number.isFinite(centerLat) ||
    !Number.isFinite(centerLng) ||
    centerLat < -90 ||
    centerLat > 90 ||
    centerLng < -180 ||
    centerLng > 180
  ) {
    return { ok: false, error: 'invalid_location' }
  }

  const radiusKm = Number(input.radiusKm)
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_FOUNDER_AREA_RADIUS_KM) {
    return { ok: false, error: 'area_too_small' }
  }
  if (radiusKm > MAX_FOUNDER_AREA_RADIUS_KM) return { ok: false, error: 'area_too_large' }

  const source = text(input.source)
  if (!isClaimSource(source)) return { ok: false, error: 'invalid_claim_source' }

  return { ok: true, label, centerLat, centerLng, radiusKm, source }
}

export function normalizeBuildBusinessIntent(input: unknown): BuildBusinessIntent {
  if (!isRecord(input) || input.type !== 'buildBusiness') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_BUILD_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const businessKind = text(input.businessKind)
  if (!isBusinessKind(businessKind)) return { ok: false, error: 'invalid_business_kind' }

  const businessId = text(input.businessId)
  if (!/^[A-Za-z0-9:_-]{1,96}$/.test(businessId)) return { ok: false, error: 'invalid_business_id' }

  const name = text(input.name) || BUSINESS_BLUEPRINTS[businessKind].name
  if (!name || name.length > 80 || hasControlCharacter(name)) return { ok: false, error: 'invalid_business_name' }

  return { ok: true, businessKind, businessId, name }
}

export function normalizeServicePurchaseIntent(input: unknown): ServicePurchaseIntent {
  if (!isRecord(input) || !isServicePurchaseIntentType(input.type)) {
    return { ok: false, error: 'unsupported_intent' }
  }
  if (Object.keys(input).some((key) => FORBIDDEN_SERVICE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }
  return { ok: true, type: input.type, serviceKind: SERVICE_PURCHASE_INTENTS[input.type] }
}

export function normalizeBuyInsuranceIntent(input: unknown): BuyInsuranceIntent {
  if (!isRecord(input) || input.type !== 'buyInsurance') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_INSURANCE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const insuranceBusinessId = text(input.insuranceBusinessId)
  if (!isClientId(insuranceBusinessId)) return { ok: false, error: 'invalid_business_id' }

  return { ok: true, insuranceBusinessId }
}

export function normalizeHireWorkerIntent(input: unknown): HireWorkerIntent {
  if (!isRecord(input) || input.type !== 'hireWorker') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_HIRE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const businessId = text(input.businessId)
  if (!isClientId(businessId)) return { ok: false, error: 'invalid_business_id' }

  const workerCitizenId = text(input.workerCitizenId)
  if (!isClientId(workerCitizenId)) return { ok: false, error: 'invalid_worker_id' }

  return { ok: true, businessId, workerCitizenId }
}

export function normalizeAdvanceHourIntent(input: unknown): AdvanceHourIntent {
  if (!isRecord(input) || input.type !== 'advanceHour') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_ADVANCE_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }
  return { ok: true }
}

export function normalizeRefreshAreaIntent(input: unknown): RefreshAreaIntent {
  if (!isRecord(input) || input.type !== 'refreshArea') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => key !== 'type' || FORBIDDEN_REFRESH_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }
  return { ok: true }
}

export function normalizeServerClockTickAreasIntent(input: unknown): ServerClockTickAreasIntent {
  if (!isRecord(input) || input.type !== 'tickAreas') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => key !== 'type' && key !== 'limit' && key !== 'pages' && key !== 'cursor')) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const limit = input.limit === undefined ? SERVER_CLOCK_DEFAULT_AREA_LIMIT : Number(input.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > SERVER_CLOCK_MAX_AREA_LIMIT) {
    return { ok: false, error: 'invalid_limit' }
  }

  const pages = input.pages === undefined ? SERVER_CLOCK_DEFAULT_AREA_PAGES : Number(input.pages)
  if (!Number.isInteger(pages) || pages < 1 || pages > SERVER_CLOCK_MAX_AREA_PAGES) {
    return { ok: false, error: 'invalid_pages' }
  }

  const cursor = input.cursor === undefined ? undefined : text(input.cursor)
  if (input.cursor !== undefined && (!cursor || cursor.length > SERVER_CLOCK_CURSOR_MAX_LENGTH || hasControlCharacter(cursor))) {
    return { ok: false, error: 'invalid_cursor' }
  }

  return cursor ? { ok: true, limit, pages, cursor } : { ok: true, limit, pages }
}

export function normalizeFounderCovenantReviewQueueIntent(input: unknown): FounderCovenantReviewQueueIntent {
  if (!isRecord(input) || input.type !== 'founderCovenantReviewQueue') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => key !== 'type' && key !== 'limit' && key !== 'pages' && key !== 'cursor')) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const limit = input.limit === undefined ? FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_AREA_LIMIT : Number(input.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > FOUNDER_COVENANT_REVIEW_QUEUE_MAX_AREA_LIMIT) {
    return { ok: false, error: 'invalid_limit' }
  }

  const pages = input.pages === undefined ? FOUNDER_COVENANT_REVIEW_QUEUE_DEFAULT_AREA_PAGES : Number(input.pages)
  if (!Number.isInteger(pages) || pages < 1 || pages > FOUNDER_COVENANT_REVIEW_QUEUE_MAX_AREA_PAGES) {
    return { ok: false, error: 'invalid_pages' }
  }

  const cursor = input.cursor === undefined ? undefined : text(input.cursor)
  if (
    input.cursor !== undefined &&
    (!cursor || cursor.length > FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH || hasControlCharacter(cursor))
  ) {
    return { ok: false, error: 'invalid_cursor' }
  }

  return cursor ? { ok: true, limit, pages, cursor } : { ok: true, limit, pages }
}

export function normalizeRepayDebtIntent(input: unknown): RepayDebtIntent {
  if (!isRecord(input) || input.type !== 'repayDebt') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_REPAY_DEBT_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const debtId = text(input.debtId)
  if (!isClientId(debtId)) return { ok: false, error: 'invalid_debt_id' }

  const amount = roundMoney(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'invalid_debt_payment' }

  return { ok: true, debtId, amount }
}

export function normalizeRecordCovenantReviewIntent(input: unknown): RecordCovenantReviewIntent {
  if (!isRecord(input) || input.type !== 'recordCovenantReview') return { ok: false, error: 'unsupported_intent' }
  if (Object.keys(input).some((key) => FORBIDDEN_REVIEW_FIELDS.has(key))) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const actionKind = text(input.actionKind)
  if (!isFounderAreaCovenantManualActionKind(actionKind)) return { ok: false, error: 'invalid_review_action' }

  const note = input.note === undefined ? undefined : text(input.note)
  if (note !== undefined && (note.length > 280 || hasControlCharacter(note))) {
    return { ok: false, error: 'invalid_review_note' }
  }

  const evidenceKinds = normalizeFounderCovenantManualEvidenceKinds(input.evidenceKinds)
  if (!evidenceKinds.ok) return evidenceKinds

  return { ok: true, actionKind, note: note || undefined, evidenceKinds: evidenceKinds.evidenceKinds }
}

export function normalizeOperatorRecordCovenantReviewIntent(input: unknown): OperatorRecordCovenantReviewIntent {
  if (!isRecord(input) || input.type !== 'recordFounderCovenantOperatorReview') {
    return { ok: false, error: 'unsupported_intent' }
  }
  if (Object.keys(input).some((key) =>
    !OPERATOR_REVIEW_ALLOWED_FIELDS.includes(key) ||
    FORBIDDEN_OPERATOR_REVIEW_FIELDS.has(key)
  )) {
    return { ok: false, error: 'client_controlled_server_field' }
  }

  const founderCitizenId = text(input.founderCitizenId)
  if (!UUID_RE.test(founderCitizenId)) return { ok: false, error: 'invalid_founder_identity' }

  const areaId = text(input.areaId)
  if (!isClientId(areaId)) return { ok: false, error: 'invalid_area_identity' }

  const actionKind = text(input.actionKind)
  if (!isFounderAreaCovenantManualActionKind(actionKind)) return { ok: false, error: 'invalid_review_action' }

  const note = input.note === undefined ? undefined : text(input.note)
  if (note !== undefined && (note.length > 280 || hasControlCharacter(note))) {
    return { ok: false, error: 'invalid_review_note' }
  }

  const evidenceKinds = normalizeFounderCovenantManualEvidenceKinds(input.evidenceKinds)
  if (!evidenceKinds.ok) return evidenceKinds

  return {
    ok: true,
    founderCitizenId,
    areaId,
    actionKind,
    note: note || undefined,
    evidenceKinds: evidenceKinds.evidenceKinds,
  }
}

function normalizeFounderCovenantManualEvidenceKinds(
  input: unknown,
): { ok: true; evidenceKinds: FounderAreaCovenantManualEvidenceKind[] } | { ok: false; error: 'invalid_review_evidence' } {
  if (input === undefined) return { ok: true, evidenceKinds: [] }
  if (!Array.isArray(input) || input.length > FOUNDER_COVENANT_MANUAL_EVIDENCE_KINDS.length) {
    return { ok: false, error: 'invalid_review_evidence' }
  }
  const evidenceKinds: FounderAreaCovenantManualEvidenceKind[] = []
  for (const item of input) {
    const kind = text(item)
    if (!isFounderAreaCovenantManualEvidenceKind(kind)) return { ok: false, error: 'invalid_review_evidence' }
    if (!evidenceKinds.includes(kind)) evidenceKinds.push(kind)
  }
  return { ok: true, evidenceKinds }
}

export async function verifyCitizen(
  citizenId: string,
  token: string,
  options: { includeRecord?: boolean } = {},
): Promise<CitizenAuthRecord | null> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return null
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  const blob = batch.blobs[0]
  const pathname = blob?.pathname
  if (!pathname) return null
  const match = pathname.match(/^citizens\/[0-9a-f-]+__[a-f0-9]{24}__(\d+)\.json$/)
  if (!match) return null
  const stored = options.includeRecord ? await readCitizenRecord(blob.downloadUrl) : {}
  return { citizenId, founderNumber: Number(match[1]), ...stored }
}

async function readCitizenRecord(downloadUrl: string | undefined): Promise<Partial<CitizenAuthRecord>> {
  if (!downloadUrl) return {}
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) return {}
    const value = await response.json() as unknown
    if (!isRecord(value)) return {}
    const telegramAccountId = text(value.telegramAccountId)
    const telegramUserId = text(value.telegramUserId)
    return {
      ...(telegramAccountId.startsWith('telegram:') ? { telegramAccountId } : {}),
      ...(telegramUserId ? { telegramUserId } : {}),
      ...(text(value.telegramUsername) ? { telegramUsername: text(value.telegramUsername) } : {}),
      ...(text(value.telegramName) ? { telegramName: text(value.telegramName) } : {}),
      ...(text(value.telegramLinkedAt) ? { telegramLinkedAt: text(value.telegramLinkedAt) } : {}),
    }
  } catch {
    return {}
  }
}

async function readAreaState(citizenId: string): Promise<FounderAreaState | null> {
  const batch = await list({ prefix: areaStatePath(citizenId), limit: 1 })
  const url = batch.blobs[0]?.downloadUrl
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) return null
  const value = await response.json() as unknown
  return isFounderAreaState(value, citizenId) ? normalizeAreaCitizens(value) : null
}

function buildFounderAreaState(citizen: CitizenAuthRecord, intent: Extract<ClaimAreaIntent, { ok: true }>, now: Date): FounderAreaState {
  const at = now.toISOString()
  const paddedFounder = String(citizen.founderNumber).padStart(4, '0')
  const areaId = `founder-area-${paddedFounder}`
  const founderCitizen = founderCitizenRecord(citizen, FOUNDER_STARTER_CREDIT)
  const simCitizens = defaultSimCitizens(areaId)
  const transaction: FounderAreaTransaction = {
    id: `${areaId}:${now.getTime()}:founder-credit`,
    at,
    kind: 'founder_credit',
    payoutEligibility: 'game_only',
    fromId: PLATFORM_BANK_ID,
    toId: citizen.citizenId,
    amount: FOUNDER_STARTER_CREDIT,
    memo: `Founder #${paddedFounder} starter operating credit.`,
  }
  const simTransactions = simCitizens.map((simCitizen, index) =>
    simCitizenCreditTransaction(areaId, at, now.getTime(), index + 1, simCitizen)
  )

  return withFounderCovenantReview({
    version: AREA_STATE_VERSION,
    areaId,
    founderCitizenId: citizen.citizenId,
    founderNumber: citizen.founderNumber,
    balance: FOUNDER_STARTER_CREDIT,
    claim: {
      founderCitizenId: citizen.citizenId,
      founderNumber: citizen.founderNumber,
      label: intent.label,
      centerLat: intent.centerLat,
      centerLng: intent.centerLng,
      radiusKm: intent.radiusKm,
      claimedAt: at,
      source: intent.source,
      telegramUserId: citizen.telegramUserId,
      telegramAccountId: citizen.telegramAccountId,
    },
    businesses: [],
    citizens: [founderCitizen, ...simCitizens],
    transactions: [transaction, ...simTransactions],
    areaEvents: [],
    founderReviewHistory: [],
    updatedAt: at,
  })
}

function normalizeAreaCitizens(state: FounderAreaState): FounderAreaState {
  const claimedAt = state.claim.claimedAt
  const claimedMs = Date.parse(claimedAt)
  const atMs = Number.isFinite(claimedMs) ? claimedMs : 0
  const founder: CitizenAuthRecord = {
    citizenId: state.founderCitizenId,
    founderNumber: state.founderNumber,
  }
  const expectedCitizens = [
    founderCitizenRecord(founder, state.balance),
    ...defaultSimCitizens(state.areaId),
  ]
  let citizens = state.citizens.map((citizen) =>
    citizen.id === state.founderCitizenId ? { ...citizen, money: state.balance } : citizen
  )
  const transactions = state.transactions.map(normalizeFounderAreaTransaction)
  const areaEvents = normalizeFounderAreaEvents(state.areaEvents)

  for (const expected of expectedCitizens) {
    if (citizens.some((citizen) => citizen.id === expected.id)) continue
    if (expected.kind === 'sim' && hasSimDepartureEvent(areaEvents, expected.id)) continue
    citizens = [...citizens, expected]
    if (expected.kind === 'sim' && !transactions.some((transaction) =>
      transaction.kind === 'sim_citizen_credit' && transaction.toId === expected.id
    )) {
      transactions.push(simCitizenCreditTransaction(
        state.areaId,
        claimedAt,
        atMs,
        transactions.filter((transaction) => transaction.kind === 'sim_citizen_credit').length + 1,
        expected,
      ))
    }
  }

  return withFounderCovenantReview({ ...state, citizens, transactions, areaEvents })
}

function withFounderCovenantReview(state: FounderAreaStateInput): FounderAreaState {
  const normalizedState = state.founderReviewHistory === undefined
    ? state
    : { ...state, founderReviewHistory: normalizeFounderCovenantReviewHistory(state.founderReviewHistory) }
  return {
    ...normalizedState,
    founderCovenant: founderCovenantReview(normalizedState),
  }
}

function normalizeFounderAreaTransaction(transaction: FounderAreaTransaction): FounderAreaTransaction {
  return {
    ...transaction,
    payoutEligibility: 'game_only',
  }
}

function normalizeFounderAreaEvents(input: unknown): FounderAreaEvent[] {
  if (!Array.isArray(input)) return []
  return input.filter(isFounderAreaEvent).map((event) => ({
    ...event,
    needs: { ...event.needs },
  }))
}

function hasSimDepartureEvent(events: FounderAreaEvent[], citizenId: string): boolean {
  return events.some((event) =>
    event.kind === 'sim_citizen_departure' &&
    event.simulated &&
    event.citizenId === citizenId
  )
}

function unreviewedSimDepartureEvents(
  state: FounderAreaStateInput,
  lastReviewAt: string | null,
): FounderAreaEvent[] {
  const lastReviewMs = lastReviewAt === null ? null : Date.parse(lastReviewAt)
  return normalizeFounderAreaEvents(state.areaEvents).filter((event) => {
    if (event.kind !== 'sim_citizen_departure' || !event.simulated) return false
    if (lastReviewMs === null || !Number.isFinite(lastReviewMs)) return true
    const eventMs = Date.parse(event.at)
    return Number.isFinite(eventMs) && eventMs > lastReviewMs
  })
}

function uniqueBusinessKinds(kinds: readonly FounderAreaDepartureServiceKind[]): FounderAreaBusinessKind[] {
  return BUSINESS_KINDS.filter((kind) => kinds.includes(kind))
}

function founderCovenantReview(state: FounderAreaStateInput): FounderAreaCovenantReview {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const founderBusinesses = state.businesses.filter((business) => business.ownerId === state.founderCitizenId)
  const founderBusinessIds = new Set(founderBusinesses.map((business) => business.id))
  const founderActive = founder?.state.kind === 'active'
  const founderHospitalized = founder?.state.kind === 'hospitalized'
  const building = founderBusinesses.length > 0
  const founderDebt = founder ? totalCitizenDebt(founder) : 0
  const signals: FounderAreaCovenantSignal[] = []
  const reviewSchedule = founderCovenantReviewSchedule(state)
  const unreviewedSimDepartures = unreviewedSimDepartureEvents(state, reviewSchedule.lastReviewAt)
  const demand = areaServiceDemand(state.citizens)
  const capacity = areaServiceCapacity(state.citizens, state.businesses)
  const essentialShortages = (['water', 'food', 'housing'] as const)
    .filter((kind) => demand[kind] > capacity[kind])
  const understaffedBusinesses = founderBusinesses.filter((business) =>
    activeStaffCount(state.citizens, business) < TARGET_STAFF_BY_KIND[business.kind]
  )
  const staffed = building && understaffedBusinesses.length === 0
  const servedCustomers = state.transactions.some((transaction) =>
    transaction.kind === 'customer_purchase' && founderBusinessIds.has(transaction.toId)
  )
  const demandServedByFounder = founderBusinesses.some((business) =>
    demand[business.kind] > 0 && capacity[business.kind] >= demand[business.kind]
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
      amount: essentialShortages.reduce((total, kind) => total + Math.max(0, demand[kind] - capacity[kind]), 0),
    })
  }
  if (unreviewedSimDepartures.length > 0) {
    const departedServiceKinds = uniqueBusinessKinds(unreviewedSimDepartures.map((event) => event.serviceKind))
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

  if (reviewSchedule.overdue) {
    signals.push({
      kind: 'review_due',
      severity: 'warning',
      message: founderCovenantReviewDueMessage(reviewSchedule),
    })
  }

  const manualReviewRequired = signals.some((signal) => signal.severity === 'critical')
  const status: FounderAreaCovenantStatus = manualReviewRequired ? 'manual_review' : signals.length > 0 ? 'watch' : 'active'
  const activityReview: FounderAreaCovenantActivityReview = {
    checkedAt: state.updatedAt,
    active: founderActive,
    useful,
    building,
    staffed,
    indebted: founderDebt > 0,
    hospitalized: founderHospitalized,
    atRisk: status !== 'active',
    score: founder
      ? founderActivityScore({ active: founderActive, useful, building, staffed, indebted: founderDebt > 0 })
      : 0,
  }
  const nextAction: FounderAreaCovenantNextAction = manualReviewRequired
    ? 'manual_review'
    : reviewSchedule.overdue
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
  const notificationDrafts = founderCovenantNotificationDrafts(state, {
    nextAction,
  })
  const approvalRequests = founderCovenantApprovalRequests(state, {
    manualActions,
    notificationDrafts,
  })
  const reviewQueue = founderCovenantReviewQueue({
    manualActions,
    approvalRequests,
    notificationDrafts,
  })
  const reviewInputs = founderCovenantReviewInputs({
    activityReview,
    signals,
    reviewSchedule,
    realPopulation: state.citizens.filter((citizen) => citizen.kind === 'real').length,
    simPopulation: state.citizens.filter((citizen) => citizen.kind === 'sim').length,
  })
  const stages = founderCovenantStages({
    status,
    nextAction,
    manualActions,
  })

  return {
    founderCitizenId: state.founderCitizenId,
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
    latestReview: founderCovenantLatestReview(state),
    reviewHistory: founderCovenantReviewHistory(state),
    notificationDrafts,
    signals,
  }
}

function founderCovenantReviewInputs(input: {
  activityReview: FounderAreaCovenantActivityReview
  signals: FounderAreaCovenantSignal[]
  reviewSchedule: FounderAreaCovenantReviewSchedule
  realPopulation: number
  simPopulation: number
}): FounderAreaCovenantReviewInput[] {
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
      status: input.reviewSchedule.overdue ? 'watch' : 'captured',
      evidence: input.reviewSchedule.overdue
        ? 'Weekly/monthly review cadence is due or overdue.'
        : 'Weekly/monthly review cadence is being tracked.',
      manualEvidenceRequired: false,
    },
  ]
}

function founderCovenantStages(input: {
  status: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  manualActions: FounderAreaCovenantManualAction[]
}): FounderAreaCovenantStage[] {
  const warningRecommended = input.manualActions.some((action) => action.kind === 'send_warning' && action.recommended)
  const probationRecommended = input.manualActions.some((action) => action.kind === 'start_probation' && action.recommended)
  const replacementRecommended = input.manualActions.some((action) =>
    action.kind === 'recommend_replacement' && action.recommended
  )
  return [
    founderCovenantStage({
      kind: 'active',
      label: 'Active',
      status: input.status === 'active' ? 'current' : 'locked',
      reason: input.status === 'active'
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
  kind: FounderAreaCovenantStageKind
  label: string
  status: FounderAreaCovenantStageStatus
  reason: string
  requiresMainFounderApproval: boolean
}): FounderAreaCovenantStage {
  return {
    ...input,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewChecklist(input: {
  activityReview: FounderAreaCovenantActivityReview
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
}): FounderAreaCovenantReviewChecklistItem[] {
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
  status: FounderAreaCovenantStatus
  nextAction: FounderAreaCovenantNextAction
  activityReview: FounderAreaCovenantActivityReview
}): FounderAreaCovenantManualAction[] {
  const review = input.activityReview
  const warningRecommended = input.nextAction === 'warn_founder'
  const probationRecommended = input.status === 'manual_review' || review.score < 60
  const replacementRecommended = input.status === 'manual_review' && !review.active
  return [
    {
      kind: 'record_review',
      label: 'Record review',
      recommended: true,
      requiresApproval: true,
      automationEnabled: false,
      authorityGate: founderCovenantManualActionAuthority('record_review', true),
      reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
      clientPayload: {
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
  kind: FounderAreaCovenantManualActionKind,
  executionEnabled: boolean,
): FounderAreaCovenantAuthorityGate {
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
  state: FounderAreaStateInput,
  input: {
    manualActions: FounderAreaCovenantManualAction[]
    notificationDrafts: FounderAreaCovenantNotificationDraft[]
  },
): FounderAreaCovenantApprovalRequest[] {
  return input.manualActions
    .filter(isRecommendedFounderCovenantApprovalAction)
    .map((action) => ({
      id: `${state.areaId}:${Date.parse(state.updatedAt)}:covenant-approval:${action.kind}:${state.founderCitizenId}`,
      at: state.updatedAt,
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
  action: FounderAreaCovenantManualAction,
): action is FounderAreaCovenantManualAction & { kind: FounderAreaCovenantApprovalRequestKind; recommended: true } {
  return action.kind !== 'record_review' && action.recommended
}

function founderCovenantApprovalNotificationDraftId(
  action: FounderAreaCovenantManualAction & { kind: FounderAreaCovenantApprovalRequestKind },
  drafts: FounderAreaCovenantNotificationDraft[],
): string | null {
  const matchingKind: FounderAreaCovenantNotificationDraftKind = action.kind === 'send_warning'
    ? 'founder_warning'
    : 'manual_review_required'
  return drafts.find((draft) => draft.kind === matchingKind)?.id ?? null
}

function founderCovenantApprovalBlockers(
  action: FounderAreaCovenantManualAction & { kind: FounderAreaCovenantApprovalRequestKind },
): FounderAreaCovenantApprovalBlocker[] {
  if (action.kind === 'send_warning') return ['approval_workflow_disabled', 'telegram_delivery_disabled']
  if (action.kind === 'start_probation') return ['approval_workflow_disabled', 'probation_execution_disabled']
  return ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled']
}

function founderCovenantReviewQueue(input: {
  manualActions: FounderAreaCovenantManualAction[]
  approvalRequests: FounderAreaCovenantApprovalRequest[]
  notificationDrafts: FounderAreaCovenantNotificationDraft[]
}): FounderAreaCovenantReviewQueue {
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

function founderCovenantReviewSummary(
  review: FounderAreaCovenantActivityReview,
  note: string | undefined,
  evidenceKinds: FounderAreaCovenantManualEvidenceKind[],
): string {
  const snapshot = `Covenant snapshot: score ${review.score}/100; active ${yesNo(review.active)}; useful ${yesNo(review.useful)}; building ${yesNo(review.building)}; staffed ${yesNo(review.staffed)}; debt ${yesNo(review.indebted)}; hospital ${yesNo(review.hospitalized)}; at risk ${yesNo(review.atRisk)}.`
  const evidence = evidenceKinds.length > 0
    ? ` Manual evidence: ${evidenceKinds.map(founderCovenantReviewInputLabel).join(', ')}.`
    : ''
  return note ? `${snapshot}${evidence} Note: ${note}` : `${snapshot}${evidence}`
}

function yesNo(value: boolean): 'yes' | 'no' {
  return value ? 'yes' : 'no'
}

function founderCovenantReviewInputLabel(kind: FounderAreaCovenantManualEvidenceKind): string {
  switch (kind) {
    case 'population_growth':
      return 'Population growth'
    case 'external_contribution':
      return 'External contribution'
    case 'ideas_feedback':
      return 'Ideas and feedback'
  }
}

function founderCovenantReviewHistory(state: FounderAreaStateInput): FounderAreaCovenantReviewHistoryItem[] {
  return [...(state.founderReviewHistory ?? [])]
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 5)
    .map(founderCovenantReviewHistoryItem)
}

function founderCovenantLatestReview(state: FounderAreaStateInput): FounderAreaCovenantLatestReview | null {
  const latest = founderCovenantReviewHistory(state)[0]
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

function normalizeFounderCovenantReviewHistory(
  history: FounderAreaStateInput['founderReviewHistory'],
): FounderAreaCovenantReviewHistoryItem[] {
  return [...(history ?? [])].map(founderCovenantReviewHistoryItem)
}

function founderCovenantReviewHistoryItem(
  entry: FounderAreaCovenantReviewHistoryItem,
): FounderAreaCovenantReviewHistoryItem {
  const legacyEntry = entry as Partial<FounderAreaCovenantReviewHistoryItem>
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
    signals: Array.isArray(entry.signals)
      ? entry.signals.map(founderCovenantSignalSnapshot)
      : [],
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

function founderCovenantReviewEvidenceAuthority(): FounderAreaCovenantAuthorityGate {
  return {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  }
}

function founderCovenantSignalSnapshot(signal: FounderAreaCovenantSignal): FounderAreaCovenantSignal {
  return {
    ...signal,
    ...(signal.businessIds ? { businessIds: [...signal.businessIds] } : {}),
    ...(signal.businessKinds ? { businessKinds: [...signal.businessKinds] } : {}),
  }
}

function founderCovenantReviewChecklistSnapshot(
  item: FounderAreaCovenantReviewChecklistItem,
): FounderAreaCovenantReviewChecklistItem {
  return { ...item }
}

function founderCovenantReviewInputSnapshot(input: FounderAreaCovenantReviewInput): FounderAreaCovenantReviewInput {
  return { ...input }
}

function founderCovenantReviewInputsWithManualEvidence(
  inputs: FounderAreaCovenantReviewInput[],
  evidenceKinds: FounderAreaCovenantManualEvidenceKind[],
): FounderAreaCovenantReviewInput[] {
  if (evidenceKinds.length === 0) return inputs.map(founderCovenantReviewInputSnapshot)
  const evidence = new Set(evidenceKinds)
  return inputs.map((input) => {
    if (!isFounderAreaCovenantManualEvidenceKind(input.kind) || !evidence.has(input.kind)) {
      return founderCovenantReviewInputSnapshot(input)
    }
    return {
      ...input,
      status: 'captured',
      evidence: `Manual reviewer attached ${input.label.toLowerCase()} evidence in this review.`,
      manualEvidenceRequired: false,
    }
  })
}

function founderCovenantStageSnapshot(stage: FounderAreaCovenantStage): FounderAreaCovenantStage {
  return {
    ...stage,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewReadiness(
  review: FounderAreaCovenantReview,
): FounderCovenantReviewReadiness {
  const evidenceRequiredCount = review.reviewInputs.filter((input) =>
    input.manualEvidenceRequired || input.status === 'manual_needed'
  ).length
  const approvalRequestCount = review.approvalRequests.length
  const blockerCount = review.reviewQueue.blockerCount
  const overdue = review.reviewSchedule.overdue
  const status = founderCovenantReviewReadinessStatus({
    evidenceRequiredCount,
    blockerCount,
    overdue,
    manualReviewRequired: review.manualReviewRequired,
    recordReviewEnabled: review.reviewQueue.recordReviewEnabled,
  })
  return {
    status,
    label: founderCovenantReviewReadinessLabel(status),
    summary: founderCovenantReviewReadinessSummary(status, {
      evidenceRequiredCount,
      approvalRequestCount,
      blockerCount,
    }),
    evidenceRequiredCount,
    approvalRequestCount,
    blockerCount,
    overdue,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderCovenantReviewReadinessStatus(input: {
  evidenceRequiredCount: number
  blockerCount: number
  overdue: boolean
  manualReviewRequired: boolean
  recordReviewEnabled: boolean
}): FounderCovenantReviewReadinessStatus {
  if (input.blockerCount > 0) return 'blocked'
  if (input.evidenceRequiredCount > 0) return 'needs_evidence'
  if (input.overdue) return 'overdue'
  if (input.manualReviewRequired || input.recordReviewEnabled) return 'ready'
  return 'monitoring'
}

function founderCovenantReviewReadinessLabel(status: FounderCovenantReviewReadinessStatus): string {
  if (status === 'blocked') return 'Blocked'
  if (status === 'needs_evidence') return 'Needs evidence'
  if (status === 'overdue') return 'Overdue'
  if (status === 'ready') return 'Ready'
  return 'Monitoring'
}

function founderCovenantReviewReadinessSummary(
  status: FounderCovenantReviewReadinessStatus,
  counts: {
    evidenceRequiredCount: number
    approvalRequestCount: number
    blockerCount: number
  },
): string {
  if (status === 'blocked') {
    return `${counts.blockerCount} approval blocker${counts.blockerCount === 1 ? '' : 's'} before enforcement.`
  }
  if (status === 'needs_evidence') {
    return `${counts.evidenceRequiredCount} manual evidence gap${counts.evidenceRequiredCount === 1 ? '' : 's'} to review.`
  }
  if (status === 'overdue') return 'Manual review date is overdue.'
  if (status === 'ready') return 'Evidence-only review can be recorded.'
  return counts.approvalRequestCount > 0
    ? 'Manual approvals remain visible but locked.'
    : 'No manual review required yet.'
}

function founderCovenantManualActionSnapshot(action: FounderAreaCovenantManualAction): FounderAreaCovenantManualAction {
  return {
    ...action,
    authorityGate: { ...action.authorityGate, executionEnabled: false },
    clientPayload: null,
  }
}

function founderCovenantApprovalRequestSnapshot(
  request: FounderAreaCovenantApprovalRequest,
): FounderAreaCovenantApprovalRequest {
  return {
    ...request,
    approvalEnabled: false,
    automationEnabled: false,
    executionEnabled: false,
    authorityGate: { ...request.authorityGate, executionEnabled: false },
    blockers: [...request.blockers],
  }
}

function founderCovenantNotificationDraftSnapshot(
  draft: FounderAreaCovenantNotificationDraft,
): FounderAreaCovenantNotificationDraft {
  return {
    ...draft,
    sendEnabled: false,
    authorityGate: { ...draft.authorityGate, executionEnabled: false },
  }
}

function founderCovenantReviewQueueSnapshot(queue: FounderAreaCovenantReviewQueue): FounderAreaCovenantReviewQueue {
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
  manualActions: FounderAreaCovenantManualAction[]
  approvalRequests: FounderAreaCovenantApprovalRequest[]
}): FounderAreaCovenantReviewQueue {
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
  kind: FounderAreaCovenantApprovalRequestKind,
): FounderAreaCovenantNotificationDraftKind {
  return kind === 'send_warning' ? 'founder_warning' : 'manual_review_required'
}

function founderCovenantReviewSchedule(state: FounderAreaStateInput): FounderAreaCovenantReviewSchedule {
  const lastReviewMs = latestFounderReviewMs(state)
  const claimMs = safeDateMs(state.claim.claimedAt, state.updatedAt)
  const scheduleAnchor = lastReviewMs ?? claimMs
  const nextWeeklyReviewMs = scheduleAnchor + FOUNDER_COVENANT_WEEKLY_REVIEW_MS
  const nextMonthlyReviewMs = scheduleAnchor + FOUNDER_COVENANT_MONTHLY_REVIEW_MS
  const updatedMs = safeDateMs(state.updatedAt, state.claim.claimedAt)
  const weeklyReviewDue = updatedMs >= nextWeeklyReviewMs
  const monthlyReviewDue = updatedMs >= nextMonthlyReviewMs
  return {
    lastReviewAt: lastReviewMs === null ? null : new Date(lastReviewMs).toISOString(),
    nextWeeklyReviewAt: new Date(nextWeeklyReviewMs).toISOString(),
    nextMonthlyReviewAt: new Date(nextMonthlyReviewMs).toISOString(),
    weeklyReviewDue,
    monthlyReviewDue,
    overdue: weeklyReviewDue || monthlyReviewDue,
    automationEnabled: false,
  }
}

function latestFounderReviewMs(state: FounderAreaStateInput): number | null {
  const reviewedAt = (state.founderReviewHistory ?? [])
    .map((entry) => Date.parse(entry.at))
    .filter(Number.isFinite)
  return reviewedAt.length > 0 ? Math.max(...reviewedAt) : null
}

function safeDateMs(value: string, fallback: string): number {
  const ms = Date.parse(value)
  if (Number.isFinite(ms)) return ms
  const fallbackMs = Date.parse(fallback)
  return Number.isFinite(fallbackMs) ? fallbackMs : 0
}

function founderCovenantReviewDueMessage(schedule: FounderAreaCovenantReviewSchedule): string {
  const cadence = schedule.monthlyReviewDue ? 'monthly' : 'weekly'
  return `Founder covenant ${cadence} review is due; record manual evidence before any warning, probation, or replacement decision.`
}

function founderCovenantNotificationDrafts(
  state: FounderAreaStateInput,
  input: {
    nextAction: FounderAreaCovenantNextAction
  },
): FounderAreaCovenantNotificationDraft[] {
  if (input.nextAction === 'none') return []
  const manualReview = input.nextAction === 'manual_review'
  const kind: FounderAreaCovenantNotificationDraftKind = manualReview ? 'manual_review_required' : 'founder_warning'
  return [{
    id: `${state.areaId}:${Date.parse(state.updatedAt)}:covenant-notification:${kind}:${state.founderCitizenId}`,
    at: state.updatedAt,
    kind,
    channel: 'telegram',
    recipientCitizenId: state.founderCitizenId,
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

function areaServiceDemand(citizens: FounderAreaCitizen[]): Record<FounderAreaBusinessKind, number> {
  const demand = emptyBusinessKindRecord()
  for (const citizen of citizens) {
    if (citizen.needs.hydration < 70) demand.water += 1
    if (citizen.needs.hunger < 70) demand.food += 1
    if (citizen.needs.energy < 60) demand.housing += 1
    if (citizen.health < 80) demand.clinic += 1
    if (!citizen.insurancePaidUntil) demand.insurance += 1
  }
  return demand
}

function areaServiceCapacity(
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
): Record<FounderAreaBusinessKind, number> {
  const capacity = emptyBusinessKindRecord()
  for (const business of businesses) {
    capacity[business.kind] += hourlyServiceCapacity(citizens, business)
  }
  return capacity
}

function emptyBusinessKindRecord(): Record<FounderAreaBusinessKind, number> {
  return {
    water: 0,
    food: 0,
    housing: 0,
    clinic: 0,
    insurance: 0,
  }
}

function totalCitizenDebt(citizen: FounderAreaCitizen): number {
  const itemizedDebt = (citizen.debts ?? []).reduce((total, debt) => total + debt.amount, 0)
  return roundMoney(Math.max(citizen.debt, itemizedDebt))
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

function founderAreaDashboard(state: FounderAreaState): FounderAreaDashboard {
  const demand = areaServiceDemand(state.citizens)
  const simDemand = areaServiceDemand(state.citizens.filter((citizen) => citizen.kind === 'sim'))
  const realDemand = areaServiceDemand(state.citizens.filter((citizen) => citizen.kind === 'real'))
  const supply = areaServiceSupply(state.businesses)
  const capacity = areaServiceCapacity(state.citizens, state.businesses)
  const licensePopulation = activePopulation(state)
  const licenses = areaLicenseDashboard(licensePopulation, supply)
  const licenseSlots = emptyBusinessKindRecord()
  const saturation = emptyBusinessKindRecord()
  const shortage = emptyBusinessKindRecord()
  for (const kind of BUSINESS_KINDS) {
    licenseSlots[kind] = licenses[kind].slots
    saturation[kind] = licenses[kind].saturation
    shortage[kind] = Math.max(0, demand[kind] - capacity[kind])
  }
  return {
    areaId: state.areaId,
    updatedAt: state.updatedAt,
    founderIdentity: {
      citizenId: state.founderCitizenId,
      founderNumber: state.founderNumber,
      claimSource: state.claim.source,
      telegramUserId: state.claim.telegramUserId ?? null,
      telegramAccountId: state.claim.telegramAccountId ?? null,
    },
    population: state.citizens.length,
    simPopulation: state.citizens.filter((citizen) => citizen.kind === 'sim').length,
    realPopulation: state.citizens.filter((citizen) => citizen.kind === 'real').length,
    demand,
    simDemand,
    realDemand,
    supply,
    capacity,
    shortage,
    jobs: areaJobsDashboard(state),
    licenseSlots,
    saturation,
    licenses,
    firstBuild: firstBuildRecommendations(state, { demand, supply, licenses }),
    existingBusinesses: state.businesses.map((business) => businessDashboard(state, business)),
    citizens: state.citizens.map((citizen) => citizenDashboard(state, citizen)),
    survival: survivalDashboard(state),
    ledger: areaLedgerDashboard(state),
    areaEvents: areaEventsDashboard(state),
    growth: areaGrowthDashboard(state),
    settlement: areaSettlementDashboard(state),
    payoutReadiness: areaPayoutReadinessDashboard(state),
    legacyRoyalty: areaLegacyRoyaltyDashboard(state),
    handoff: areaHandoffDashboard(state),
    landRights: areaLandRightsDashboard(state),
    founderCovenant: state.founderCovenant,
  }
}

function areaGrowthDashboard(state: FounderAreaState): FounderAreaGrowthDashboard {
  return {
    channel: 'telegram',
    inviteLinkEnabled: false,
    inviteTrackingEnabled: false,
    automaticRewardsEnabled: false,
    manualEvidenceRequired: true,
    realPopulation: state.citizens.filter((citizen) => citizen.kind === 'real').length,
    simPopulation: state.citizens.filter((citizen) => citizen.kind === 'sim').length,
    trackedInvites: 0,
    blockers: [
      'telegram_invite_links_disabled',
      'invite_tracking_disabled',
      'automatic_growth_rewards_disabled',
      'manual_review_required',
    ],
  }
}

function areaSettlementDashboard(state: FounderAreaState): FounderAreaSettlementDashboard {
  return {
    rail: 'ton',
    mode: 'ledger_only',
    gameplayLedgerSource: 'reality_server',
    gameCredits: roundMoney(state.balance),
    payoutEligibleCredits: 0,
    walletConnectionRequired: false,
    walletConnectionEnabled: false,
    depositsEnabled: false,
    withdrawalsEnabled: false,
    landReservationsEnabled: false,
    landLeasesEnabled: false,
    highFrequencyOnChainTransactions: false,
    manualReviewRequired: true,
    complianceReviewRequired: true,
    blockers: [
      'ton_connect_disabled',
      'deposits_disabled',
      'withdrawals_disabled',
      'land_reservations_disabled',
      'leases_disabled',
      'manual_payout_review_required',
      'compliance_review_required',
    ],
  }
}

function areaPayoutReadinessDashboard(state: FounderAreaState): FounderAreaPayoutReadinessDashboard {
  return {
    enabled: false,
    mode: 'game_credits_only',
    gameplayLedgerSource: 'reality_server',
    gameCredits: roundMoney(state.balance),
    payoutEligibleCredits: 0,
    realWithdrawalsEnabled: false,
    manualPayoutApprovalEnabled: false,
    kycRequired: true,
    kycStatus: 'not_started',
    taxProfileRequired: true,
    taxProfileStatus: 'not_started',
    complianceReviewRequired: true,
    noProfitPromise: true,
    tonSettlementEnabled: false,
    stablecoinRailPlanned: true,
    blockers: [
      'game_credits_only',
      'payouts_disabled',
      'withdrawals_disabled',
      'kyc_disabled',
      'tax_profile_disabled',
      'manual_payout_review_required',
      'compliance_review_required',
      'ton_settlement_disabled',
    ],
  }
}

function areaLegacyRoyaltyDashboard(state: FounderAreaState): FounderAreaLegacyRoyaltyDashboard {
  const royaltyEligibleBusinessIds = state.businesses
    .filter((business) => business.ownerId === state.founderCitizenId && business.createdBy !== state.founderCitizenId)
    .map((business) => business.id)
  const royaltyExcludedBusinessIds = state.businesses
    .filter((business) => business.createdBy === state.founderCitizenId)
    .map((business) => business.id)

  return {
    enabled: false,
    payoutEnabled: false,
    replacementWorkflowEnabled: false,
    manualReviewRequired: true,
    appliesTo: 'inherited_founder_created_businesses_only',
    royaltyRate: FOUNDER_LEGACY_ROYALTY_RATE,
    treasuryAccountId: FOUNDER_LEGACY_TREASURY_ACCOUNT_ID,
    royaltyEligibleBusinessIds,
    royaltyExcludedBusinessIds,
    blockers: [
      'replacement_workflow_disabled',
      'waitlist_handoff_disabled',
      'treasury_payout_disabled',
      'compliance_review_required',
    ],
  }
}

function areaHandoffDashboard(state: FounderAreaState): FounderAreaHandoffDashboard {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const now = new Date(state.updatedAt)
  const namedHeir = founder?.heirCitizenId
    ? state.citizens.find((citizen) => citizen.id === founder.heirCitizenId && citizen.kind === 'real')
    : undefined
  const founderBusinesses = state.businesses.filter((business) => business.ownerId === state.founderCitizenId)
  const founderCreatedBusinessCount = founderBusinesses
    .filter((business) => business.createdBy === state.founderCitizenId)
    .length
  const inheritedBusinessCount = founderBusinesses.length - founderCreatedBusinessCount
  const debts = founder?.debts ?? []

  return {
    enabled: false,
    mode: 'manual_disabled',
    candidateSelectionEnabled: false,
    replacementWorkflowEnabled: false,
    waitlistHandoffEnabled: false,
    seatTransferEnabled: false,
    areaTransferEnabled: false,
    businessTransferEnabled: false,
    debtTransferEnabled: false,
    legacyRulesTransferEnabled: false,
    manualReviewRequired: true,
    successorCandidateSource: namedHeir ? 'named_heir' : 'none',
    successorCandidateCitizenId: namedHeir?.id ?? null,
    successorCandidateName: namedHeir?.name ?? null,
    transferPackage: {
      founderNumber: state.founderNumber,
      founderCitizenId: state.founderCitizenId,
      areaId: state.areaId,
      businessCount: founderBusinesses.length,
      founderCreatedBusinessCount,
      inheritedBusinessCount,
      outstandingDebt: founder ? totalCitizenDebt(founder) : 0,
      debtObligationCount: debts.length,
      protectedByInsurance: founder ? hasActiveInsurance(founder, now) : false,
      legacyRoyaltyRate: FOUNDER_LEGACY_ROYALTY_RATE,
      legacyTreasuryAccountId: FOUNDER_LEGACY_TREASURY_ACCOUNT_ID,
    },
    blockers: [
      'replacement_workflow_disabled',
      'waitlist_handoff_disabled',
      'candidate_selection_disabled',
      'main_founder_approval_required',
      'manual_review_required',
    ],
  }
}

function areaLandRightsDashboard(state: FounderAreaState): FounderAreaLandRightsDashboard {
  return {
    enabled: false,
    mode: 'disabled_until_survival_business_loop_review',
    publicWording: 'reservation_building_rights',
    landSalesEnabled: false,
    reservationsEnabled: false,
    purchasesEnabled: false,
    leasesEnabled: false,
    rentCollectionEnabled: false,
    platformFeeEnabled: false,
    areaId: state.areaId,
    areaLabel: state.claim.label,
    ownerCitizenId: state.founderCitizenId,
    radiusKm: state.claim.radiusKm,
    businessCount: state.businesses.length,
    operatorCount: 0,
    leaseTemplate: {
      enabled: false,
      termDays: LAND_LEASE_TEMPLATE_TERM_DAYS,
      fixedMonthlyRent: null,
      rentCurrency: 'game_credits',
      payerCitizenId: null,
      receiverCitizenId: state.founderCitizenId,
      platformFeeRate: LAND_LEASE_PLATFORM_FEE_RATE,
      platformFeeReceiverId: PLATFORM_FEE_ACCOUNT_ID,
      requiresOperator: true,
      requiresDemand: true,
    },
    blockers: [
      'land_reservations_disabled',
      'land_purchases_disabled',
      'leases_disabled',
      'rent_collection_disabled',
      'operator_acceptance_disabled',
      'manual_review_required',
      'compliance_review_required',
    ],
  }
}

function areaLedgerDashboard(state: FounderAreaState): FounderAreaLedgerDashboard {
  const totalsByKind = zeroTransactionKindRecord()
  for (const transaction of state.transactions) {
    totalsByKind[transaction.kind] = roundMoney(totalsByKind[transaction.kind] + transaction.amount)
  }

  return {
    transactionCount: state.transactions.length,
    totalsByKind,
    payoutClassification: ledgerPayoutClassification(state.transactions),
    recentTransactions: state.transactions.slice(-10).reverse().map((transaction) => ({ ...transaction })),
  }
}

function areaEventsDashboard(state: FounderAreaState): FounderAreaEventsDashboard {
  const events = normalizeFounderAreaEvents(state.areaEvents)
  return {
    eventCount: events.length,
    simDepartures: events.filter((event) => event.kind === 'sim_citizen_departure' && event.simulated).length,
    warningEvents: events.filter((event) => event.severity === 'warning').length,
    criticalEvents: events.filter((event) => event.severity === 'critical').length,
    recentEvents: events.slice(-10).reverse().map(areaEventDashboard),
  }
}

function areaEventDashboard(event: FounderAreaEvent): FounderAreaEventDashboard {
  return {
    ...event,
    needs: { ...event.needs },
    displayName: event.simulated ? `${event.citizenName} (Sim)` : event.citizenName,
    participantLabel: event.simulated ? 'Sim Citizen' : 'Real Citizen',
    visualTone: event.simulated ? 'simulated' : 'real',
  }
}

function ledgerPayoutClassification(
  transactions: FounderAreaTransaction[],
): FounderAreaLedgerPayoutClassificationDashboard {
  const gameOnlyTransactions = transactions.filter((transaction) => transaction.payoutEligibility === 'game_only')
  return {
    gameOnlyTransactionCount: gameOnlyTransactions.length,
    gameOnlyAmount: roundMoney(gameOnlyTransactions.reduce((total, transaction) => total + transaction.amount, 0)),
    payoutEligibleTransactionCount: 0,
    payoutEligibleAmount: 0,
    manualPayoutReviewRequired: true,
    realWithdrawalEligible: false,
  }
}

function zeroTransactionKindRecord(): Record<FounderAreaTransactionKind, number> {
  return Object.fromEntries(TRANSACTION_KINDS.map((kind) => [kind, 0])) as Record<FounderAreaTransactionKind, number>
}

function areaServiceSupply(businesses: FounderAreaBusiness[]): Record<FounderAreaBusinessKind, number> {
  const supply = emptyBusinessKindRecord()
  for (const business of businesses) {
    supply[business.kind] += 1
  }
  return supply
}

function areaLicenseDashboard(
  population: number,
  supply: Record<FounderAreaBusinessKind, number>,
): Record<FounderAreaBusinessKind, FounderAreaLicenseDashboard> {
  const licenses = {} as Record<FounderAreaBusinessKind, FounderAreaLicenseDashboard>
  for (const kind of BUSINESS_KINDS) {
    const slots = licenseSlotsForPopulation(population, kind)
    const used = supply[kind]
    licenses[kind] = {
      slots,
      used,
      remaining: Math.max(0, slots - used),
      saturation: slots <= 0 ? (used > 0 ? 1 : 0) : Math.min(1, used / slots),
    }
  }
  return licenses
}

function activePopulation(state: FounderAreaState): number {
  return state.citizens.filter((citizen) => citizen.state.kind === 'active').length
}

function licenseSlotsForPopulation(population: number, kind: FounderAreaBusinessKind): number {
  return Math.max(MIN_LICENSE_SLOTS[kind], Math.floor(population / LICENSE_POPULATION_STEP[kind]))
}

function firstBuildRecommendations(
  state: FounderAreaState,
  input: {
    demand: Record<FounderAreaBusinessKind, number>
    supply: Record<FounderAreaBusinessKind, number>
    licenses: Record<FounderAreaBusinessKind, FounderAreaLicenseDashboard>
  },
): FounderAreaFirstBuildRecommendation[] {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const founderActive = founder?.state.kind === 'active'
  const population = activePopulation(state)

  return BUSINESS_KINDS.map((kind) => {
    const blueprint = BUSINESS_BLUEPRINTS[kind]
    const license = input.licenses[kind]
    const proposedBusinessId = license.remaining > 0 ? `${state.areaId}:${kind}:${input.supply[kind] + 1}` : null
    const licensed = license.remaining > 0
    const saturated = license.saturation >= 1
    const essential = kind === 'water' || kind === 'food' || kind === 'housing'
    const founderCanAfford = state.balance >= blueprint.buildCost
    const cashShortfall = roundMoney(Math.max(0, blueprint.buildCost - state.balance))
    const blockers = firstBuildBlockers({ founderActive, founderCanAfford, licensed })
    const canBuildNow = Boolean(blockers.length === 0 && proposedBusinessId)
    const estimate = firstBuildEconomics(kind, input.demand[kind], input.supply[kind], licensed)
    const score = firstBuildScore({
      demand: input.demand[kind],
      supply: input.supply[kind],
      essential,
      licensed,
      saturated,
    })
    const nextLicensePopulation = nextLicenseUnlockPopulation(population, kind)
    return {
      kind,
      name: blueprint.name,
      proposedBusinessId,
      priority: firstBuildPriority({
        demand: input.demand[kind],
        supply: input.supply[kind],
        essential,
        licensed,
        saturated,
      }),
      action: firstBuildAction({
        canBuildNow,
        demand: input.demand[kind],
        licensed,
        founderActive,
        founderCanAfford,
      }),
      buildCost: blueprint.buildCost,
      cashShortfall,
      currentDemand: input.demand[kind],
      currentSupply: input.supply[kind],
      licenseSlots: license.slots,
      licensesRemaining: license.remaining,
      nextLicensePopulation,
      citizensUntilNextLicense: Math.max(0, nextLicensePopulation - population),
      saturation: license.saturation,
      founderCanAfford,
      canBuildNow,
      blockers,
      licensed,
      saturated,
      score,
      ...estimate,
      estimatedPaybackHours: estimate.estimatedHourlyProfit > 0
        ? roundMoney(blueprint.buildCost / estimate.estimatedHourlyProfit)
        : null,
      clientPayload: canBuildNow
        ? {
          type: 'buildBusiness',
          businessKind: kind,
          businessId: proposedBusinessId as string,
          name: blueprint.name,
        }
        : null,
      reason: firstBuildReason({
        founderActive,
        founderCanAfford,
        licensesRemaining: license.remaining,
        demand: input.demand[kind],
        supply: input.supply[kind],
      }),
    }
  }).sort((left, right) => {
    if (left.canBuildNow !== right.canBuildNow) return left.canBuildNow ? -1 : 1
    const leftShortage = Math.max(0, left.currentDemand - left.currentSupply)
    const rightShortage = Math.max(0, right.currentDemand - right.currentSupply)
    if (leftShortage !== rightShortage) return rightShortage - leftShortage
    if (left.currentDemand !== right.currentDemand) return right.currentDemand - left.currentDemand
    return left.buildCost - right.buildCost
  })
}

function firstBuildBlockers(input: {
  founderActive: boolean
  founderCanAfford: boolean
  licensed: boolean
}): FounderAreaFirstBuildBlocker[] {
  const blockers: FounderAreaFirstBuildBlocker[] = []
  if (!input.founderActive) blockers.push('actor_unavailable')
  if (!input.licensed) blockers.push('license_unavailable')
  if (!input.founderCanAfford) blockers.push('insufficient_funds')
  return blockers
}

function firstBuildAction(input: {
  canBuildNow: boolean
  demand: number
  licensed: boolean
  founderActive: boolean
  founderCanAfford: boolean
}): FounderAreaFirstBuildAction {
  if (!input.founderActive) return 'recover_first'
  if (!input.licensed) return 'grow_demand'
  if (!input.founderCanAfford) return 'save_credits'
  if (!input.canBuildNow) return 'save_credits'
  if (input.demand <= 0) return 'wait_for_demand'
  return 'build_now'
}

function firstBuildPriority(input: {
  demand: number
  supply: number
  essential: boolean
  licensed: boolean
  saturated: boolean
}): FounderAreaFirstBuildPriority {
  if (input.essential && input.supply === 0 && input.demand > 0 && input.licensed) return 'critical'
  if (input.demand >= 3 && input.licensed && !input.saturated) return 'high'
  if (input.demand > 0 && input.licensed && !input.saturated) return 'medium'
  return 'low'
}

function firstBuildScore(input: {
  demand: number
  supply: number
  essential: boolean
  licensed: boolean
  saturated: boolean
}): number {
  let score = input.demand * 10
  if (input.essential && input.supply === 0) score += 30
  if (input.licensed) score += 12
  if (input.saturated) score -= 30
  return roundMoney(score)
}

function firstBuildEconomics(
  kind: FounderAreaBusinessKind,
  demand: number,
  supply: number,
  licensed: boolean,
): Pick<
  FounderAreaFirstBuildRecommendation,
  'estimatedHourlyRevenue' | 'estimatedHourlyWageCost' | 'estimatedHourlyProfit'
> {
  const blueprint = BUSINESS_BLUEPRINTS[kind]
  const demandShare = licensed ? demand / (supply + 1) : 0
  const servedDemand = Math.min(demandShare, BASE_SERVICE_CAPACITY_PER_HOUR[kind])
  const estimatedHourlyRevenue = roundMoney(servedDemand * blueprint.price)
  const estimatedHourlyWageCost = licensed ? roundMoney(TARGET_STAFF_BY_KIND[kind] * blueprint.wagePerHour) : 0
  return {
    estimatedHourlyRevenue,
    estimatedHourlyWageCost,
    estimatedHourlyProfit: roundMoney(estimatedHourlyRevenue - estimatedHourlyWageCost),
  }
}

function nextLicenseUnlockPopulation(population: number, kind: FounderAreaBusinessKind): number {
  return (licenseSlotsForPopulation(population, kind) + 1) * LICENSE_POPULATION_STEP[kind]
}

function firstBuildReason(input: {
  founderActive: boolean
  founderCanAfford: boolean
  licensesRemaining: number
  demand: number
  supply: number
}): string {
  if (!input.founderActive) return 'Founder must recover before building.'
  if (input.licensesRemaining <= 0) return 'No starter license remains for this business kind.'
  if (!input.founderCanAfford) return 'Founder balance is too low for this build.'
  if (input.demand > input.supply) return 'Local demand is waiting for this service.'
  return 'Low current demand; consider it after the area grows.'
}

function areaJobsDashboard(state: FounderAreaState): FounderAreaJobsDashboard {
  let employedCitizens = 0
  let hireableSimWorkers = 0
  let openPositions = 0
  let understaffedBusinesses = 0
  const hiringSlots: FounderAreaBusiness[] = []
  for (const citizen of state.citizens) {
    const employed = hasActiveJob(state, citizen)
    if (employed) employedCitizens += 1
    if (!employed && citizen.kind === 'sim' && citizen.state.kind === 'active') hireableSimWorkers += 1
  }
  for (const business of state.businesses) {
    const targetStaff = TARGET_STAFF_BY_KIND[business.kind]
    const activeStaff = activeStaffCount(state.citizens, business)
    const openForBusiness = Math.max(0, targetStaff - activeStaff)
    if (openForBusiness > 0) {
      understaffedBusinesses += 1
      openPositions += openForBusiness
      for (let slot = 0; slot < openForBusiness; slot += 1) hiringSlots.push(business)
    }
  }
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const founderCanManage = founder?.state.kind === 'active'
  const candidates = state.citizens
    .filter((citizen) =>
      citizen.id !== state.founderCitizenId &&
      citizen.state.kind === 'active' &&
      !hasActiveJob(state, citizen) &&
      !citizen.jobBusinessId
    )
    .map((citizen, index) => workerCandidateDashboard(citizen, hiringSlots[index] ?? null, founderCanManage))
  return {
    employedCitizens,
    unemployedCitizens: state.citizens.length - employedCitizens,
    hireableSimWorkers,
    realWorkersRequiringAcceptance: candidates.filter((candidate) => candidate.action === 'requires_acceptance').length,
    openPositions,
    understaffedBusinesses,
    candidates,
  }
}

function hasActiveJob(state: FounderAreaState, citizen: FounderAreaCitizen): boolean {
  if (citizen.state.kind !== 'active' || !citizen.jobBusinessId) return false
  return state.businesses.some((business) =>
    business.id === citizen.jobBusinessId && business.staffCitizenIds.includes(citizen.id)
  )
}

function workerCandidateDashboard(
  citizen: FounderAreaCitizen,
  recommendedBusiness: FounderAreaBusiness | null,
  founderCanManage: boolean,
): FounderAreaWorkerCandidateDashboard {
  const simulated = citizen.kind === 'sim'
  const canHireNow = founderCanManage && simulated && recommendedBusiness !== null
  return {
    citizenId: citizen.id,
    name: citizen.name,
    displayName: simulated ? `${citizen.name} (Sim)` : citizen.name,
    kind: citizen.kind,
    simulated,
    participantLabel: simulated ? 'Sim Citizen' : 'Real Citizen',
    visualTone: simulated ? 'simulated' : 'real',
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
  citizen: FounderAreaCitizen,
  recommendedBusiness: FounderAreaBusiness | null,
  founderCanManage: boolean,
): FounderAreaWorkerCandidateAction {
  if (citizen.kind !== 'sim') return 'requires_acceptance'
  if (!founderCanManage && recommendedBusiness) return 'founder_unavailable'
  if (recommendedBusiness) return 'hire_now'
  return 'waiting_for_position'
}

function businessDashboard(state: FounderAreaState, business: FounderAreaBusiness): FounderAreaBusinessDashboard {
  const activeStaff = activeStaffCount(state.citizens, business)
  const targetStaff = TARGET_STAFF_BY_KIND[business.kind]
  const quality = effectiveBusinessQuality(state.citizens, business)
  const ledger = businessLedgerDashboard(state, business)
  const alerts = businessAlerts(state, business, { activeStaff, targetStaff, quality })
  return {
    id: business.id,
    name: business.name,
    kind: business.kind,
    ownerId: business.ownerId,
    cash: business.cash,
    price: business.price,
    wagePerHour: business.wagePerHour,
    quality,
    activeStaff,
    targetStaff,
    openPositions: Math.max(0, targetStaff - activeStaff),
    hourlyCapacity: hourlyServiceCapacity(state.citizens, business),
    ledger,
    status: businessStatus(alerts),
    alerts,
  }
}

function businessLedgerDashboard(
  state: FounderAreaState,
  business: FounderAreaBusiness,
): FounderAreaBusinessLedgerDashboard {
  const relatedTransactions = state.transactions.filter((transaction) =>
    transaction.fromId === business.id || transaction.toId === business.id
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
    recentTransactions: relatedTransactions.slice(-5).reverse().map((transaction) => ({ ...transaction })),
  }
}

function isCashRevenue(kind: FounderAreaTransaction['kind']): boolean {
  return kind === 'customer_purchase' ||
    kind === 'insurance_premium' ||
    kind === 'hospital_bill' ||
    kind === 'insurance_payout' ||
    kind === 'debt_repayment'
}

function isCashExpense(kind: FounderAreaTransaction['kind']): boolean {
  return kind === 'worker_wage' || kind === 'insurance_payout'
}

function businessAlerts(
  state: FounderAreaState,
  business: FounderAreaBusiness,
  input: {
    activeStaff: number
    targetStaff: number
    quality: number
  },
): FounderAreaBusinessAlert[] {
  const alerts: FounderAreaBusinessAlert[] = []
  const owner = state.citizens.find((citizen) => citizen.id === business.ownerId)
  if (input.activeStaff < input.targetStaff) {
    alerts.push({
      kind: 'understaffed',
      severity: input.activeStaff === 0 && input.targetStaff > 0 ? 'critical' : 'warning',
    })
  }
  const nextHourWageDue = business.wagePerHour * input.activeStaff
  if (input.activeStaff > 0 && business.cash < nextHourWageDue) {
    alerts.push({ kind: 'cash_risk', severity: 'critical' })
  }
  if (owner?.state.kind === 'hospitalized' && input.activeStaff === 0) {
    alerts.push({ kind: 'owner_unavailable', severity: 'critical' })
  }
  if (input.quality <= MIN_BUSINESS_QUALITY || input.quality < 0.6) {
    alerts.push({
      kind: 'quality_degraded',
      severity: input.quality <= MIN_BUSINESS_QUALITY ? 'critical' : 'warning',
    })
  }
  return alerts
}

function businessStatus(alerts: FounderAreaBusinessAlert[]): FounderAreaBusinessStatus {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical'
  if (alerts.length > 0) return 'warning'
  return 'stable'
}

function citizenDashboard(state: FounderAreaState, citizen: FounderAreaCitizen): FounderAreaCitizenDashboard {
  const simulated = citizen.kind === 'sim'
  const now = new Date(state.updatedAt)
  return {
    id: citizen.id,
    name: citizen.name,
    displayName: simulated ? `${citizen.name} (Sim)` : citizen.name,
    kind: citizen.kind,
    simulated,
    participantLabel: simulated ? 'Sim Citizen' : 'Real Citizen',
    visualTone: simulated ? 'simulated' : 'real',
    state: citizen.state.kind,
    health: citizen.health,
    needs: { ...citizen.needs },
    money: citizen.money,
    debt: totalCitizenDebt(citizen),
    debts: (citizen.debts ?? []).map((debt) => debtDashboard(citizen, debt)),
    homeBusinessId: citizen.homeBusinessId,
    jobBusinessId: citizen.jobBusinessId,
    insuranceBusinessId: citizen.insuranceBusinessId,
    heirCitizenId: citizen.heirCitizenId,
    insuranceActive: hasActiveInsurance(citizen, now),
    insuranceAction: insuranceActionDashboard(state, citizen, now),
    estateProtection: estateProtectionDashboard(state, citizen, now),
  }
}

function debtDashboard(citizen: FounderAreaCitizen, debt: FounderAreaDebt): FounderAreaCitizenDebtDashboard {
  const maxAffordablePayment = roundMoney(Math.min(citizen.money, debt.amount))
  const blockers: FounderAreaDebtRepaymentBlocker[] = []
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
}

function insuranceActionDashboard(
  state: FounderAreaState,
  citizen: FounderAreaCitizen,
  now: Date,
): FounderAreaInsuranceActionDashboard {
  const insurer = [...state.businesses]
    .filter((business) => business.kind === 'insurance')
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))[0]
  const premium = insurer?.price ?? null
  const activeInsurance = hasActiveInsurance(citizen, now)
  const canAfford = premium !== null && citizen.money >= premium
  const blockers: FounderAreaInsuranceActionBlocker[] = []

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

function estateProtectionDashboard(
  state: FounderAreaState,
  citizen: FounderAreaCitizen,
  now: Date,
): FounderAreaEstateProtectionDashboard {
  const heir = citizen.heirCitizenId
    ? state.citizens.find((candidate) => candidate.id === citizen.heirCitizenId && candidate.kind === 'real')
    : undefined
  return {
    enabled: false,
    namingEnabled: false,
    transferEnabled: false,
    waitlistFallbackEnabled: false,
    manualReviewRequired: true,
    namedHeirCitizenId: heir?.id ?? null,
    namedHeirName: heir?.name ?? null,
    protectedByInsurance: hasActiveInsurance(citizen, now),
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

function survivalDashboard(state: FounderAreaState): FounderAreaSurvivalDashboard {
  const signals = state.citizens.map((citizen) => citizenSurvivalSignal(state, citizen))
  return {
    stableCitizens: signals.filter((signal) => signal.risk === 'stable').length,
    warningCitizens: signals.filter((signal) => signal.risk === 'warning').length,
    dangerCitizens: signals.filter((signal) => signal.risk === 'danger').length,
    hospitalizedCitizens: signals.filter((signal) => signal.risk === 'hospitalized').length,
    signals,
  }
}

function citizenSurvivalSignal(state: FounderAreaState, citizen: FounderAreaCitizen): FounderAreaSurvivalSignal {
  const simulated = citizen.kind === 'sim'
  const base = {
    citizenId: citizen.id,
    name: citizen.name,
    displayName: simulated ? `${citizen.name} (Sim)` : citizen.name,
    kind: citizen.kind,
    simulated,
    participantLabel: simulated ? 'Sim Citizen' as const : 'Real Citizen' as const,
    visualTone: simulated ? 'simulated' as const : 'real' as const,
  }
  if (citizen.state.kind === 'hospitalized') {
    return {
      ...base,
      risk: 'hospitalized',
      warnings: ['health'],
      actions: [survivalActionForWarning(state, citizen, 'health')],
      hospitalizedUntil: citizen.state.until,
    }
  }

  const warnings: FounderAreaSurvivalWarningKind[] = []
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
    ...base,
    risk: danger ? 'danger' : warnings.length > 0 ? 'warning' : 'stable',
    warnings,
    actions: warnings.map((warning) => survivalActionForWarning(state, citizen, warning)),
  }
}

function survivalActionForWarning(
  state: FounderAreaState,
  citizen: FounderAreaCitizen,
  warning: FounderAreaSurvivalWarningKind,
): FounderAreaSurvivalAction {
  const { intent, serviceKind } = survivalActionTarget(warning)
  const prices = state.businesses
    .filter((business) => business.kind === serviceKind && hourlyServiceCapacity(state.citizens, business) > 0)
    .map((business) => business.price)
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null
  const available = lowestPrice !== null
  const canAfford = lowestPrice !== null && citizen.money >= lowestPrice
  const blockers: FounderAreaSurvivalActionBlocker[] = []
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

function survivalActionTarget(warning: FounderAreaSurvivalWarningKind): {
  intent: FounderAreaSurvivalActionIntent
  serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>
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

function areaPayload(state: FounderAreaState | null): {
  state: FounderAreaState | null
  dashboard: FounderAreaDashboard | null
} {
  return {
    state,
    dashboard: state ? founderAreaDashboard(state) : null,
  }
}

function founderCitizenRecord(citizen: CitizenAuthRecord, money: number): FounderAreaCitizen {
  const paddedFounder = String(citizen.founderNumber).padStart(4, '0')
  return {
    id: citizen.citizenId,
    name: `Founder #${paddedFounder}`,
    kind: 'real',
    money,
    debt: 0,
    needs: { ...FULL_NEEDS },
    health: 100,
    state: { kind: 'active' },
  }
}

function defaultSimCitizens(areaId: string): FounderAreaCitizen[] {
  return [
    simCitizen(`${areaId}:sim-water`, 'Demo Water Resident', { hydration: 42 }),
    simCitizen(`${areaId}:sim-food`, 'Demo Food Resident', { hunger: 44 }),
    simCitizen(`${areaId}:sim-housing`, 'Demo Housing Resident', { energy: 32 }),
  ]
}

function simCitizen(id: string, name: string, needs: Partial<FounderAreaNeeds>): FounderAreaCitizen {
  return {
    id,
    name,
    kind: 'sim',
    money: SIM_CITIZEN_STARTER_CREDIT,
    debt: 0,
    needs: { ...FULL_NEEDS, ...needs },
    health: 100,
    state: { kind: 'active' },
  }
}

function simCitizenCreditTransaction(
  areaId: string,
  at: string,
  atMs: number,
  sequence: number,
  citizen: FounderAreaCitizen,
): FounderAreaTransaction {
  return {
    id: `${areaId}:${atMs}:sim-citizen-credit:${sequence}:${citizen.id}`,
    at,
    kind: 'sim_citizen_credit',
    payoutEligibility: 'game_only',
    fromId: SIM_CREDIT_ACCOUNT_ID,
    toId: citizen.id,
    amount: SIM_CITIZEN_STARTER_CREDIT,
    memo: `${citizen.name} received simulated resident game credit.`,
  }
}

async function persistAreaState(
  citizenId: string,
  state: FounderAreaStateInput,
  allowOverwrite: boolean,
): Promise<FounderAreaState> {
  const reviewed = withFounderCovenantReview(state)
  await put(areaStatePath(citizenId), JSON.stringify(reviewed), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite,
    contentType: 'application/json',
  })
  return reviewed
}

async function catchUpPersistedAreaState(
  citizenId: string,
  state: FounderAreaState,
  now: Date,
): Promise<FounderAreaState> {
  const caughtUp = catchUpAreaClock(state, now)
  return caughtUp ? persistAreaState(citizenId, caughtUp, true) : state
}

async function handleServerClockTickAreas(
  req: VercelRequest,
  res: VercelResponse,
  rawIntent: unknown,
): Promise<void> {
  if (!hasServerClockAuthority(req)) {
    res.status(serverClockTickAreasStatus('server_clock_unauthorized')).json({
      ok: false,
      error: serverClockTickAreasMessage('server_clock_unauthorized'),
      code: 'server_clock_unauthorized',
    })
    return
  }

  const intent = normalizeServerClockTickAreasIntent(rawIntent)
  if (!intent.ok) {
    res.status(serverClockTickAreasStatus(intent.error)).json({
      ok: false,
      error: serverClockTickAreasMessage(intent.error),
      code: intent.error,
    })
    return
  }

  const clock = await tickServerClockAreas(new Date(), intent.limit, intent.pages, intent.cursor)
  res.status(200).json({ ok: true, clock })
}

async function handleFounderCovenantReviewQueue(
  req: VercelRequest,
  res: VercelResponse,
  rawIntent: unknown,
): Promise<void> {
  if (!hasFounderCovenantReviewQueueAuthority(req)) {
    res.status(founderCovenantReviewQueueStatus('server_clock_unauthorized')).json({
      ok: false,
      error: founderCovenantReviewQueueMessage('server_clock_unauthorized'),
      code: 'server_clock_unauthorized',
    })
    return
  }

  const intent = normalizeFounderCovenantReviewQueueIntent(rawIntent)
  if (!intent.ok) {
    res.status(founderCovenantReviewQueueStatus(intent.error)).json({
      ok: false,
      error: founderCovenantReviewQueueMessage(intent.error),
      code: intent.error,
    })
    return
  }

  const founderCovenantReviewQueue = await scanFounderCovenantReviewQueue(
    new Date(),
    intent.limit,
    intent.pages,
    intent.cursor,
  )
  res.status(200).json({ ok: true, founderCovenantReviewQueue })
}

async function handleFounderCovenantOperatorReview(
  req: VercelRequest,
  res: VercelResponse,
  rawIntent: unknown,
): Promise<void> {
  const operatorClaims = founderCovenantOperatorClaims(req)
  if (!operatorClaims) {
    res.status(operatorRecordCovenantReviewStatus('operator_unauthorized')).json({
      ok: false,
      error: operatorRecordCovenantReviewMessage('operator_unauthorized'),
      code: 'operator_unauthorized',
    })
    return
  }

  const intent = normalizeOperatorRecordCovenantReviewIntent(rawIntent)
  if (!intent.ok) {
    res.status(operatorRecordCovenantReviewStatus(intent.error)).json({
      ok: false,
      error: operatorRecordCovenantReviewMessage(intent.error),
      code: intent.error,
    })
    return
  }
  if (intent.actionKind !== 'record_review') {
    res.status(operatorRecordCovenantReviewStatus('review_action_disabled')).json({
      ok: false,
      error: operatorRecordCovenantReviewMessage('review_action_disabled'),
      code: 'review_action_disabled',
    })
    return
  }

  const now = new Date()
  const existing = await readAreaState(intent.founderCitizenId)
  const stateForReview = existing ? await catchUpPersistedAreaState(intent.founderCitizenId, existing, now) : null
  if (stateForReview && stateForReview.areaId !== intent.areaId) {
    res.status(operatorRecordCovenantReviewStatus('area_mismatch')).json({
      ok: false,
      error: operatorRecordCovenantReviewMessage('area_mismatch'),
      code: 'area_mismatch',
      ...areaPayload(stateForReview),
    })
    return
  }

  const result = applyRecordCovenantReviewIntent(
    stateForReview,
    {
      type: 'recordCovenantReview',
      actionKind: intent.actionKind,
      note: intent.note,
      evidenceKinds: intent.evidenceKinds,
    },
    now,
    `telegram-operator:${operatorClaims.telegramUserId}`,
  )
  if (!result.ok) {
    res.status(operatorRecordCovenantReviewStatus(result.error)).json({
      ok: false,
      error: operatorRecordCovenantReviewMessage(result.error),
      code: result.error,
      ...areaPayload(stateForReview),
    })
    return
  }

  const state = await persistAreaState(intent.founderCitizenId, result.state, true)
  res.status(200).json({ ok: true, ...areaPayload(state) })
}

async function tickServerClockAreas(
  now: Date,
  limit: number,
  pages: number,
  cursor?: string,
): Promise<ServerClockTickAreasSummary> {
  const results: ServerClockAreaTickResult[] = []
  let pagesScanned = 0
  let hasMore = false
  let nextCursor: string | undefined = cursor

  for (let page = 0; page < pages; page += 1) {
    const batch = await list({
      prefix: 'reality-areas/',
      limit,
      ...(nextCursor ? { cursor: nextCursor } : {}),
    })
    pagesScanned += 1
    for (const blob of batch.blobs) {
      results.push(await tickServerClockAreaBlob(blob, now))
    }

    hasMore = Boolean(batch.hasMore)
    nextCursor = typeof batch.cursor === 'string' && batch.cursor.trim() ? batch.cursor : undefined
    if (!hasMore || !nextCursor) break
  }

  const caughtUp = results.filter((result) => result.status === 'caught_up').length
  const current = results.filter((result) => result.status === 'current').length
  return {
    checkedAt: now.toISOString(),
    limit,
    pages,
    pagesScanned,
    cursor: cursor ?? null,
    nextCursor: nextCursor ?? null,
    scanned: results.length,
    caughtUp,
    current,
    failed: results.length - caughtUp - current,
    hasMore,
    results,
  }
}

async function scanFounderCovenantReviewQueue(
  now: Date,
  limit: number,
  pages: number,
  cursor?: string,
): Promise<FounderCovenantReviewQueueDashboard> {
  const items: FounderCovenantReviewQueueItem[] = []
  const results: FounderCovenantReviewQueueScanResult[] = []
  let pagesScanned = 0
  let hasMore = false
  let nextCursor: string | undefined = cursor

  for (let page = 0; page < pages; page += 1) {
    const batch = await list({
      prefix: 'reality-areas/',
      limit,
      ...(nextCursor ? { cursor: nextCursor } : {}),
    })
    pagesScanned += 1
    for (const blob of batch.blobs) {
      const result = await founderCovenantReviewQueueAreaBlob(blob, now)
      results.push({
        citizenId: result.citizenId,
        areaId: result.areaId,
        status: result.status,
        updatedAt: result.updatedAt,
        transactionsAdded: result.transactionsAdded,
      })
      if (result.item) items.push(result.item)
    }

    hasMore = Boolean(batch.hasMore)
    nextCursor = typeof batch.cursor === 'string' && batch.cursor.trim() ? batch.cursor : undefined
    if (!hasMore || !nextCursor) break
  }

  const caughtUp = results.filter((result) => result.status === 'caught_up').length
  const current = results.filter((result) => result.status === 'current').length
  const sortedItems = [...items].sort(compareFounderCovenantReviewQueueItems)
  return {
    generatedAt: now.toISOString(),
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    approvalWorkflowEnabled: false,
    limit,
    pages,
    pagesScanned,
    cursor: cursor ?? null,
    nextCursor: nextCursor ?? null,
    scanned: results.length,
    caughtUp,
    current,
    failed: results.length - caughtUp - current,
    hasMore,
    totals: founderCovenantReviewQueueTotals(sortedItems),
    items: sortedItems,
    results,
  }
}

async function founderCovenantReviewQueueAreaBlob(
  blob: { pathname?: string; downloadUrl?: string },
  now: Date,
): Promise<FounderCovenantReviewQueueScanResult & { item: FounderCovenantReviewQueueItem | null }> {
  const citizenId = citizenIdFromAreaStatePath(blob.pathname)
  if (!citizenId || !blob.downloadUrl) {
    return founderCovenantReviewQueueAreaResult(null, null, 'invalid', null, 0, null)
  }

  try {
    const response = await fetch(blob.downloadUrl)
    if (!response.ok) return founderCovenantReviewQueueAreaResult(citizenId, null, 'unavailable', null, 0, null)
    const value = await response.json() as unknown
    if (!isFounderAreaState(value, citizenId)) {
      return founderCovenantReviewQueueAreaResult(citizenId, null, 'invalid', null, 0, null)
    }

    const state = normalizeAreaCitizens(value)
    const previousUpdatedAt = state.updatedAt
    const previousTransactionCount = state.transactions.length
    const next = await catchUpPersistedAreaState(citizenId, state, now)
    const transactionsAdded = Math.max(0, next.transactions.length - previousTransactionCount)
    const status: ServerClockAreaTickStatus = next.updatedAt === previousUpdatedAt && transactionsAdded === 0
      ? 'current'
      : 'caught_up'
    return founderCovenantReviewQueueAreaResult(
      citizenId,
      next.areaId,
      status,
      next.updatedAt,
      transactionsAdded,
      founderCovenantReviewQueueItem(next, status, transactionsAdded),
    )
  } catch {
    return founderCovenantReviewQueueAreaResult(citizenId, null, 'unavailable', null, 0, null)
  }
}

function founderCovenantReviewQueueAreaResult(
  citizenId: string | null,
  areaId: string | null,
  status: ServerClockAreaTickStatus,
  updatedAt: string | null,
  transactionsAdded: number,
  item: FounderCovenantReviewQueueItem | null,
): FounderCovenantReviewQueueScanResult & { item: FounderCovenantReviewQueueItem | null } {
  return { citizenId, areaId, status, updatedAt, transactionsAdded, item }
}

function founderCovenantReviewQueueItem(
  state: FounderAreaState,
  scanStatus: ServerClockAreaTickStatus,
  transactionsAdded: number,
): FounderCovenantReviewQueueItem {
  const review = state.founderCovenant
  return {
    areaId: state.areaId,
    areaLabel: state.claim.label,
    founderCitizenId: state.founderCitizenId,
    founderNumber: state.founderNumber,
    updatedAt: state.updatedAt,
    checkedAt: review.activityReview.checkedAt,
    lastReviewAt: review.reviewSchedule.lastReviewAt,
    latestReview: founderCovenantReviewQueueLatestReview(review.latestReview),
    nextWeeklyReviewAt: review.reviewSchedule.nextWeeklyReviewAt,
    nextMonthlyReviewAt: review.reviewSchedule.nextMonthlyReviewAt,
    overdue: review.reviewSchedule.overdue,
    covenantStatus: review.status,
    nextAction: review.nextAction,
    manualReviewRequired: review.manualReviewRequired,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview: { ...review.activityReview },
    reviewInputs: review.reviewInputs.map(founderCovenantReviewInputSnapshot),
    stages: review.stages.map(founderCovenantStageSnapshot),
    reviewReadiness: founderCovenantReviewReadiness(review),
    reviewChecklist: review.reviewChecklist.map(founderCovenantReviewChecklistSnapshot),
    manualActions: review.manualActions.map(founderCovenantManualActionSnapshot),
    economicExposure: founderCovenantReviewQueueEconomicExposure(state),
    reviewQueue: founderCovenantReviewQueueSnapshot(review.reviewQueue),
    signalCounts: founderCovenantReviewSignalCounts(review.signals),
    signalKinds: review.signals.map((signal) => signal.kind),
    recommendedActionKinds: [...review.reviewQueue.recommendedActionKinds],
    pendingApprovalRequests: review.approvalRequests.map(founderCovenantApprovalRequestSnapshot),
    pendingApprovalKinds: [...review.reviewQueue.pendingApprovalKinds],
    pendingNotificationDrafts: review.notificationDrafts.map(founderCovenantNotificationDraftSnapshot),
    pendingNotificationKinds: [...review.reviewQueue.pendingNotificationKinds],
    blockerCount: review.reviewQueue.blockerCount,
    scanStatus,
    transactionsAdded,
  }
}

function founderCovenantReviewQueueEconomicExposure(
  state: FounderAreaState,
): FounderCovenantReviewQueueEconomicExposure {
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const founderBusinesses = state.businesses.filter((business) => business.ownerId === state.founderCitizenId)
  const outstandingDebt = founder ? totalCitizenDebt(founder) : 0
  const itemizedDebtCount = founder?.debts?.length ?? 0
  const checkedAt = new Date(state.updatedAt)
  return {
    founderCash: roundMoney(founder?.money ?? 0),
    outstandingDebt,
    debtCount: itemizedDebtCount > 0 ? itemizedDebtCount : outstandingDebt > 0 ? 1 : 0,
    businessCash: roundMoney(founderBusinesses.reduce((total, business) => total + business.cash, 0)),
    businessCount: founderBusinesses.length,
    unstaffedBusinessCount: founderBusinesses.filter((business) =>
      activeStaffCount(state.citizens, business) < TARGET_STAFF_BY_KIND[business.kind]
    ).length,
    insured: founder ? hasActiveInsurance(founder, checkedAt) : false,
    hospitalized: founder?.state.kind === 'hospitalized',
    gameCreditsOnly: true,
    payoutEligibleCredits: 0,
    manualPayoutReviewRequired: true,
  }
}

function founderCovenantReviewSignalCounts(
  signals: FounderAreaCovenantSignal[],
): FounderCovenantReviewQueueSignalCounts {
  return {
    total: signals.length,
    info: signals.filter((signal) => signal.severity === 'info').length,
    warning: signals.filter((signal) => signal.severity === 'warning').length,
    critical: signals.filter((signal) => signal.severity === 'critical').length,
  }
}

function founderCovenantReviewQueueLatestReview(
  review: FounderAreaCovenantLatestReview | null,
): FounderCovenantReviewQueueLatestReview | null {
  if (!review) return null
  return {
    reviewedAt: review.reviewedAt,
    reviewerId: review.reviewerId,
    actionKind: 'record_review',
    summary: review.summary,
    evidenceOnly: true,
    automationEnabled: false,
  }
}

function founderCovenantReviewQueueTotals(
  items: FounderCovenantReviewQueueItem[],
): FounderCovenantReviewQueueDashboard['totals'] {
  return {
    founders: items.length,
    active: items.filter((item) => item.activityReview.active).length,
    useful: items.filter((item) => item.activityReview.useful).length,
    building: items.filter((item) => item.activityReview.building).length,
    staffed: items.filter((item) => item.activityReview.staffed).length,
    indebted: items.filter((item) => item.activityReview.indebted).length,
    hospitalized: items.filter((item) => item.activityReview.hospitalized).length,
    atRisk: items.filter((item) => item.activityReview.atRisk).length,
    manualReviewRequired: items.filter((item) => item.manualReviewRequired).length,
    overdue: items.filter((item) => item.overdue).length,
    totalFounderCash: roundMoney(items.reduce((total, item) => total + item.economicExposure.founderCash, 0)),
    totalOutstandingDebt: roundMoney(items.reduce((total, item) => total + item.economicExposure.outstandingDebt, 0)),
    totalBusinessCash: roundMoney(items.reduce((total, item) => total + item.economicExposure.businessCash, 0)),
    unstaffedBusinesses: items.reduce((total, item) => total + item.economicExposure.unstaffedBusinessCount, 0),
    insuredFounders: items.filter((item) => item.economicExposure.insured).length,
    pendingApprovals: items.reduce((total, item) => total + item.reviewQueue.pendingApprovalCount, 0),
    pendingNotifications: items.reduce((total, item) => total + item.reviewQueue.pendingNotificationCount, 0),
    blockers: items.reduce((total, item) => total + item.blockerCount, 0),
  }
}

function compareFounderCovenantReviewQueueItems(
  left: FounderCovenantReviewQueueItem,
  right: FounderCovenantReviewQueueItem,
): number {
  return founderCovenantReviewQueuePriority(right) - founderCovenantReviewQueuePriority(left) ||
    left.activityReview.score - right.activityReview.score ||
    left.founderNumber - right.founderNumber
}

function founderCovenantReviewQueuePriority(item: FounderCovenantReviewQueueItem): number {
  let priority = 0
  if (item.manualReviewRequired) priority += 120
  if (item.overdue) priority += 100
  if (item.activityReview.hospitalized) priority += 90
  if (item.activityReview.atRisk) priority += 70
  if (item.activityReview.indebted) priority += 50
  if (!item.activityReview.active) priority += 40
  if (!item.activityReview.useful) priority += 30
  if (!item.activityReview.building) priority += 20
  if (!item.activityReview.staffed) priority += 20
  priority += item.signalCounts.critical * 20
  priority += item.signalCounts.warning * 10
  priority += item.reviewQueue.pendingApprovalCount * 15
  priority += item.reviewQueue.pendingNotificationCount * 5
  priority += item.blockerCount
  return priority
}

async function tickServerClockAreaBlob(
  blob: { pathname?: string; downloadUrl?: string },
  now: Date,
): Promise<ServerClockAreaTickResult> {
  const citizenId = citizenIdFromAreaStatePath(blob.pathname)
  if (!citizenId || !blob.downloadUrl) {
    return serverClockAreaTickResult(null, null, 'invalid', null, 0)
  }

  try {
    const response = await fetch(blob.downloadUrl)
    if (!response.ok) return serverClockAreaTickResult(citizenId, null, 'unavailable', null, 0)
    const value = await response.json() as unknown
    if (!isFounderAreaState(value, citizenId)) return serverClockAreaTickResult(citizenId, null, 'invalid', null, 0)

    const state = normalizeAreaCitizens(value)
    const previousUpdatedAt = state.updatedAt
    const previousTransactionCount = state.transactions.length
    const next = await catchUpPersistedAreaState(citizenId, state, now)
    const transactionsAdded = Math.max(0, next.transactions.length - previousTransactionCount)
    const status: ServerClockAreaTickStatus = next.updatedAt === previousUpdatedAt && transactionsAdded === 0
      ? 'current'
      : 'caught_up'
    return serverClockAreaTickResult(citizenId, next.areaId, status, next.updatedAt, transactionsAdded)
  } catch {
    return serverClockAreaTickResult(citizenId, null, 'unavailable', null, 0)
  }
}

function serverClockAreaTickResult(
  citizenId: string | null,
  areaId: string | null,
  status: ServerClockAreaTickStatus,
  updatedAt: string | null,
  transactionsAdded: number,
): ServerClockAreaTickResult {
  return { citizenId, areaId, status, updatedAt, transactionsAdded }
}

function citizenIdFromAreaStatePath(pathname: string | undefined): string | null {
  const match = pathname?.match(/^reality-areas\/([0-9a-f-]+)\.json$/)
  const citizenId = match?.[1]
  return citizenId && UUID_RE.test(citizenId) ? citizenId : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const rawIntent = readServerClockOrBodyIntent(req)
  const intentType = isRecord(rawIntent) ? rawIntent.type : undefined
  if (req.method === 'POST' && intentType === 'tickAreas') {
    try {
      await handleServerClockTickAreas(req, res, rawIntent)
    } catch {
      res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
    }
    return
  }
  if (req.method === 'GET' && intentType === 'tickAreas') {
    try {
      await handleServerClockTickAreas(req, res, rawIntent)
    } catch {
      res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
    }
    return
  }
  if (intentType === 'founderCovenantReviewQueue') {
    try {
      await handleFounderCovenantReviewQueue(req, res, rawIntent)
    } catch {
      res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
    }
    return
  }
  if (req.method === 'POST' && intentType === 'recordFounderCovenantOperatorReview') {
    try {
      await handleFounderCovenantOperatorReview(req, res, rawIntent)
    } catch {
      res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
    }
    return
  }

  const auth = readAuth(req)
  if (!auth) {
    res.status(400).json({ ok: false, error: 'Missing citizen credentials.' })
    return
  }

  try {
    const citizen = await verifyCitizen(auth.citizenId, auth.token, { includeRecord: intentType === 'claimArea' })
    if (!citizen) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    const existing = await readAreaState(citizen.citizenId)
    if (req.method === 'GET') {
      const state = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, new Date()) : null
      res.status(200).json({ ok: true, ...areaPayload(state), founderNumber: citizen.founderNumber })
      return
    }

    if (citizen.founderNumber <= 0) {
      res.status(403).json({ ok: false, error: 'Founder seat required.', code: 'founder_required' })
      return
    }

    if (isDisabledSettlementIntentType(intentType)) {
      res.status(disabledSettlementStatus()).json({
        ok: false,
        error: disabledSettlementMessage(),
        code: 'settlement_disabled',
        ...areaPayload(existing),
      })
      return
    }

    if (isDisabledEstateProtectionIntentType(intentType)) {
      res.status(disabledEstateProtectionStatus()).json({
        ok: false,
        error: disabledEstateProtectionMessage(),
        code: 'estate_protection_disabled',
        ...areaPayload(existing),
      })
      return
    }

    if (intentType === 'claimArea') {
      if (existing) {
        const state = await catchUpPersistedAreaState(citizen.citizenId, existing, new Date())
        res.status(409).json({
          ok: false,
          error: 'Area already claimed.',
          code: 'area_already_claimed',
          ...areaPayload(state),
        })
        return
      }

      const intent = normalizeClaimAreaIntent(rawIntent)
      if (!intent.ok) {
        res.status(intent.error === 'unsupported_intent' ? 400 : 422).json({
          ok: false,
          error: 'Invalid area claim intent.',
          code: intent.error,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, buildFounderAreaState(citizen, intent, new Date()), false)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'buildBusiness') {
      const intent = normalizeBuildBusinessIntent(rawIntent)
      if (!intent.ok) {
        res.status(buildBusinessStatus(intent.error)).json({
          ok: false,
          error: buildBusinessMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForBuild = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyBuildBusinessIntent(stateForBuild, { type: 'buildBusiness', ...intent }, now)
      if (!result.ok) {
        res.status(buildBusinessStatus(result.error)).json({
          ok: false,
          error: buildBusinessMessage(result.error),
          code: result.error,
          state: stateForBuild,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (isServicePurchaseIntentType(intentType)) {
      const intent = normalizeServicePurchaseIntent(rawIntent)
      if (!intent.ok) {
        res.status(servicePurchaseStatus(intent.error)).json({
          ok: false,
          error: servicePurchaseMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForService = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyServicePurchaseIntent(stateForService, { type: intent.type }, now)
      if (!result.ok) {
        res.status(servicePurchaseStatus(result.error)).json({
          ok: false,
          error: servicePurchaseMessage(result.error),
          code: result.error,
          state: stateForService,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'buyInsurance') {
      const intent = normalizeBuyInsuranceIntent(rawIntent)
      if (!intent.ok) {
        res.status(buyInsuranceStatus(intent.error)).json({
          ok: false,
          error: buyInsuranceMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForInsurance = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyBuyInsuranceIntent(
        stateForInsurance,
        { type: 'buyInsurance', insuranceBusinessId: intent.insuranceBusinessId },
        now,
      )
      if (!result.ok) {
        res.status(buyInsuranceStatus(result.error)).json({
          ok: false,
          error: buyInsuranceMessage(result.error),
          code: result.error,
          state: stateForInsurance,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'hireWorker') {
      const intent = normalizeHireWorkerIntent(rawIntent)
      if (!intent.ok) {
        res.status(hireWorkerStatus(intent.error)).json({
          ok: false,
          error: hireWorkerMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForHire = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyHireWorkerIntent(
        stateForHire,
        { type: 'hireWorker', businessId: intent.businessId, workerCitizenId: intent.workerCitizenId },
        now,
      )
      if (!result.ok) {
        res.status(hireWorkerStatus(result.error)).json({
          ok: false,
          error: hireWorkerMessage(result.error),
          code: result.error,
          state: stateForHire,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'refreshArea') {
      const intent = normalizeRefreshAreaIntent(rawIntent)
      if (!intent.ok) {
        res.status(refreshAreaStatus(intent.error)).json({
          ok: false,
          error: refreshAreaMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const state = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, new Date()) : null
      if (!state) {
        res.status(refreshAreaStatus('area_not_claimed')).json({
          ok: false,
          error: refreshAreaMessage('area_not_claimed'),
          code: 'area_not_claimed',
          state,
        })
        return
      }

      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'advanceHour') {
      if (!hasServerClockAuthority(req)) {
        res.status(advanceHourStatus('server_clock_unauthorized')).json({
          ok: false,
          error: advanceHourMessage('server_clock_unauthorized'),
          code: 'server_clock_unauthorized',
          state: existing,
        })
        return
      }

      const result = applyAdvanceHourIntent(existing, rawIntent, new Date())
      if (!result.ok) {
        res.status(advanceHourStatus(result.error)).json({
          ok: false,
          error: advanceHourMessage(result.error),
          code: result.error,
          state: existing,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'repayDebt') {
      const intent = normalizeRepayDebtIntent(rawIntent)
      if (!intent.ok) {
        res.status(repayDebtStatus(intent.error)).json({
          ok: false,
          error: repayDebtMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForRepayment = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyRepayDebtIntent(
        stateForRepayment,
        { type: 'repayDebt', debtId: intent.debtId, amount: intent.amount },
        now,
      )
      if (!result.ok) {
        res.status(repayDebtStatus(result.error)).json({
          ok: false,
          error: repayDebtMessage(result.error),
          code: result.error,
          state: stateForRepayment,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    if (intentType === 'recordCovenantReview') {
      const intent = normalizeRecordCovenantReviewIntent(rawIntent)
      if (!intent.ok) {
        res.status(recordCovenantReviewStatus(intent.error)).json({
          ok: false,
          error: recordCovenantReviewMessage(intent.error),
          code: intent.error,
          state: existing,
        })
        return
      }
      if (intent.actionKind !== 'record_review') {
        res.status(recordCovenantReviewStatus('review_action_disabled')).json({
          ok: false,
          error: recordCovenantReviewMessage('review_action_disabled'),
          code: 'review_action_disabled',
          state: existing,
        })
        return
      }

      const now = new Date()
      const stateForReview = existing ? await catchUpPersistedAreaState(citizen.citizenId, existing, now) : null
      const result = applyRecordCovenantReviewIntent(
        stateForReview,
        {
          type: 'recordCovenantReview',
          actionKind: intent.actionKind,
          note: intent.note,
          evidenceKinds: intent.evidenceKinds,
        },
        now,
        citizen.citizenId,
      )
      if (!result.ok) {
        res.status(recordCovenantReviewStatus(result.error)).json({
          ok: false,
          error: recordCovenantReviewMessage(result.error),
          code: result.error,
          state: stateForReview,
        })
        return
      }

      const state = await persistAreaState(citizen.citizenId, result.state, true)
      res.status(200).json({ ok: true, ...areaPayload(state) })
      return
    }

    res.status(400).json({ ok: false, error: 'Unsupported area intent.', code: 'unsupported_intent' })
  } catch {
    res.status(500).json({ ok: false, error: 'Reality area authority is briefly unavailable.' })
  }
}

function applyBuildBusinessIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyBuildBusinessError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeBuildBusinessIntent(input)
  if (!intent.ok) return intent
  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!founder || founder.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }
  if (state.businesses.some((business) => business.id === intent.businessId)) {
    return { ok: false, error: 'business_id_taken' }
  }
  const licenseSlots = licenseSlotsForPopulation(activePopulation(state), intent.businessKind)
  if (state.businesses.filter((business) => business.kind === intent.businessKind).length >= licenseSlots) {
    return { ok: false, error: 'business_saturated' }
  }

  const blueprint = BUSINESS_BLUEPRINTS[intent.businessKind]
  if (state.balance < blueprint.buildCost) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const business: FounderAreaBusiness = {
    id: intent.businessId,
    name: intent.name,
    kind: intent.businessKind,
    ownerId: state.founderCitizenId,
    cash: 0,
    price: blueprint.price,
    wagePerHour: blueprint.wagePerHour,
    quality: 1,
    staffCitizenIds: [],
    createdAt: at,
    createdBy: state.founderCitizenId,
  }
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:business-build:${intent.businessId}`,
    at,
    kind: 'business_build',
    payoutEligibility: 'game_only',
    fromId: state.founderCitizenId,
    toId: BUILDER_RECEIVER_ID,
    amount: blueprint.buildCost,
    memo: `${intent.name} built as a ${intent.businessKind} business.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - blueprint.buildCost),
      businesses: [...state.businesses, business],
      citizens: setFounderCitizenMoney(state, roundMoney(state.balance - blueprint.buildCost)),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyHireWorkerIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyHireWorkerError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeHireWorkerIntent(input)
  if (!intent.ok) return intent

  const founder = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!founder || founder.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const business = state.businesses.find((candidate) => candidate.id === intent.businessId)
  if (!business) return { ok: false, error: 'business_not_found' }
  const worker = state.citizens.find((citizen) => citizen.id === intent.workerCitizenId)
  if (!worker) return { ok: false, error: 'worker_not_found' }
  if (worker.kind !== 'sim') return { ok: false, error: 'real_worker_requires_acceptance' }
  if (worker.state.kind !== 'active' || (worker.jobBusinessId && worker.jobBusinessId !== business.id)) {
    return { ok: false, error: 'worker_unavailable' }
  }
  const staffCitizenIds = business.staffCitizenIds ?? []
  if (staffCitizenIds.includes(intent.workerCitizenId)) return { ok: false, error: 'worker_already_hired' }
  if (state.businesses.some((candidate) => (candidate.staffCitizenIds ?? []).includes(intent.workerCitizenId))) {
    return { ok: false, error: 'worker_already_hired' }
  }
  if (staffCitizenIds.length >= TARGET_STAFF_BY_KIND[business.kind]) {
    return { ok: false, error: 'business_fully_staffed' }
  }

  return {
    ok: true,
    state: {
      ...state,
      businesses: state.businesses.map((candidate) =>
        candidate.id === intent.businessId
          ? { ...candidate, staffCitizenIds: [...staffCitizenIds, intent.workerCitizenId] }
          : candidate
      ),
      citizens: state.citizens.map((candidate) =>
        candidate.id === intent.workerCitizenId ? { ...candidate, jobBusinessId: intent.businessId } : candidate
      ),
      updatedAt: now.toISOString(),
    },
  }
}

function applyAdvanceHourIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyAdvanceHourError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeAdvanceHourIntent(input)
  if (!intent.ok) return intent
  const caughtUp = catchUpAreaClock(state, now)
  return caughtUp ? { ok: true, state: caughtUp } : { ok: false, error: 'clock_not_ready' }
}

function catchUpAreaClock(state: FounderAreaState, now: Date): FounderAreaState | null {
  const tickDates = areaClockTickDates(state, now)
  if (tickDates.length === 0) return null

  const transactions: FounderAreaTransaction[] = []
  const areaEvents: FounderAreaEvent[] = []
  const citizens = state.citizens.map(cloneCitizen)
  const businesses = state.businesses.map((business) => ({ ...business, staffCitizenIds: [...business.staffCitizenIds] }))
  for (const tickNow of tickDates) {
    applyAreaHourTick(state.areaId, state.founderCitizenId, citizens, businesses, tickNow, transactions, areaEvents)
  }
  const founder = citizens.find((citizen) => citizen.id === state.founderCitizenId)
  const balance = founder ? roundMoney(founder.money) : state.balance
  const updatedAt = tickDates.at(-1)?.toISOString() ?? state.updatedAt
  const existingAreaEvents = normalizeFounderAreaEvents(state.areaEvents)

  return withFounderCovenantReview({
    ...state,
    balance,
    businesses,
    citizens,
    transactions: [...state.transactions, ...transactions],
    areaEvents: [...existingAreaEvents, ...areaEvents],
    updatedAt,
  })
}

function applyAreaHourTick(
  areaId: string,
  founderCitizenId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  transactions: FounderAreaTransaction[],
  areaEvents: FounderAreaEvent[],
): void {
  const at = now.toISOString()
  renewInsurancePolicies(areaId, citizens, businesses, now, at, transactions)
  applyFounderHour(areaId, founderCitizenId, citizens, businesses, now, at, transactions)
  degradeUnmanagedBusinesses(citizens, businesses)
  applySimCitizenHour(areaId, citizens, businesses, now, at, transactions, areaEvents)
  for (const business of businesses) {
    let cash = business.cash
    const paidWorkerIds: string[] = []
    for (const workerId of business.staffCitizenIds ?? []) {
      const worker = citizens.find((citizen) => citizen.id === workerId)
      if (!worker || worker.state.kind !== 'active' || worker.jobBusinessId !== business.id) continue
      if (cash < business.wagePerHour) break
      cash = roundMoney(cash - business.wagePerHour)
      worker.money = roundMoney(worker.money + business.wagePerHour)
      paidWorkerIds.push(workerId)
      transactions.push({
        id: `${areaId}:${now.getTime()}:worker-wage:${business.id}:${workerId}:${paidWorkerIds.length}`,
        at,
        kind: 'worker_wage',
        payoutEligibility: 'game_only',
        fromId: business.id,
        toId: workerId,
        amount: business.wagePerHour,
        memo: `${business.name} paid ${workerId} for one hour of work.`,
      })
    }
    business.cash = cash
  }
}

function areaClockTickDates(state: FounderAreaState, now: Date): Date[] {
  const updatedMs = Date.parse(state.updatedAt)
  if (!Number.isFinite(updatedMs)) return [now]
  const elapsedMs = now.getTime() - updatedMs
  if (elapsedMs < SERVER_AREA_TICK_MS) return []
  const tickCount = Math.min(MAX_SERVER_AREA_CATCH_UP_HOURS, Math.floor(elapsedMs / SERVER_AREA_TICK_MS))
  return Array.from({ length: tickCount }, (_, index) => new Date(updatedMs + (index + 1) * SERVER_AREA_TICK_MS))
}

function applyServicePurchaseIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyServicePurchaseError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeServicePurchaseIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const business = chooseServiceBusiness(state, intent.serviceKind)
  if (!business) return { ok: false, error: 'service_not_available' }
  if (state.balance < business.price) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const nextBalance = roundMoney(state.balance - business.price)
  const serviceQuality = effectiveBusinessQuality(state.citizens, business)
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:customer-purchase:${intent.type}:${business.id}`,
    at,
    kind: 'customer_purchase',
    payoutEligibility: 'game_only',
    fromId: state.founderCitizenId,
    toId: business.id,
    amount: business.price,
    memo: `Founder bought ${intent.serviceKind} from ${business.name}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: nextBalance,
      businesses: state.businesses.map((candidate) =>
        candidate.id === business.id
          ? { ...candidate, cash: roundMoney(candidate.cash + business.price) }
          : candidate
      ),
      citizens: state.citizens.map((citizen) => {
        if (citizen.id !== actor.id) return citizen
        const nextCitizen = {
          ...citizen,
          money: nextBalance,
          needs: { ...citizen.needs },
          state: { ...citizen.state },
        }
        applyServiceEffect(nextCitizen, intent.serviceKind, serviceQuality)
        return nextCitizen
      }),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyBuyInsuranceIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyBuyInsuranceError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeBuyInsuranceIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const insurer = state.businesses.find((business) => business.id === intent.insuranceBusinessId)
  if (!insurer) return { ok: false, error: 'business_not_found' }
  if (insurer.kind !== 'insurance') return { ok: false, error: 'not_insurance_business' }

  const existingPolicyUntil = actor.insurancePaidUntil ? Date.parse(actor.insurancePaidUntil) : Number.NaN
  if (Number.isFinite(existingPolicyUntil) && existingPolicyUntil > now.getTime()) {
    return { ok: false, error: 'already_insured' }
  }
  if (state.balance < insurer.price) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const paidUntil = new Date(now.getTime() + INSURANCE_POLICY_PERIOD_MS).toISOString()
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:insurance-premium:${actor.id}:${insurer.id}`,
    at,
    kind: 'insurance_premium',
    payoutEligibility: 'game_only',
    fromId: actor.id,
    toId: insurer.id,
    amount: insurer.price,
    memo: `${actor.name} bought insurance from ${insurer.name}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - insurer.price),
      businesses: state.businesses.map((business) =>
        business.id === insurer.id ? { ...business, cash: roundMoney(business.cash + insurer.price) } : business
      ),
      citizens: state.citizens.map((citizen) =>
        citizen.id === actor.id
          ? {
            ...citizen,
            money: roundMoney(citizen.money - insurer.price),
            insuranceBusinessId: insurer.id,
            insurancePaidUntil: paidUntil,
          }
          : citizen
      ),
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyRepayDebtIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyRepayDebtError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeRepayDebtIntent(input)
  if (!intent.ok) return intent

  const actor = state.citizens.find((citizen) => citizen.id === state.founderCitizenId)
  if (!actor || actor.state.kind !== 'active') return { ok: false, error: 'actor_unavailable' }

  const debt = actor.debts?.find((candidate) => candidate.id === intent.debtId)
  if (!debt || debt.amount <= 0) return { ok: false, error: 'debt_not_found' }

  const payment = roundMoney(Math.min(intent.amount, debt.amount))
  if (payment <= 0) return { ok: false, error: 'invalid_debt_payment' }
  if (actor.money < payment) return { ok: false, error: 'insufficient_funds' }

  const at = now.toISOString()
  const nextDebtAmount = roundMoney(debt.amount - payment)
  const citizens = state.citizens.map((citizen) => {
    if (citizen.id !== actor.id) return citizen
    const nextDebts = (citizen.debts ?? [])
      .map((candidate) => candidate.id === debt.id ? { ...candidate, amount: nextDebtAmount } : candidate)
      .filter((candidate) => candidate.amount > 0)
    return {
      ...citizen,
      money: roundMoney(citizen.money - payment),
      debt: roundMoney(Math.max(0, citizen.debt - payment)),
      debts: nextDebts.length > 0 ? nextDebts : undefined,
    }
  })
  const businesses = state.businesses.map((business) =>
    business.id === debt.creditorId ? { ...business, cash: roundMoney(business.cash + payment) } : business
  )
  const transaction: FounderAreaTransaction = {
    id: `${state.areaId}:${now.getTime()}:debt-repayment:${actor.id}:${debt.id}`,
    at,
    kind: 'debt_repayment',
    payoutEligibility: 'game_only',
    fromId: actor.id,
    toId: debt.creditorId,
    amount: payment,
    memo: `${actor.name} repaid debt to ${debt.creditorId}.`,
  }

  return {
    ok: true,
    state: {
      ...state,
      balance: roundMoney(state.balance - payment),
      businesses,
      citizens,
      transactions: [...state.transactions, transaction],
      updatedAt: at,
    },
  }
}

function applyRecordCovenantReviewIntent(
  state: FounderAreaState | null,
  input: unknown,
  now: Date,
  reviewerId: string,
): { ok: true; state: FounderAreaState } | { ok: false; error: ApplyRecordCovenantReviewError } {
  if (!state) return { ok: false, error: 'area_not_claimed' }
  const intent = normalizeRecordCovenantReviewIntent(input)
  if (!intent.ok) return intent
  if (intent.actionKind !== 'record_review') return { ok: false, error: 'review_action_disabled' }

  const at = now.toISOString()
  const review = founderCovenantReview(state)
  const entry: FounderAreaCovenantReviewHistoryItem = {
    id: `${state.areaId}:${now.getTime()}:founder-review:${reviewerId}`,
    at,
    reviewerId,
    actionKind: intent.actionKind,
    summary: founderCovenantReviewSummary(review.activityReview, intent.note, intent.evidenceKinds),
    authorityGate: founderCovenantReviewEvidenceAuthority(),
    decision: {
      status: review.status,
      nextAction: review.nextAction,
      manualReviewRequired: review.manualReviewRequired,
    },
    signals: review.signals.map(founderCovenantSignalSnapshot),
    activityReview: { ...review.activityReview },
    reviewQueue: founderCovenantReviewQueueSnapshot(review.reviewQueue),
    reviewInputs: founderCovenantReviewInputsWithManualEvidence(review.reviewInputs, intent.evidenceKinds),
    stages: review.stages.map(founderCovenantStageSnapshot),
    reviewChecklist: review.reviewChecklist.map(founderCovenantReviewChecklistSnapshot),
    manualActions: review.manualActions.map(founderCovenantManualActionSnapshot),
    approvalRequests: review.approvalRequests.map(founderCovenantApprovalRequestSnapshot),
    reviewSchedule: { ...review.reviewSchedule },
  }

  return {
    ok: true,
    state: {
      ...state,
      founderReviewHistory: [...(state.founderReviewHistory ?? []), entry],
      updatedAt: at,
    },
  }
}

function applyFounderHour(
  areaId: string,
  founderCitizenId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  const founder = citizens.find((citizen) => citizen.id === founderCitizenId)
  if (!founder) return
  if (founder.state.kind === 'hospitalized') {
    recoverIfReady(founder, now)
    return
  }
  decayNeeds(founder)
  applyUnmetNeedHealthPenalty(founder)
  if (shouldHospitalize(founder)) {
    hospitalizeCitizen(areaId, founder, businesses, now, at, transactions)
  }
}

function renewInsurancePolicies(
  areaId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  let renewalSequence = 0
  for (const citizen of citizens) {
    if (!citizen.insuranceBusinessId || hasActiveInsurance(citizen, now)) continue
    const insurer = businesses.find((business) =>
      business.id === citizen.insuranceBusinessId && business.kind === 'insurance'
    )
    if (!insurer || citizen.money < insurer.price) {
      lapseInsurance(citizen)
      continue
    }

    const paidUntil = new Date(now.getTime() + INSURANCE_POLICY_PERIOD_MS).toISOString()
    citizen.money = roundMoney(citizen.money - insurer.price)
    citizen.insurancePaidUntil = paidUntil
    insurer.cash = roundMoney(insurer.cash + insurer.price)
    renewalSequence += 1
    transactions.push({
      id: `${areaId}:${now.getTime()}:insurance-renewal:${citizen.id}:${insurer.id}:${renewalSequence}`,
      at,
      kind: 'insurance_premium',
      payoutEligibility: 'game_only',
      fromId: citizen.id,
      toId: insurer.id,
      amount: insurer.price,
      memo: `${citizen.name} renewed insurance with ${insurer.name}.`,
    })
  }
}

function hasActiveInsurance(citizen: FounderAreaCitizen, now: Date): boolean {
  if (!citizen.insuranceBusinessId || !citizen.insurancePaidUntil) return false
  const paidUntilMs = Date.parse(citizen.insurancePaidUntil)
  return Number.isFinite(paidUntilMs) && paidUntilMs > now.getTime()
}

function lapseInsurance(citizen: FounderAreaCitizen): void {
  delete citizen.insuranceBusinessId
  delete citizen.insurancePaidUntil
}

function degradeUnmanagedBusinesses(citizens: FounderAreaCitizen[], businesses: FounderAreaBusiness[]): void {
  for (const business of businesses) {
    const owner = citizens.find((citizen) => citizen.id === business.ownerId)
    if (owner?.state.kind !== 'hospitalized' || activeStaffCount(citizens, business) > 0) continue
    business.quality = roundMoney(Math.max(
      MIN_BUSINESS_QUALITY,
      (business.quality ?? 1) - UNSTAFFED_HOSPITALIZED_OWNER_QUALITY_LOSS_PER_HOUR,
    ))
  }
}

function activeStaffCount(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  return (business.staffCitizenIds ?? [])
    .map((workerId) => citizens.find((citizen) => citizen.id === workerId))
    .filter((worker): worker is FounderAreaCitizen => worker?.state.kind === 'active' && worker.jobBusinessId === business.id)
    .length
}

function effectiveBusinessQuality(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  const owner = citizens.find((citizen) => citizen.id === business.ownerId)
  const unmanagedPenalty = owner?.state.kind === 'hospitalized' && activeStaffCount(citizens, business) === 0 ? 0.35 : 1
  return clampQuality((business.quality ?? 1) * unmanagedPenalty)
}

function applySimCitizenHour(
  areaId: string,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
  areaEvents: FounderAreaEvent[],
): void {
  let purchaseSequence = 0
  const capacityUsed = new Map<string, number>()
  const departingCitizenIds = new Set<string>()
  for (const citizen of citizens) {
    if (citizen.kind !== 'sim') continue
    if (citizen.state.kind === 'hospitalized') {
      recoverIfReady(citizen, now)
      continue
    }
    decayNeeds(citizen)
    for (const serviceKind of serviceNeedsForCitizen(citizen)) {
      const business = chooseAvailableServiceBusiness(businesses, serviceKind, citizens, capacityUsed)
      if (!business || citizen.money < business.price) continue
      citizen.money = roundMoney(citizen.money - business.price)
      business.cash = roundMoney(business.cash + business.price)
      applyServiceEffect(citizen, serviceKind, effectiveBusinessQuality(citizens, business))
      reserveServiceCapacity(capacityUsed, business)
      purchaseSequence += 1
      transactions.push({
        id: `${areaId}:${now.getTime()}:sim-purchase:${citizen.id}:${serviceKind}:${business.id}:${purchaseSequence}`,
        at,
        kind: 'customer_purchase',
        payoutEligibility: 'game_only',
        fromId: citizen.id,
        toId: business.id,
        amount: business.price,
        memo: `${citizen.name} bought ${serviceKind} from ${business.name}.`,
      })
    }
    applyUnmetNeedHealthPenalty(citizen)
    const departureReason = simCitizenDepartureReason(citizen, citizens, businesses, capacityUsed)
    if (departureReason) {
      departingCitizenIds.add(citizen.id)
      areaEvents.push(simCitizenDepartureEvent(areaId, citizen, now, at, departureReason))
      continue
    }
    if (shouldHospitalize(citizen)) {
      hospitalizeCitizen(areaId, citizen, businesses, now, at, transactions)
    }
  }
  removeDepartingSimCitizens(citizens, businesses, departingCitizenIds)
}

function simCitizenDepartureReason(
  citizen: FounderAreaCitizen,
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  capacityUsed: Map<string, number>,
): FounderAreaDepartureReason | null {
  if (citizen.kind !== 'sim' || citizen.state.kind !== 'active') return null
  if (businesses.some((business) => business.ownerId === citizen.id)) return null
  if (citizen.health > SIM_LEAVES_HEALTH) return null
  if (
    citizen.needs.hydration <= SIM_LEAVES_NEED_LEVEL &&
    !hasRemainingServiceCapacity(citizens, businesses, 'water', capacityUsed)
  ) {
    return 'water_unserved'
  }
  if (
    citizen.needs.hunger <= SIM_LEAVES_NEED_LEVEL &&
    !hasRemainingServiceCapacity(citizens, businesses, 'food', capacityUsed)
  ) {
    return 'food_unserved'
  }
  if (
    citizen.needs.energy <= SIM_LEAVES_NEED_LEVEL &&
    !hasRemainingServiceCapacity(citizens, businesses, 'housing', capacityUsed)
  ) {
    return 'housing_unserved'
  }
  return null
}

function hasRemainingServiceCapacity(
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
  capacityUsed: Map<string, number>,
): boolean {
  return businesses.some((business) =>
    business.kind === kind &&
    hourlyServiceCapacity(citizens, business) > (capacityUsed.get(business.id) ?? 0)
  )
}

function simCitizenDepartureEvent(
  areaId: string,
  citizen: FounderAreaCitizen,
  now: Date,
  at: string,
  reason: FounderAreaDepartureReason,
): FounderAreaEvent {
  const serviceKind = departureReasonServiceKind(reason)
  return {
    id: `${areaId}:${now.getTime()}:sim-departure:${citizen.id}:${serviceKind}`,
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

function departureReasonServiceKind(reason: FounderAreaDepartureReason): FounderAreaDepartureServiceKind {
  switch (reason) {
    case 'water_unserved':
      return 'water'
    case 'food_unserved':
      return 'food'
    case 'housing_unserved':
      return 'housing'
  }
}

function removeDepartingSimCitizens(
  citizens: FounderAreaCitizen[],
  businesses: FounderAreaBusiness[],
  citizenIds: Set<string>,
): void {
  if (citizenIds.size === 0) return
  for (let index = citizens.length - 1; index >= 0; index -= 1) {
    if (citizenIds.has(citizens[index].id)) citizens.splice(index, 1)
  }
  for (const business of businesses) {
    business.staffCitizenIds = business.staffCitizenIds.filter((citizenId) => !citizenIds.has(citizenId))
  }
}

function chooseAvailableServiceBusiness(
  businesses: FounderAreaBusiness[],
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
  citizens: FounderAreaCitizen[],
  capacityUsed: Map<string, number>,
): FounderAreaBusiness | null {
  const candidates = businesses
    .filter((business) => business.kind === kind)
    .filter((business) => hourlyServiceCapacity(citizens, business) > (capacityUsed.get(business.id) ?? 0))
    .sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

function reserveServiceCapacity(capacityUsed: Map<string, number>, business: FounderAreaBusiness): void {
  capacityUsed.set(business.id, (capacityUsed.get(business.id) ?? 0) + 1)
}

function hourlyServiceCapacity(citizens: FounderAreaCitizen[], business: FounderAreaBusiness): number {
  const activeStaff = activeStaffCount(citizens, business)
  const staffMultiplier = activeStaff === 0 ? 1 : 1 + activeStaff * STAFF_CAPACITY_MULTIPLIER
  return Math.floor(BASE_SERVICE_CAPACITY_PER_HOUR[business.kind] * staffMultiplier * effectiveBusinessQuality(citizens, business))
}

function cloneCitizen(citizen: FounderAreaCitizen): FounderAreaCitizen {
  return {
    ...citizen,
    debts: citizen.debts?.map((debt) => ({ ...debt })),
    needs: { ...citizen.needs },
    state: { ...citizen.state },
  }
}

function decayNeeds(citizen: FounderAreaCitizen): void {
  citizen.needs = {
    hunger: clampNeed(citizen.needs.hunger - NEED_DECAY_PER_HOUR.hunger),
    hydration: clampNeed(citizen.needs.hydration - NEED_DECAY_PER_HOUR.hydration),
    energy: clampNeed(citizen.needs.energy - NEED_DECAY_PER_HOUR.energy),
    hygiene: clampNeed(citizen.needs.hygiene - NEED_DECAY_PER_HOUR.hygiene),
    fun: clampNeed(citizen.needs.fun - NEED_DECAY_PER_HOUR.fun),
  }
}

function applyUnmetNeedHealthPenalty(citizen: FounderAreaCitizen): void {
  const criticalNeeds = [
    citizen.needs.hydration <= 0,
    citizen.needs.hunger <= 0,
    citizen.needs.energy <= 0,
  ].filter(Boolean).length
  if (criticalNeeds === 0) return
  citizen.health = clampNeed(citizen.health - criticalNeeds * 15)
}

function shouldHospitalize(citizen: FounderAreaCitizen): boolean {
  return citizen.health <= COLLAPSE_HEALTH || citizen.needs.hydration <= 0 || citizen.needs.hunger <= 0
}

function recoverIfReady(citizen: FounderAreaCitizen, now: Date): boolean {
  if (citizen.state.kind !== 'hospitalized') return false
  const untilMs = Date.parse(citizen.state.until)
  if (Number.isFinite(untilMs) && untilMs > now.getTime()) return false
  citizen.state = { kind: 'active' }
  citizen.health = Math.max(citizen.health, RECOVERY_HEALTH)
  citizen.needs = {
    ...citizen.needs,
    hunger: Math.max(citizen.needs.hunger, 45),
    hydration: Math.max(citizen.needs.hydration, 45),
    energy: Math.max(citizen.needs.energy, 35),
  }
  return true
}

function hospitalizeCitizen(
  areaId: string,
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): void {
  citizen.health = Math.max(citizen.health, 30)
  const insurancePaid = settleHospitalBill(areaId, citizen, businesses, now, at, transactions)
  const recoveryHours = insurancePaid ? INSURED_HOSPITALIZATION_HOURS : HOSPITALIZATION_HOURS
  const until = new Date(now.getTime() + recoveryHours * 3_600_000).toISOString()
  citizen.state = { kind: 'hospitalized', until }
}

function settleHospitalBill(
  areaId: string,
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
  at: string,
  transactions: FounderAreaTransaction[],
): boolean {
  const clinic = chooseServiceBusinessFromBusinesses(businesses, 'clinic')
  const receiverId = clinic?.id ?? SYSTEM_HOSPITAL_ACCOUNT_ID
  let remaining = HOSPITAL_BILL
  let insurancePaid = false

  const insurer = activeInsuranceBusiness(citizen, businesses, now)
  if (insurer) {
    const coverage = roundMoney(Math.min(HOSPITAL_BILL * INSURANCE_COVERAGE, insurer.cash))
    if (coverage > 0) {
      insurancePaid = true
      insurer.cash = roundMoney(insurer.cash - coverage)
      if (clinic) clinic.cash = roundMoney(clinic.cash + coverage)
      remaining = roundMoney(remaining - coverage)
      transactions.push({
        id: `${areaId}:${now.getTime()}:insurance-payout:${insurer.id}:${citizen.id}`,
        at,
        kind: 'insurance_payout',
        payoutEligibility: 'game_only',
        fromId: insurer.id,
        toId: receiverId,
        amount: coverage,
        memo: `${insurer.name} covered part of ${citizen.name}'s hospital bill.`,
      })
    }
  }

  const paid = roundMoney(Math.min(remaining, citizen.money))
  if (paid > 0) {
    citizen.money = roundMoney(citizen.money - paid)
    if (clinic) clinic.cash = roundMoney(clinic.cash + paid)
    remaining = roundMoney(remaining - paid)
    transactions.push({
      id: `${areaId}:${now.getTime()}:hospital-bill:${citizen.id}`,
      at,
      kind: 'hospital_bill',
      payoutEligibility: 'game_only',
      fromId: citizen.id,
      toId: receiverId,
      amount: paid,
      memo: `${citizen.name} paid a hospital bill.`,
    })
  }

  if (remaining <= 0) return insurancePaid
  citizen.debt = roundMoney(citizen.debt + remaining)
  const debt: FounderAreaDebt = {
    id: `${citizen.id}:${now.getTime()}:${(citizen.debts?.length ?? 0) + 1}:medical`,
    kind: 'medical',
    creditorId: receiverId,
    amount: remaining,
    issuedAt: at,
    memo: `${citizen.name} owes medical debt to ${receiverId}.`,
  }
  citizen.debts = [...(citizen.debts ?? []), debt]
  transactions.push({
    id: `${areaId}:${now.getTime()}:medical-debt:${citizen.id}`,
    at,
    kind: 'medical_debt',
    payoutEligibility: 'game_only',
    fromId: citizen.id,
    toId: receiverId,
    amount: remaining,
    memo: `${citizen.name} left the hospital bill as medical debt.`,
  })
  return insurancePaid
}

function activeInsuranceBusiness(
  citizen: FounderAreaCitizen,
  businesses: FounderAreaBusiness[],
  now: Date,
): FounderAreaBusiness | null {
  if (!citizen.insuranceBusinessId || !citizen.insurancePaidUntil) return null
  const paidUntilMs = Date.parse(citizen.insurancePaidUntil)
  if (!Number.isFinite(paidUntilMs) || paidUntilMs <= now.getTime()) return null
  return businesses.find((business) =>
    business.id === citizen.insuranceBusinessId && business.kind === 'insurance'
  ) ?? null
}

function serviceNeedsForCitizen(citizen: FounderAreaCitizen): Exclude<FounderAreaBusinessKind, 'insurance'>[] {
  const services: Exclude<FounderAreaBusinessKind, 'insurance'>[] = []
  if (citizen.needs.hydration < NEED_PURCHASE_THRESHOLD) services.push('water')
  if (citizen.needs.hunger < NEED_PURCHASE_THRESHOLD) services.push('food')
  if (citizen.needs.energy < NEED_PURCHASE_THRESHOLD) services.push('housing')
  if (citizen.health < HEALTH_PURCHASE_THRESHOLD) services.push('clinic')
  return services
}

function applyServiceEffect(
  citizen: FounderAreaCitizen,
  serviceKind: Exclude<FounderAreaBusinessKind, 'insurance'>,
  quality: number,
): void {
  const effect = SERVICE_EFFECTS[serviceKind]
  citizen.needs = {
    ...citizen.needs,
    hunger: effect.hunger === undefined ? citizen.needs.hunger : clampNeed(citizen.needs.hunger + effect.hunger * quality),
    hydration: effect.hydration === undefined ? citizen.needs.hydration : clampNeed(citizen.needs.hydration + effect.hydration * quality),
    energy: effect.energy === undefined ? citizen.needs.energy : clampNeed(citizen.needs.energy + effect.energy * quality),
    hygiene: effect.hygiene === undefined ? citizen.needs.hygiene : clampNeed(citizen.needs.hygiene + effect.hygiene * quality),
    fun: effect.fun === undefined ? citizen.needs.fun : clampNeed(citizen.needs.fun + effect.fun * quality),
  }
  if (effect.health !== undefined) citizen.health = clampNeed(citizen.health + effect.health * quality)
}

function chooseServiceBusiness(
  state: FounderAreaState,
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
): FounderAreaBusiness | null {
  return chooseServiceBusinessFromBusinesses(state.businesses, kind)
}

function chooseServiceBusinessFromBusinesses(
  businesses: FounderAreaBusiness[],
  kind: Exclude<FounderAreaBusinessKind, 'insurance'>,
): FounderAreaBusiness | null {
  const candidates = businesses
    .filter((business) => business.kind === kind)
    .sort((a, b) => a.price - b.price || a.createdAt.localeCompare(b.createdAt))
  return candidates[0] ?? null
}

function setFounderCitizenMoney(state: FounderAreaState, money: number): FounderAreaCitizen[] {
  return state.citizens.map((citizen) =>
    citizen.id === state.founderCitizenId ? { ...citizen, money } : citizen
  )
}

function servicePurchaseStatus(error: ApplyServicePurchaseError): number {
  if (error === 'area_not_claimed' || error === 'actor_unavailable' || error === 'service_not_available') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function servicePurchaseMessage(error: ApplyServicePurchaseError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before buying services.'
    case 'actor_unavailable':
      return 'Founder must be active before buying services.'
    case 'service_not_available':
      return 'No local business can serve that need yet.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this purchase.'
    default:
      return 'Invalid service purchase intent.'
  }
}

function buyInsuranceStatus(error: ApplyBuyInsuranceError): number {
  if (
    error === 'area_not_claimed' ||
    error === 'actor_unavailable' ||
    error === 'business_not_found' ||
    error === 'not_insurance_business' ||
    error === 'already_insured'
  ) {
    return 409
  }
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function buyInsuranceMessage(error: ApplyBuyInsuranceError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before buying insurance.'
    case 'actor_unavailable':
      return 'Founder must be active before buying insurance.'
    case 'business_not_found':
      return 'Insurance business must exist before buying a policy.'
    case 'not_insurance_business':
      return 'Selected business is not an insurance provider.'
    case 'already_insured':
      return 'Founder already has active insurance.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this insurance premium.'
    default:
      return 'Invalid buyInsurance intent.'
  }
}

function buildBusinessStatus(error: ApplyBuildBusinessError): number {
  if (error === 'area_not_claimed' || error === 'actor_unavailable') return 409
  if (error === 'business_id_taken' || error === 'business_saturated') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function buildBusinessMessage(error: ApplyBuildBusinessError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before building.'
    case 'actor_unavailable':
      return 'Founder must be active before building.'
    case 'business_id_taken':
      return 'Business id is already used in this area.'
    case 'business_saturated':
      return 'This business type has no open starter license.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this build.'
    default:
      return 'Invalid buildBusiness intent.'
  }
}

function hireWorkerStatus(error: ApplyHireWorkerError): number {
  if (
    error === 'area_not_claimed' ||
    error === 'actor_unavailable' ||
    error === 'business_not_found' ||
    error === 'business_fully_staffed' ||
    error === 'worker_already_hired' ||
    error === 'worker_not_found' ||
    error === 'worker_unavailable' ||
    error === 'real_worker_requires_acceptance'
  ) {
    return 409
  }
  return error === 'unsupported_intent' ? 400 : 422
}

function hireWorkerMessage(error: ApplyHireWorkerError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before hiring workers.'
    case 'actor_unavailable':
      return 'Founder must be active before hiring workers.'
    case 'business_not_found':
      return 'Business must exist before hiring workers.'
    case 'business_fully_staffed':
      return 'Business already has its target staff.'
    case 'worker_already_hired':
      return 'Worker is already assigned to a local business.'
    case 'worker_not_found':
      return 'Worker must exist in the server-owned Sim Citizen roster.'
    case 'worker_unavailable':
      return 'Worker is not available for this job.'
    case 'real_worker_requires_acceptance':
      return 'Real workers must accept job offers themselves.'
    default:
      return 'Invalid hireWorker intent.'
  }
}

function refreshAreaStatus(error: ApplyRefreshAreaError): number {
  if (error === 'area_not_claimed') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function refreshAreaMessage(error: ApplyRefreshAreaError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before refreshing the server area.'
    default:
      return 'Invalid refreshArea intent.'
  }
}

function serverClockTickAreasStatus(error: ServerClockTickAreasError): number {
  if (error === 'server_clock_unauthorized') return 403
  return error === 'unsupported_intent' ? 400 : 422
}

function serverClockTickAreasMessage(error: ServerClockTickAreasError): string {
  switch (error) {
    case 'server_clock_unauthorized':
      return 'tickAreas is reserved for the server clock.'
    case 'invalid_limit':
      return 'Server clock area limit must be between 1 and 100.'
    case 'invalid_pages':
      return 'Server clock pages must be between 1 and 5.'
    case 'invalid_cursor':
      return 'Server clock cursor is invalid.'
    default:
      return 'Invalid tickAreas intent.'
  }
}

function founderCovenantReviewQueueStatus(error: FounderCovenantReviewQueueError): number {
  if (error === 'server_clock_unauthorized') return 403
  return error === 'unsupported_intent' ? 400 : 422
}

function founderCovenantReviewQueueMessage(error: FounderCovenantReviewQueueError): string {
  switch (error) {
    case 'server_clock_unauthorized':
      return 'Founder covenant review queue is reserved for server operators.'
    case 'invalid_limit':
      return 'Founder covenant review queue limit must be between 1 and 100.'
    case 'invalid_pages':
      return 'Founder covenant review queue pages must be between 1 and 5.'
    case 'invalid_cursor':
      return 'Founder covenant review queue cursor is invalid.'
    default:
      return 'Invalid founder covenant review queue intent.'
  }
}

function disabledSettlementStatus(): number {
  return 403
}

function disabledSettlementMessage(): string {
  return 'TON wallet connection, deposits, withdrawals, land reservations, and leases are disabled until server authority and compliance review are ready.'
}

function disabledEstateProtectionStatus(): number {
  return 403
}

function disabledEstateProtectionMessage(): string {
  return 'Estate protection, heir naming, estate transfer, and waitlist fallback are disabled until death and manual approval workflows are ready.'
}

function advanceHourStatus(error: ApplyAdvanceHourError): number {
  if (error === 'server_clock_unauthorized') return 403
  if (error === 'area_not_claimed' || error === 'clock_not_ready') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function advanceHourMessage(error: ApplyAdvanceHourError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before advancing the simulation.'
    case 'clock_not_ready':
      return 'Reality area can advance only after a real hour has elapsed.'
    case 'server_clock_unauthorized':
      return 'advanceHour is reserved for the server clock.'
    default:
      return 'Invalid advanceHour intent.'
  }
}

function repayDebtStatus(error: ApplyRepayDebtError): number {
  if (error === 'area_not_claimed' || error === 'actor_unavailable' || error === 'debt_not_found') return 409
  if (error === 'insufficient_funds') return 402
  return error === 'unsupported_intent' ? 400 : 422
}

function repayDebtMessage(error: ApplyRepayDebtError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before repaying debt.'
    case 'actor_unavailable':
      return 'Founder must be active before repaying debt.'
    case 'debt_not_found':
      return 'Debt must exist on the server before repayment.'
    case 'insufficient_funds':
      return 'Founder balance is too low for this debt repayment.'
    default:
      return 'Invalid repayDebt intent.'
  }
}

function recordCovenantReviewStatus(error: ApplyRecordCovenantReviewError): number {
  if (error === 'area_not_claimed' || error === 'review_action_disabled') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function recordCovenantReviewMessage(error: ApplyRecordCovenantReviewError): string {
  switch (error) {
    case 'area_not_claimed':
      return 'Area must be claimed before recording founder review evidence.'
    case 'review_action_disabled':
      return 'Founder warning, probation, and replacement actions are disabled until manual approval workflow is ready.'
    default:
      return 'Invalid founder covenant review intent.'
  }
}

function operatorRecordCovenantReviewStatus(error: ApplyOperatorRecordCovenantReviewError): number {
  if (error === 'operator_unauthorized') return 403
  if (error === 'area_not_claimed' || error === 'area_mismatch' || error === 'review_action_disabled') return 409
  return error === 'unsupported_intent' ? 400 : 422
}

function operatorRecordCovenantReviewMessage(error: ApplyOperatorRecordCovenantReviewError): string {
  switch (error) {
    case 'operator_unauthorized':
      return 'Founder covenant operator review requires a valid operator token.'
    case 'area_mismatch':
      return 'Founder covenant review target does not match the stored founder area.'
    case 'invalid_founder_identity':
      return 'Founder covenant review target founder is invalid.'
    case 'invalid_area_identity':
      return 'Founder covenant review target area is invalid.'
    default:
      return recordCovenantReviewMessage(error)
  }
}

function readAuth(req: VercelRequest): { citizenId: string; token: string } | null {
  const source = req.method === 'GET' ? req.query : req.body
  const citizenId = field(source, 'citizenId')
  const token = field(source, 'token')
  return citizenId && token ? { citizenId, token } : null
}

function readServerClockOrBodyIntent(req: VercelRequest): unknown {
  if (req.method === 'GET' && field(req.query, 'clock') === 'tickAreas') {
    const limit = field(req.query, 'limit')
    const pages = field(req.query, 'pages')
    const cursor = field(req.query, 'cursor')
    return {
      type: 'tickAreas',
      ...(limit ? { limit: Number(limit) } : {}),
      ...(pages ? { pages: Number(pages) } : {}),
      ...(cursor ? { cursor } : {}),
    }
  }
  if (req.method === 'GET' && field(req.query, 'review') === 'founderCovenantQueue') {
    const limit = field(req.query, 'limit')
    const pages = field(req.query, 'pages')
    const cursor = field(req.query, 'cursor')
    return {
      type: 'founderCovenantReviewQueue',
      ...(limit ? { limit: Number(limit) } : {}),
      ...(pages ? { pages: Number(pages) } : {}),
      ...(cursor ? { cursor } : {}),
    }
  }
  return (req.body as { intent?: unknown } | undefined)?.intent
}

function hasServerClockAuthority(req: VercelRequest): boolean {
  const expected = process.env[SERVER_CLOCK_TOKEN_ENV]?.trim()
  if (!expected) return false

  const provided = header(req, SERVER_CLOCK_TOKEN_HEADER) ?? bearerToken(req)
  if (!provided) return false

  return tokenMatches(provided, expected)
}

function hasFounderCovenantReviewQueueAuthority(req: VercelRequest): boolean {
  if (hasServerClockAuthority(req)) return true
  return Boolean(founderCovenantOperatorClaims(req))
}

function founderCovenantOperatorClaims(req: VercelRequest): RealityOperatorQueueTokenClaims | null {
  const token = bearerToken(req)
  if (!token) return null
  const result = verifyRealityOperatorQueueToken(token, process.env[OPERATOR_AUTH_SECRET_ENV])
  return result.ok ? result.claims : null
}

function bearerToken(req: VercelRequest): string | null {
  const authorization = header(req, 'authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function header(req: VercelRequest, key: string): string | null {
  const headers = req.headers ?? {}
  const value = headers[key] ?? headers[key.toLowerCase()]
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0].trim() || null : null
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function tokenMatches(provided: string, expected: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedHash, expectedHash)
}

function field(source: unknown, key: string): string | null {
  if (!isRecord(source)) return null
  const value = source[key]
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null
  return typeof value === 'string' && value.trim() ? value : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isClaimSource(value: string): value is AreaClaimSource {
  return CLAIM_SOURCES.includes(value as AreaClaimSource)
}

function isBusinessKind(value: string): value is FounderAreaBusinessKind {
  return BUSINESS_KINDS.includes(value as FounderAreaBusinessKind)
}

function isServicePurchaseIntentType(value: unknown): value is ServicePurchaseIntentType {
  return typeof value === 'string' && value in SERVICE_PURCHASE_INTENTS
}

function isDisabledSettlementIntentType(value: unknown): value is DisabledSettlementIntentType {
  return typeof value === 'string' &&
    DISABLED_SETTLEMENT_INTENT_TYPES.includes(value as DisabledSettlementIntentType)
}

function isDisabledEstateProtectionIntentType(value: unknown): value is DisabledEstateProtectionIntentType {
  return typeof value === 'string' &&
    DISABLED_ESTATE_PROTECTION_INTENT_TYPES.includes(value as DisabledEstateProtectionIntentType)
}

function isFounderAreaCovenantManualActionKind(value: string): value is FounderAreaCovenantManualActionKind {
  return value === 'record_review' ||
    value === 'send_warning' ||
    value === 'start_probation' ||
    value === 'recommend_replacement'
}

function isFounderAreaCovenantManualEvidenceKind(value: string): value is FounderAreaCovenantManualEvidenceKind {
  return FOUNDER_COVENANT_MANUAL_EVIDENCE_KINDS.includes(value as FounderAreaCovenantManualEvidenceKind)
}

function isClientId(value: string): boolean {
  return /^[A-Za-z0-9:_-]{1,96}$/.test(value)
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function clampNeed(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value * 100) / 100
}

function clampQuality(value: number): number {
  if (value < 0.15) return 0.15
  if (value > 1.5) return 1.5
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFounderAreaState(value: unknown, citizenId: string): value is FounderAreaState {
  return isRecord(value) &&
    value.version === AREA_STATE_VERSION &&
    value.founderCitizenId === citizenId &&
    typeof value.areaId === 'string' &&
    typeof value.founderNumber === 'number' &&
    typeof value.balance === 'number' &&
    isRecord(value.claim) &&
    (value.claim.telegramUserId === undefined || typeof value.claim.telegramUserId === 'string') &&
    (value.claim.telegramAccountId === undefined || typeof value.claim.telegramAccountId === 'string') &&
    Array.isArray(value.businesses) &&
    Array.isArray(value.transactions) &&
    (value.areaEvents === undefined || Array.isArray(value.areaEvents))
}

function isFounderAreaEvent(value: unknown): value is FounderAreaEvent {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    value.kind === 'sim_citizen_departure' &&
    isFounderAreaEventSeverity(value.severity) &&
    typeof value.citizenId === 'string' &&
    typeof value.citizenName === 'string' &&
    typeof value.simulated === 'boolean' &&
    isFounderAreaDepartureReason(value.reason) &&
    isFounderAreaDepartureServiceKind(value.serviceKind) &&
    typeof value.health === 'number' &&
    isFounderAreaNeeds(value.needs) &&
    typeof value.message === 'string'
}

function isFounderAreaEventSeverity(value: unknown): value is FounderAreaEventSeverity {
  return value === 'info' || value === 'warning' || value === 'critical'
}

function isFounderAreaDepartureReason(value: unknown): value is FounderAreaDepartureReason {
  return value === 'water_unserved' || value === 'food_unserved' || value === 'housing_unserved'
}

function isFounderAreaDepartureServiceKind(value: unknown): value is FounderAreaDepartureServiceKind {
  return value === 'water' || value === 'food' || value === 'housing'
}

function isFounderAreaNeeds(value: unknown): value is FounderAreaNeeds {
  return isRecord(value) &&
    typeof value.hunger === 'number' &&
    typeof value.hydration === 'number' &&
    typeof value.energy === 'number' &&
    typeof value.hygiene === 'number' &&
    typeof value.fun === 'number'
}
