import type { Citizen } from '../game/types'
import type { FounderAreaProfile } from '../game/founderAreaSession'
import type {
  AreaBusinessAlert,
  AreaBusinessDashboard,
  AreaBusinessStatus,
  AreaCitizenDashboard,
  AreaDebtRepaymentBlocker,
  AreaEstateProtectionBlocker,
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
  WorldAreaEvent,
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
  payoutEligibility: WorldTransaction['payoutEligibility']
  fromId: string
  toId: string
  amount: number
  memo: string
}

export type RealityAreaEventSeverity = 'info' | 'warning' | 'critical'
export type RealityAreaDepartureReason = 'water_unserved' | 'food_unserved' | 'housing_unserved'
export type RealityAreaDepartureServiceKind = 'water' | 'food' | 'housing'

export interface RealityAreaEvent {
  id: string
  at: string
  kind: 'sim_citizen_departure'
  severity: RealityAreaEventSeverity
  citizenId: string
  citizenName: string
  simulated: boolean
  reason: RealityAreaDepartureReason
  serviceKind: RealityAreaDepartureServiceKind
  health: number
  needs: RealityAreaNeeds
  message: string
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
export type RealityAreaCovenantManualEvidenceKind =
  | 'population_growth'
  | 'external_contribution'
  | 'ideas_feedback'
export type RealityAreaCovenantSignalKind =
  | 'founder_unavailable'
  | 'no_business_built'
  | 'understaffed_businesses'
  | 'essential_shortage'
  | 'sim_departure'
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
  evidenceKinds?: RealityAreaCovenantManualEvidenceKind[]
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
  payoutClassification: RealityAreaLedgerPayoutClassificationDashboard
  recentTransactions: RealityAreaTransaction[]
}

export interface RealityAreaLedgerPayoutClassificationDashboard {
  gameOnlyTransactionCount: number
  gameOnlyAmount: number
  payoutEligibleTransactionCount: 0
  payoutEligibleAmount: 0
  manualPayoutReviewRequired: true
  realWithdrawalEligible: false
}

export interface RealityAreaEventDashboard extends RealityAreaEvent {
  displayName: string
  participantLabel: 'Sim Citizen' | 'Real Citizen'
  visualTone: 'simulated' | 'real'
}

export interface RealityAreaEventsDashboard {
  eventCount: number
  simDepartures: number
  warningEvents: number
  criticalEvents: number
  recentEvents: RealityAreaEventDashboard[]
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

export type RealityAreaPayoutReadinessBlocker =
  | 'game_credits_only'
  | 'payouts_disabled'
  | 'withdrawals_disabled'
  | 'kyc_disabled'
  | 'tax_profile_disabled'
  | 'manual_payout_review_required'
  | 'compliance_review_required'
  | 'ton_settlement_disabled'

export interface RealityAreaPayoutReadinessDashboard {
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
  blockers: RealityAreaPayoutReadinessBlocker[]
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

export type RealityAreaHandoffBlocker =
  | 'replacement_workflow_disabled'
  | 'waitlist_handoff_disabled'
  | 'candidate_selection_disabled'
  | 'main_founder_approval_required'
  | 'manual_review_required'

export interface RealityAreaHandoffTransferPackage {
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
  legacyTreasuryAccountId: 'system:founder-legacy-treasury'
}

export interface RealityAreaHandoffDashboard {
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
  transferPackage: RealityAreaHandoffTransferPackage
  blockers: RealityAreaHandoffBlocker[]
}

export type RealityAreaLandRightsBlocker =
  | 'land_reservations_disabled'
  | 'land_purchases_disabled'
  | 'leases_disabled'
  | 'rent_collection_disabled'
  | 'operator_acceptance_disabled'
  | 'manual_review_required'
  | 'compliance_review_required'

export interface RealityAreaLandLeaseTemplate {
  enabled: false
  termDays: 30
  fixedMonthlyRent: null
  rentCurrency: 'game_credits'
  payerCitizenId: null
  receiverCitizenId: string
  platformFeeRate: 0.05
  platformFeeReceiverId: 'system:reality-platform-fees'
  requiresOperator: true
  requiresDemand: true
}

export interface RealityAreaLandRightsDashboard {
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
  leaseTemplate: RealityAreaLandLeaseTemplate
  blockers: RealityAreaLandRightsBlocker[]
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

export type RealityAreaEstateProtectionBlocker = AreaEstateProtectionBlocker

export interface RealityAreaEstateProtectionDashboard {
  enabled: false
  namingEnabled: false
  transferEnabled: false
  waitlistFallbackEnabled: false
  manualReviewRequired: true
  namedHeirCitizenId: string | null
  namedHeirName: string | null
  protectedByInsurance: boolean
  status: 'disabled_until_death_enabled'
  blockers: RealityAreaEstateProtectionBlocker[]
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
  areaEvents: RealityAreaEventsDashboard
  growth: RealityAreaGrowthDashboard
  settlement: RealityAreaSettlementDashboard
  payoutReadiness: RealityAreaPayoutReadinessDashboard
  legacyRoyalty: RealityAreaLegacyRoyaltyDashboard
  handoff: RealityAreaHandoffDashboard
  landRights: RealityAreaLandRightsDashboard
  founderCovenant: RealityAreaCovenantReview
}

export type RealityFounderCovenantReviewQueueScanStatus = 'caught_up' | 'current' | 'invalid' | 'unavailable'

export interface RealityFounderCovenantReviewQueueSignalCounts {
  total: number
  info: number
  warning: number
  critical: number
}

export interface RealityFounderCovenantReviewQueueEconomicExposure {
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

export interface RealityFounderCovenantReviewQueueLatestReview {
  reviewedAt: string
  reviewerId: string
  actionKind: 'record_review'
  summary: string
  evidenceOnly: true
  automationEnabled: false
}

export type RealityFounderCovenantActivitySignalKey =
  | 'active'
  | 'useful'
  | 'building'
  | 'staffed'
  | 'indebted'
  | 'hospitalized'
  | 'at_risk'

export type RealityFounderCovenantActivitySignalStatus = 'met' | 'watch' | 'manual_review'

export interface RealityFounderCovenantActivitySignal {
  key: RealityFounderCovenantActivitySignalKey
  label: string
  value: boolean
  status: RealityFounderCovenantActivitySignalStatus
  summary: string
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
}

export type RealityFounderCovenantReviewReadinessStatus =
  | 'blocked'
  | 'needs_evidence'
  | 'overdue'
  | 'ready'
  | 'monitoring'

export interface RealityFounderCovenantReviewReadiness {
  status: RealityFounderCovenantReviewReadinessStatus
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

export interface RealityFounderCovenantReviewQueueItem {
  areaId: string
  areaLabel: string
  founderCitizenId: string
  founderNumber: number
  updatedAt: string
  checkedAt: string
  lastReviewAt: string | null
  reviewFreshness: 'never' | 'fresh' | 'stale'
  latestReview: RealityFounderCovenantReviewQueueLatestReview | null
  nextWeeklyReviewAt: string
  nextMonthlyReviewAt: string
  weeklyReviewDue: boolean
  monthlyReviewDue: boolean
  overdue: boolean
  covenantStatus: RealityAreaCovenantStatus
  nextAction: RealityAreaCovenantNextAction
  manualReviewRequired: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  activityReview: RealityAreaCovenantReview['activityReview']
  activitySignals: readonly RealityFounderCovenantActivitySignal[]
  reviewInputs: readonly RealityAreaCovenantReviewInput[]
  stages: readonly RealityAreaCovenantStage[]
  reviewReadiness: RealityFounderCovenantReviewReadiness
  reviewChecklist: readonly RealityAreaCovenantReviewChecklistItem[]
  manualActions: readonly RealityAreaCovenantManualAction[]
  economicExposure: RealityFounderCovenantReviewQueueEconomicExposure
  reviewQueue: RealityAreaCovenantReviewQueue
  signalCounts: RealityFounderCovenantReviewQueueSignalCounts
  signalKinds: RealityAreaCovenantSignalKind[]
  recommendedActionKinds: readonly RealityAreaCovenantManualActionKind[]
  pendingApprovalRequests: readonly RealityAreaCovenantApprovalRequest[]
  pendingApprovalKinds: readonly RealityAreaCovenantApprovalRequestKind[]
  pendingNotificationDrafts: readonly RealityAreaCovenantNotificationDraft[]
  pendingNotificationKinds: readonly RealityAreaCovenantNotificationDraftKind[]
  blockerCount: number
  scanStatus: RealityFounderCovenantReviewQueueScanStatus
  transactionsAdded: number
}

export interface RealityFounderCovenantReviewQueueScanResult {
  citizenId: string | null
  areaId: string | null
  status: RealityFounderCovenantReviewQueueScanStatus
  updatedAt: string | null
  transactionsAdded: number
}

export interface RealityFounderCovenantReviewQueueDashboard {
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
    manualReviewNeverReviewed: number
    manualReviewFreshReviewed: number
    manualReviewStaleReviewed: number
    signalWarningCount: number
    signalCriticalCount: number
    signalFlaggedFounders: number
    evidenceQueuedFounders: number
    evidenceRequiredGaps: number
    recordReadyFounders: number
    recordReadyWeekly: number
    recordReadyMonthly: number
    monitorFounders: number
    freshReviewedActiveFounders: number
    overdueCleanupFounders: number
    nextEvidenceFounders: number
    nextBlockedFounders: number
    nextOverdueFounders: number
    nextRecordFounders: number
    nextMonitorFounders: number
    lowScoreFounders: number
    inactiveFounders: number
    manualReviewQueueFounders: number
    probationRiskFounders: number
    replacementRiskFounders: number
    neverReviewed: number
    freshReviewed: number
    staleReviewed: number
    staleWeeklyDue: number
    staleMonthlyDue: number
    scanAnomalies: number
    weeklyDue: number
    monthlyDue: number
    warningApprovals: number
    probationApprovals: number
    replacementApprovals: number
    warningDrafts: number
    manualReviewDrafts: number
    overdue: number
    blockedApprovalFounders: number
    totalFounderCash: number
    totalOutstandingDebt: number
    totalBusinessCash: number
    unstaffedBusinesses: number
    insuredFounders: number
    pendingApprovals: number
    pendingNotifications: number
    blockers: number
  }
  items: RealityFounderCovenantReviewQueueItem[]
  results: RealityFounderCovenantReviewQueueScanResult[]
}

export type MergedRealityAreaDashboard = AreaNeedsDashboard & Pick<
  RealityAreaDashboard,
  | 'founderIdentity'
  | 'areaEvents'
  | 'growth'
  | 'settlement'
  | 'payoutReadiness'
  | 'legacyRoyalty'
  | 'handoff'
  | 'landRights'
>

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
  areaEvents?: RealityAreaEvent[]
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
  | { ok: false; reason: 'missing_identity' | 'not_founder' | 'invalid_request' | 'request_failed' | 'server_rejected'; error: string; code?: string }

export type RealityFounderCovenantReviewQueueResult =
  | { ok: true; founderCovenantReviewQueue: RealityFounderCovenantReviewQueueDashboard }
  | { ok: false; reason: 'missing_operator_token' | 'invalid_request' | 'request_failed' | 'server_rejected'; error: string; code?: string }

export interface RealityFounderCovenantReviewQueueRequest {
  serverClockToken?: string
  limit?: number
  pages?: number
  cursor?: string
}

export interface RealityFounderCovenantOperatorQueueRequest {
  operatorToken?: string
  limit?: number
  pages?: number
  cursor?: string
}

export interface RealityFounderCovenantOperatorReviewRequest {
  operatorToken?: string
  founderCitizenId: string
  areaId: string
  actionKind: 'record_review'
  note?: string
  evidenceKinds?: RealityAreaCovenantManualEvidenceKind[]
}

export type RealityFounderCovenantOperatorReviewResult =
  | { ok: true; state: RealityAreaState; dashboard?: RealityAreaDashboard }
  | { ok: false; reason: 'missing_operator_token' | 'invalid_request' | 'request_failed' | 'server_rejected'; error: string; code?: string }

const REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_LIMIT = 100
const REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_PAGES = 5
const REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH = 256

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
  const normalized = normalizeRealityAreaServerPayload(payload)
  if (!normalized.ok) {
    return {
      ok: false,
      reason: 'invalid_request',
      error: normalized.error,
      code: normalized.code,
    }
  }
  return applyRealityAreaPayload(citizen, normalized.payload, fetchImpl)
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

export async function readRealityFounderCovenantReviewQueue(
  request: RealityFounderCovenantReviewQueueRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityFounderCovenantReviewQueueResult> {
  const token = request.serverClockToken?.trim()
  if (!token) {
    return {
      ok: false,
      reason: 'missing_operator_token',
      error: 'Founder covenant review queue requires an operator token.',
      code: 'server_clock_unauthorized',
    }
  }
  if (
    request.limit !== undefined &&
    (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_LIMIT)
  ) {
    return {
      ok: false,
      reason: 'invalid_request',
      error: 'Founder covenant review queue limit must be between 1 and 100.',
      code: 'invalid_review_queue_limit',
    }
  }
  if (
    request.pages !== undefined &&
    (!Number.isInteger(request.pages) || request.pages < 1 || request.pages > REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_MAX_PAGES)
  ) {
    return {
      ok: false,
      reason: 'invalid_request',
      error: 'Founder covenant review queue pages must be between 1 and 5.',
      code: 'invalid_pages',
    }
  }
  const cursor = request.cursor?.trim()
  if (
    request.cursor !== undefined &&
    (!cursor || cursor.length > REALITY_FOUNDER_COVENANT_REVIEW_QUEUE_CURSOR_MAX_LENGTH || /[\r\n]/.test(cursor))
  ) {
    return {
      ok: false,
      reason: 'invalid_request',
      error: 'Founder covenant review queue cursor is invalid.',
      code: 'invalid_review_queue_cursor',
    }
  }

  const query = new URLSearchParams({ review: 'founderCovenantQueue' })
  if (request.limit !== undefined) query.set('limit', String(request.limit))
  if (request.pages !== undefined) query.set('pages', String(request.pages))
  if (cursor !== undefined) query.set('cursor', cursor)

  try {
    const response = await fetchImpl(`/api/reality-area?${query.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json() as Record<string, unknown>
    const queue = isRealityFounderCovenantReviewQueueDashboard(data.founderCovenantReviewQueue)
      ? data.founderCovenantReviewQueue
      : null
    if (response.ok && data.ok === true && queue) return { ok: true, founderCovenantReviewQueue: queue }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Founder covenant review queue was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
}

export async function readRealityFounderCovenantOperatorQueue(
  request: RealityFounderCovenantOperatorQueueRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityFounderCovenantReviewQueueResult> {
  const { operatorToken, ...scan } = request
  return readRealityFounderCovenantReviewQueue({
    ...scan,
    serverClockToken: operatorToken,
  }, fetchImpl)
}

export async function recordRealityFounderCovenantOperatorReview(
  request: RealityFounderCovenantOperatorReviewRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RealityFounderCovenantOperatorReviewResult> {
  const token = request.operatorToken?.trim()
  const founderCitizenId = request.founderCitizenId.trim()
  const areaId = request.areaId.trim()
  const note = request.note?.trim()
  if (!token) {
    return {
      ok: false,
      reason: 'missing_operator_token',
      error: 'Founder covenant review requires an operator token.',
      code: 'operator_unauthorized',
    }
  }
  if (!founderCitizenId || !areaId) {
    return {
      ok: false,
      reason: 'invalid_request',
      error: 'Founder covenant review requires a founder and area identity.',
      code: 'invalid_area_identity',
    }
  }

  try {
    const response = await fetchImpl('/api/reality-area', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: {
          type: 'recordFounderCovenantOperatorReview',
          founderCitizenId,
          areaId,
          actionKind: request.actionKind,
          ...(note ? { note } : {}),
          ...(request.evidenceKinds ? { evidenceKinds: request.evidenceKinds } : {}),
        },
      }),
    })
    const data = await response.json() as Record<string, unknown>
    const state = isRealityAreaState(data.state) ? data.state : null
    const dashboard = isRealityAreaDashboard(data.dashboard) ? data.dashboard : undefined
    if (response.ok && data.ok === true && state) return { ok: true, state, dashboard }
    return {
      ok: false,
      reason: 'server_rejected',
      error: typeof data.error === 'string' ? data.error : 'Founder covenant review was rejected.',
      code: typeof data.code === 'string' ? data.code : undefined,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality area server is unreachable.' }
  }
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

function normalizeRealityAreaServerPayload(
  payload: RealityAreaServerPayload,
): { ok: true; payload: RealityAreaServerPayload } | { ok: false; error: string; code: string } {
  switch (payload.type) {
    case 'buyWater':
    case 'buyFood':
    case 'buyHousing':
    case 'visitClinic':
      return { ok: true, payload }
    case 'buildBusiness': {
      const businessId = payload.businessId.trim()
      const name = payload.name?.trim()
      if (!businessId || (payload.name !== undefined && !name)) {
        return { ok: false, error: 'Founder area build intent is invalid.', code: 'invalid_intent_payload' }
      }
      return {
        ok: true,
        payload: {
          ...payload,
          businessId,
          ...(name ? { name } : {}),
        },
      }
    }
    case 'hireWorker': {
      const businessId = payload.businessId.trim()
      const workerCitizenId = payload.workerCitizenId.trim()
      if (!businessId || !workerCitizenId) {
        return { ok: false, error: 'Founder area hire intent is invalid.', code: 'invalid_intent_payload' }
      }
      return {
        ok: true,
        payload: {
          ...payload,
          businessId,
          workerCitizenId,
        },
      }
    }
    case 'repayDebt': {
      const debtId = payload.debtId.trim()
      if (!debtId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
        return { ok: false, error: 'Founder area debt repayment intent is invalid.', code: 'invalid_intent_payload' }
      }
      return {
        ok: true,
        payload: {
          ...payload,
          debtId,
        },
      }
    }
    case 'buyInsurance': {
      const insuranceBusinessId = payload.insuranceBusinessId.trim()
      if (!insuranceBusinessId) {
        return { ok: false, error: 'Founder area insurance intent is invalid.', code: 'invalid_intent_payload' }
      }
      return {
        ok: true,
        payload: {
          ...payload,
          insuranceBusinessId,
        },
      }
    }
  }
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
    areaEvents: state.areaEvents?.map(realityEventToWorldEvent),
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
    areaEvents: mergeRealityAreaEventsDashboard(serverDashboard.areaEvents),
    growth: {
      ...serverDashboard.growth,
      blockers: [...serverDashboard.growth.blockers],
    },
    settlement: {
      ...serverDashboard.settlement,
      blockers: [...serverDashboard.settlement.blockers],
    },
    payoutReadiness: {
      ...serverDashboard.payoutReadiness,
      blockers: [...serverDashboard.payoutReadiness.blockers],
    },
    legacyRoyalty: {
      ...serverDashboard.legacyRoyalty,
      royaltyEligibleBusinessIds: [...serverDashboard.legacyRoyalty.royaltyEligibleBusinessIds],
      royaltyExcludedBusinessIds: [...serverDashboard.legacyRoyalty.royaltyExcludedBusinessIds],
      blockers: [...serverDashboard.legacyRoyalty.blockers],
    },
    handoff: {
      ...serverDashboard.handoff,
      transferPackage: { ...serverDashboard.handoff.transferPackage },
      blockers: [...serverDashboard.handoff.blockers],
    },
    landRights: {
      ...serverDashboard.landRights,
      leaseTemplate: { ...serverDashboard.landRights.leaseTemplate },
      blockers: [...serverDashboard.landRights.blockers],
    },
    founderCovenant: mergeRealityAreaCovenantReview(serverDashboard.founderCovenant),
  }
}

function mergeRealityAreaEventsDashboard(events: RealityAreaEventsDashboard): RealityAreaEventsDashboard {
  return {
    eventCount: events.eventCount,
    simDepartures: events.simDepartures,
    warningEvents: events.warningEvents,
    criticalEvents: events.criticalEvents,
    recentEvents: events.recentEvents.map((event) => ({
      ...event,
      needs: { ...event.needs },
    })),
  }
}

function mergeRealityAreaLedgerDashboard(ledger: RealityAreaLedgerDashboard): AreaLedgerDashboard {
  return {
    transactionCount: ledger.transactionCount,
    totalsByKind: { ...ledger.totalsByKind },
    payoutClassification: { ...ledger.payoutClassification },
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
    (value.areaEvents !== undefined && (
      !Array.isArray(value.areaEvents) ||
      !value.areaEvents.every(isRealityAreaEvent)
    )) ||
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
    isRealityAreaEventsDashboard(value.areaEvents) &&
    isRealityAreaGrowthDashboard(value.growth) &&
    isRealityAreaSettlementDashboard(value.settlement) &&
    isRealityAreaPayoutReadinessDashboard(value.payoutReadiness) &&
    isRealityAreaLegacyRoyaltyDashboard(value.legacyRoyalty) &&
    isRealityAreaHandoffDashboard(value.handoff) &&
    isRealityAreaLandRightsDashboard(value.landRights) &&
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
    isRealityAreaLedgerPayoutClassification(value.payoutClassification) &&
    Array.isArray(value.recentTransactions) &&
    value.recentTransactions.every(isRealityAreaTransaction)
}

function isRealityAreaEventsDashboard(value: unknown): value is RealityAreaEventsDashboard {
  return isRecord(value) &&
    typeof value.eventCount === 'number' &&
    typeof value.simDepartures === 'number' &&
    typeof value.warningEvents === 'number' &&
    typeof value.criticalEvents === 'number' &&
    Array.isArray(value.recentEvents) &&
    value.recentEvents.every(isRealityAreaEventDashboard)
}

function isRealityAreaEventDashboard(value: unknown): value is RealityAreaEventDashboard {
  if (!isRealityAreaEvent(value) || !isRecord(value)) return false
  return typeof value.displayName === 'string' &&
    (value.participantLabel === 'Sim Citizen' || value.participantLabel === 'Real Citizen') &&
    (value.visualTone === 'simulated' || value.visualTone === 'real')
}

function isRealityAreaEvent(value: unknown): value is RealityAreaEvent {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    value.kind === 'sim_citizen_departure' &&
    isRealityAreaEventSeverity(value.severity) &&
    typeof value.citizenId === 'string' &&
    typeof value.citizenName === 'string' &&
    typeof value.simulated === 'boolean' &&
    isRealityAreaDepartureReason(value.reason) &&
    isRealityAreaDepartureServiceKind(value.serviceKind) &&
    typeof value.health === 'number' &&
    isRealityAreaNeeds(value.needs) &&
    typeof value.message === 'string'
}

function isRealityAreaEventSeverity(value: unknown): value is RealityAreaEventSeverity {
  return value === 'info' || value === 'warning' || value === 'critical'
}

function isRealityAreaDepartureReason(value: unknown): value is RealityAreaDepartureReason {
  return value === 'water_unserved' || value === 'food_unserved' || value === 'housing_unserved'
}

function isRealityAreaDepartureServiceKind(value: unknown): value is RealityAreaDepartureServiceKind {
  return value === 'water' || value === 'food' || value === 'housing'
}

function isRealityAreaLedgerPayoutClassification(
  value: unknown,
): value is RealityAreaLedgerPayoutClassificationDashboard {
  return isRecord(value) &&
    typeof value.gameOnlyTransactionCount === 'number' &&
    typeof value.gameOnlyAmount === 'number' &&
    value.payoutEligibleTransactionCount === 0 &&
    value.payoutEligibleAmount === 0 &&
    value.manualPayoutReviewRequired === true &&
    value.realWithdrawalEligible === false
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

function isRealityAreaPayoutReadinessDashboard(value: unknown): value is RealityAreaPayoutReadinessDashboard {
  return isRecord(value) &&
    value.enabled === false &&
    value.mode === 'game_credits_only' &&
    value.gameplayLedgerSource === 'reality_server' &&
    typeof value.gameCredits === 'number' &&
    value.payoutEligibleCredits === 0 &&
    value.realWithdrawalsEnabled === false &&
    value.manualPayoutApprovalEnabled === false &&
    value.kycRequired === true &&
    value.kycStatus === 'not_started' &&
    value.taxProfileRequired === true &&
    value.taxProfileStatus === 'not_started' &&
    value.complianceReviewRequired === true &&
    value.noProfitPromise === true &&
    value.tonSettlementEnabled === false &&
    value.stablecoinRailPlanned === true &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaPayoutReadinessBlocker)
}

function isRealityAreaPayoutReadinessBlocker(value: unknown): value is RealityAreaPayoutReadinessBlocker {
  return value === 'game_credits_only' ||
    value === 'payouts_disabled' ||
    value === 'withdrawals_disabled' ||
    value === 'kyc_disabled' ||
    value === 'tax_profile_disabled' ||
    value === 'manual_payout_review_required' ||
    value === 'compliance_review_required' ||
    value === 'ton_settlement_disabled'
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

function isRealityAreaHandoffDashboard(value: unknown): value is RealityAreaHandoffDashboard {
  return isRecord(value) &&
    value.enabled === false &&
    value.mode === 'manual_disabled' &&
    value.candidateSelectionEnabled === false &&
    value.replacementWorkflowEnabled === false &&
    value.waitlistHandoffEnabled === false &&
    value.seatTransferEnabled === false &&
    value.areaTransferEnabled === false &&
    value.businessTransferEnabled === false &&
    value.debtTransferEnabled === false &&
    value.legacyRulesTransferEnabled === false &&
    value.manualReviewRequired === true &&
    (value.successorCandidateSource === 'none' || value.successorCandidateSource === 'named_heir') &&
    (value.successorCandidateCitizenId === null || typeof value.successorCandidateCitizenId === 'string') &&
    (value.successorCandidateName === null || typeof value.successorCandidateName === 'string') &&
    isRealityAreaHandoffTransferPackage(value.transferPackage) &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaHandoffBlocker)
}

function isRealityAreaHandoffTransferPackage(value: unknown): value is RealityAreaHandoffTransferPackage {
  return isRecord(value) &&
    typeof value.founderNumber === 'number' &&
    typeof value.founderCitizenId === 'string' &&
    typeof value.areaId === 'string' &&
    typeof value.businessCount === 'number' &&
    typeof value.founderCreatedBusinessCount === 'number' &&
    typeof value.inheritedBusinessCount === 'number' &&
    typeof value.outstandingDebt === 'number' &&
    typeof value.debtObligationCount === 'number' &&
    typeof value.protectedByInsurance === 'boolean' &&
    typeof value.legacyRoyaltyRate === 'number' &&
    value.legacyRoyaltyRate >= 0 &&
    value.legacyRoyaltyRate <= 1 &&
    value.legacyTreasuryAccountId === 'system:founder-legacy-treasury'
}

function isRealityAreaHandoffBlocker(value: unknown): value is RealityAreaHandoffBlocker {
  return value === 'replacement_workflow_disabled' ||
    value === 'waitlist_handoff_disabled' ||
    value === 'candidate_selection_disabled' ||
    value === 'main_founder_approval_required' ||
    value === 'manual_review_required'
}

function isRealityAreaLandRightsDashboard(value: unknown): value is RealityAreaLandRightsDashboard {
  return isRecord(value) &&
    value.enabled === false &&
    value.mode === 'disabled_until_survival_business_loop_review' &&
    value.publicWording === 'reservation_building_rights' &&
    value.landSalesEnabled === false &&
    value.reservationsEnabled === false &&
    value.purchasesEnabled === false &&
    value.leasesEnabled === false &&
    value.rentCollectionEnabled === false &&
    value.platformFeeEnabled === false &&
    typeof value.areaId === 'string' &&
    typeof value.areaLabel === 'string' &&
    typeof value.ownerCitizenId === 'string' &&
    typeof value.radiusKm === 'number' &&
    typeof value.businessCount === 'number' &&
    value.operatorCount === 0 &&
    isRealityAreaLandLeaseTemplate(value.leaseTemplate) &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaLandRightsBlocker)
}

function isRealityAreaLandLeaseTemplate(value: unknown): value is RealityAreaLandLeaseTemplate {
  return isRecord(value) &&
    value.enabled === false &&
    value.termDays === 30 &&
    value.fixedMonthlyRent === null &&
    value.rentCurrency === 'game_credits' &&
    value.payerCitizenId === null &&
    typeof value.receiverCitizenId === 'string' &&
    value.platformFeeRate === 0.05 &&
    value.platformFeeReceiverId === 'system:reality-platform-fees' &&
    value.requiresOperator === true &&
    value.requiresDemand === true
}

function isRealityAreaLandRightsBlocker(value: unknown): value is RealityAreaLandRightsBlocker {
  return value === 'land_reservations_disabled' ||
    value === 'land_purchases_disabled' ||
    value === 'leases_disabled' ||
    value === 'rent_collection_disabled' ||
    value === 'operator_acceptance_disabled' ||
    value === 'manual_review_required' ||
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

function isRealityFounderCovenantReviewQueueDashboard(
  value: unknown,
): value is RealityFounderCovenantReviewQueueDashboard {
  return isRecord(value) &&
    typeof value.generatedAt === 'string' &&
    value.evidenceOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false &&
    value.replacementEnabled === false &&
    value.waitlistHandoffEnabled === false &&
    value.approvalWorkflowEnabled === false &&
    typeof value.limit === 'number' &&
    typeof value.pages === 'number' &&
    typeof value.pagesScanned === 'number' &&
    isNullableString(value.cursor) &&
    isNullableString(value.nextCursor) &&
    typeof value.scanned === 'number' &&
    typeof value.caughtUp === 'number' &&
    typeof value.current === 'number' &&
    typeof value.failed === 'number' &&
    typeof value.hasMore === 'boolean' &&
    isRealityFounderCovenantReviewQueueTotals(value.totals) &&
    Array.isArray(value.items) &&
    value.items.every(isRealityFounderCovenantReviewQueueItem) &&
    Array.isArray(value.results) &&
    value.results.every(isRealityFounderCovenantReviewQueueScanResult)
}

function isRealityFounderCovenantReviewQueueTotals(
  value: unknown,
): value is RealityFounderCovenantReviewQueueDashboard['totals'] {
  return isRecord(value) &&
    typeof value.founders === 'number' &&
    typeof value.active === 'number' &&
    typeof value.useful === 'number' &&
    typeof value.building === 'number' &&
    typeof value.staffed === 'number' &&
    typeof value.indebted === 'number' &&
    typeof value.hospitalized === 'number' &&
    typeof value.atRisk === 'number' &&
    typeof value.manualReviewRequired === 'number' &&
    typeof value.manualReviewNeverReviewed === 'number' &&
    typeof value.manualReviewFreshReviewed === 'number' &&
    typeof value.manualReviewStaleReviewed === 'number' &&
    typeof value.signalWarningCount === 'number' &&
    typeof value.signalCriticalCount === 'number' &&
    typeof value.signalFlaggedFounders === 'number' &&
    typeof value.evidenceQueuedFounders === 'number' &&
    typeof value.evidenceRequiredGaps === 'number' &&
    typeof value.recordReadyFounders === 'number' &&
    typeof value.recordReadyWeekly === 'number' &&
    typeof value.recordReadyMonthly === 'number' &&
    typeof value.monitorFounders === 'number' &&
    typeof value.freshReviewedActiveFounders === 'number' &&
    typeof value.overdueCleanupFounders === 'number' &&
    typeof value.nextEvidenceFounders === 'number' &&
    typeof value.nextBlockedFounders === 'number' &&
    typeof value.nextOverdueFounders === 'number' &&
    typeof value.nextRecordFounders === 'number' &&
    typeof value.nextMonitorFounders === 'number' &&
    typeof value.lowScoreFounders === 'number' &&
    typeof value.inactiveFounders === 'number' &&
    typeof value.manualReviewQueueFounders === 'number' &&
    typeof value.probationRiskFounders === 'number' &&
    typeof value.replacementRiskFounders === 'number' &&
    typeof value.neverReviewed === 'number' &&
    typeof value.freshReviewed === 'number' &&
    typeof value.staleReviewed === 'number' &&
    typeof value.staleWeeklyDue === 'number' &&
    typeof value.staleMonthlyDue === 'number' &&
    typeof value.scanAnomalies === 'number' &&
    typeof value.weeklyDue === 'number' &&
    typeof value.monthlyDue === 'number' &&
    typeof value.warningApprovals === 'number' &&
    typeof value.probationApprovals === 'number' &&
    typeof value.replacementApprovals === 'number' &&
    typeof value.warningDrafts === 'number' &&
    typeof value.manualReviewDrafts === 'number' &&
    typeof value.overdue === 'number' &&
    typeof value.blockedApprovalFounders === 'number' &&
    typeof value.totalFounderCash === 'number' &&
    typeof value.totalOutstandingDebt === 'number' &&
    typeof value.totalBusinessCash === 'number' &&
    typeof value.unstaffedBusinesses === 'number' &&
    typeof value.insuredFounders === 'number' &&
    typeof value.pendingApprovals === 'number' &&
    typeof value.pendingNotifications === 'number' &&
    typeof value.blockers === 'number'
}

function isRealityFounderCovenantReviewQueueItem(
  value: unknown,
): value is RealityFounderCovenantReviewQueueItem {
  return isRecord(value) &&
    typeof value.areaId === 'string' &&
    typeof value.areaLabel === 'string' &&
    typeof value.founderCitizenId === 'string' &&
    typeof value.founderNumber === 'number' &&
    typeof value.updatedAt === 'string' &&
    typeof value.checkedAt === 'string' &&
    isNullableString(value.lastReviewAt) &&
    (value.reviewFreshness === 'never' || value.reviewFreshness === 'fresh' || value.reviewFreshness === 'stale') &&
    (value.latestReview === null || isRealityFounderCovenantReviewQueueLatestReview(value.latestReview)) &&
    typeof value.nextWeeklyReviewAt === 'string' &&
    typeof value.nextMonthlyReviewAt === 'string' &&
    typeof value.weeklyReviewDue === 'boolean' &&
    typeof value.monthlyReviewDue === 'boolean' &&
    typeof value.overdue === 'boolean' &&
    isRealityAreaCovenantStatus(value.covenantStatus) &&
    isRealityAreaCovenantNextAction(value.nextAction) &&
    typeof value.manualReviewRequired === 'boolean' &&
    value.replacementEnabled === false &&
    value.waitlistHandoffEnabled === false &&
    isRealityAreaCovenantActivityReview(value.activityReview) &&
    Array.isArray(value.activitySignals) &&
    value.activitySignals.every(isRealityFounderCovenantActivitySignal) &&
    Array.isArray(value.reviewInputs) &&
    value.reviewInputs.every(isRealityAreaCovenantReviewInput) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRealityAreaCovenantStage) &&
    isRealityFounderCovenantReviewReadiness(value.reviewReadiness) &&
    Array.isArray(value.reviewChecklist) &&
    value.reviewChecklist.every(isRealityAreaCovenantReviewChecklistItem) &&
    Array.isArray(value.manualActions) &&
    value.manualActions.every(isRealityAreaCovenantReviewActionSnapshot) &&
    isRealityFounderCovenantReviewQueueEconomicExposure(value.economicExposure) &&
    isRealityAreaCovenantReviewQueue(value.reviewQueue) &&
    isRealityFounderCovenantReviewQueueSignalCounts(value.signalCounts) &&
    Array.isArray(value.signalKinds) &&
    value.signalKinds.every(isRealityAreaCovenantSignalKind) &&
    Array.isArray(value.recommendedActionKinds) &&
    value.recommendedActionKinds.every(isRealityAreaCovenantManualActionKind) &&
    Array.isArray(value.pendingApprovalRequests) &&
    value.pendingApprovalRequests.every(isRealityAreaCovenantReviewApprovalRequestSnapshot) &&
    Array.isArray(value.pendingApprovalKinds) &&
    value.pendingApprovalKinds.every(isRealityAreaCovenantApprovalRequestKind) &&
    Array.isArray(value.pendingNotificationDrafts) &&
    value.pendingNotificationDrafts.every(isRealityAreaCovenantNotificationDraft) &&
    Array.isArray(value.pendingNotificationKinds) &&
    value.pendingNotificationKinds.every(isRealityAreaCovenantNotificationDraftKind) &&
    typeof value.blockerCount === 'number' &&
    isRealityFounderCovenantReviewQueueScanStatus(value.scanStatus) &&
    typeof value.transactionsAdded === 'number'
}

function isRealityFounderCovenantReviewQueueLatestReview(
  value: unknown,
): value is RealityFounderCovenantReviewQueueLatestReview {
  return isRecord(value) &&
    typeof value.reviewedAt === 'string' &&
    typeof value.reviewerId === 'string' &&
    value.actionKind === 'record_review' &&
    typeof value.summary === 'string' &&
    value.evidenceOnly === true &&
    value.automationEnabled === false
}

function isRealityFounderCovenantActivitySignal(
  value: unknown,
): value is RealityFounderCovenantActivitySignal {
  return isRecord(value) &&
    isRealityFounderCovenantActivitySignalKey(value.key) &&
    typeof value.label === 'string' &&
    typeof value.value === 'boolean' &&
    isRealityFounderCovenantActivitySignalStatus(value.status) &&
    typeof value.summary === 'string' &&
    value.manualOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false
}

function isRealityFounderCovenantReviewReadiness(
  value: unknown,
): value is RealityFounderCovenantReviewReadiness {
  return isRecord(value) &&
    isRealityFounderCovenantReviewReadinessStatus(value.status) &&
    typeof value.label === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.evidenceRequiredCount === 'number' &&
    typeof value.approvalRequestCount === 'number' &&
    typeof value.blockerCount === 'number' &&
    typeof value.overdue === 'boolean' &&
    value.manualOnly === true &&
    value.automationEnabled === false &&
    value.executionEnabled === false
}

function isRealityFounderCovenantReviewQueueEconomicExposure(
  value: unknown,
): value is RealityFounderCovenantReviewQueueEconomicExposure {
  return isRecord(value) &&
    typeof value.founderCash === 'number' &&
    typeof value.outstandingDebt === 'number' &&
    typeof value.debtCount === 'number' &&
    typeof value.businessCash === 'number' &&
    typeof value.businessCount === 'number' &&
    typeof value.unstaffedBusinessCount === 'number' &&
    typeof value.insured === 'boolean' &&
    typeof value.hospitalized === 'boolean' &&
    value.gameCreditsOnly === true &&
    value.payoutEligibleCredits === 0 &&
    value.manualPayoutReviewRequired === true
}

function isRealityFounderCovenantReviewQueueSignalCounts(
  value: unknown,
): value is RealityFounderCovenantReviewQueueSignalCounts {
  return isRecord(value) &&
    typeof value.total === 'number' &&
    typeof value.info === 'number' &&
    typeof value.warning === 'number' &&
    typeof value.critical === 'number'
}

function isRealityFounderCovenantReviewQueueScanResult(
  value: unknown,
): value is RealityFounderCovenantReviewQueueScanResult {
  return isRecord(value) &&
    isNullableString(value.citizenId) &&
    isNullableString(value.areaId) &&
    isRealityFounderCovenantReviewQueueScanStatus(value.status) &&
    isNullableString(value.updatedAt) &&
    typeof value.transactionsAdded === 'number'
}

function isRealityFounderCovenantReviewQueueScanStatus(
  value: unknown,
): value is RealityFounderCovenantReviewQueueScanStatus {
  return value === 'caught_up' || value === 'current' || value === 'invalid' || value === 'unavailable'
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
    (typeof value.note === 'string' || value.note === undefined) &&
    (
      value.evidenceKinds === undefined ||
      (
        Array.isArray(value.evidenceKinds) &&
        value.evidenceKinds.every(isRealityAreaCovenantManualEvidenceKind)
      )
    )
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

function isRealityFounderCovenantActivitySignalKey(
  value: unknown,
): value is RealityFounderCovenantActivitySignalKey {
  return value === 'active' ||
    value === 'useful' ||
    value === 'building' ||
    value === 'staffed' ||
    value === 'indebted' ||
    value === 'hospitalized' ||
    value === 'at_risk'
}

function isRealityFounderCovenantActivitySignalStatus(
  value: unknown,
): value is RealityFounderCovenantActivitySignalStatus {
  return value === 'met' || value === 'watch' || value === 'manual_review'
}

function isRealityFounderCovenantReviewReadinessStatus(
  value: unknown,
): value is RealityFounderCovenantReviewReadinessStatus {
  return value === 'blocked' ||
    value === 'needs_evidence' ||
    value === 'overdue' ||
    value === 'ready' ||
    value === 'monitoring'
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

function isRealityAreaCovenantManualEvidenceKind(value: unknown): value is RealityAreaCovenantManualEvidenceKind {
  return value === 'population_growth' ||
    value === 'external_contribution' ||
    value === 'ideas_feedback'
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
    value === 'sim_departure' ||
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
    value.payoutEligibility === 'game_only' &&
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
    value.namingEnabled === false &&
    value.transferEnabled === false &&
    value.waitlistFallbackEnabled === false &&
    value.manualReviewRequired === true &&
    (typeof value.namedHeirCitizenId === 'string' || value.namedHeirCitizenId === null) &&
    (typeof value.namedHeirName === 'string' || value.namedHeirName === null) &&
    typeof value.protectedByInsurance === 'boolean' &&
    value.status === 'disabled_until_death_enabled' &&
    Array.isArray(value.blockers) &&
    value.blockers.every(isRealityAreaEstateProtectionBlocker)
}

function isRealityAreaEstateProtectionBlocker(value: unknown): value is RealityAreaEstateProtectionBlocker {
  return value === 'death_disabled' ||
    value === 'heir_naming_disabled' ||
    value === 'estate_transfer_disabled' ||
    value === 'waitlist_handoff_disabled' ||
    value === 'manual_review_required'
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

function realityEventToWorldEvent(event: RealityAreaEvent): WorldAreaEvent {
  return {
    ...event,
    at: parseInstant(event.at),
    needs: { ...event.needs },
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}
