import { formatMoney } from '../../game/engine'
import type {
  AreaEventDashboard,
  AreaEventsDashboard,
  AreaFounderCovenantDashboard,
  AreaLedgerDashboard,
  AreaTransactionDashboard,
  FounderCovenantActivityReview,
  FounderCovenantApprovalRequest,
  FounderCovenantManualAction,
  FounderCovenantNotificationDraft,
  FounderCovenantReviewInput,
  FounderCovenantReviewHistoryItem,
  FounderCovenantReviewQueue,
  FounderCovenantReviewChecklistItem,
  FounderCovenantReviewSchedule,
  FounderCovenantSignal,
  FounderCovenantStage,
  WorldTransactionKind,
} from '../../game/worldSim'
import type {
  RealityAreaDashboard,
  RealityAreaGrowthBlocker,
  RealityAreaGrowthDashboard,
  RealityAreaHandoffBlocker,
  RealityAreaHandoffDashboard,
  RealityAreaLandRightsBlocker,
  RealityAreaLandRightsDashboard,
  RealityAreaLegacyRoyaltyBlocker,
  RealityAreaLegacyRoyaltyDashboard,
  RealityAreaPayoutReadinessBlocker,
  RealityAreaPayoutReadinessDashboard,
  RealityAreaSettlementBlocker,
  RealityAreaSettlementDashboard,
  RealityFounderCovenantReviewQueueDashboard,
  RealityFounderCovenantReviewQueueItem,
} from '../../lib/realityArea'

export type FounderCovenantReviewTone = 'stable' | 'warning' | 'critical'

export interface FounderCovenantReviewItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderLedgerSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderAreaEventSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderSettlementSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderLegacyRoyaltySummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderGrowthSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderHandoffSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderLandRightsSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderPayoutReadinessSummaryItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export interface FounderCovenantScheduleItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
}

export type FounderCovenantOperatorQueueStatusClass = 'met' | 'watch' | 'manual_review'
export type FounderCovenantOperatorQueueFilter =
  | 'all'
  | 'never_reviewed'
  | 'stale_reviewed'
  | 'stale_weekly_due'
  | 'stale_monthly_due'
  | 'weekly_due'
  | 'monthly_due'
  | 'fresh_reviewed'
  | 'manual_review'
  | 'needs_evidence'
  | 'action_evidence'
  | 'action_blocked'
  | 'action_overdue'
  | 'action_record'
  | 'action_monitor'
  | 'overdue'
  | 'blocked'
  | 'hospitalized'
  | 'inactive'
  | 'debt_risk'
  | 'at_risk'
  | 'telegram_ready'
  | 'scan_anomaly'
export type FounderCovenantOperatorQueueSort = 'priority' | 'coverage' | 'founder' | 'action'

export interface FounderCovenantOperatorQueueSliceTotals {
  founders: number
  manualReviewRequired: number
  neverReviewed: number
  freshReviewed: number
  staleReviewed: number
  staleWeeklyDue: number
  staleMonthlyDue: number
  scanAnomalies: number
  weeklyDue: number
  monthlyDue: number
  overdue: number
  hospitalized: number
  indebted: number
  blockers: number
  active: number
  useful: number
  building: number
  staffed: number
  atRisk: number
}

export interface FounderCovenantOperatorQueueReviewRow {
  key: string
  title: string
  areaId: string
  founderCitizenId: string
  reviewFreshness: RealityFounderCovenantReviewQueueItem['reviewFreshness']
  canRecordReview: boolean
  statusClass: FounderCovenantOperatorQueueStatusClass
  statusLabel: string
  summary: string
  dateSummary: string
  latestReviewText: string | null
  activitySignalText: string
  economicExposureText: string
  stageText: string
  reviewReadinessText: string
  checklistText: string
  evidenceInputText: string
  evidenceNextText: string
  recommendedNextText: string
  recommendedNextTone: FounderCovenantReviewTone
  manualActionText: string
  approvalRequestText: string
  notificationDraftText: string
  telegramOutputText: string
  telegramOutputTone: FounderCovenantReviewTone
  signalText: string
  priorityScore: number
  priorityReasons: string[]
}

export interface FounderCovenantOperatorQueueActionMix {
  evidence: number
  blocked: number
  overdue: number
  record: number
  monitor: number
}

export interface FounderCovenantOperatorQueueCadenceReadyMix {
  weekly: number
  monthly: number
}

export interface FounderCovenantOperatorQueueActivityRiskMix {
  inactive: number
  usefulnessGaps: number
  buildGaps: number
  staffingGaps: number
  debtRisk: number
  hospitalized: number
  atRisk: number
}

export function founderIdentitySeatLabel(
  identity: Pick<RealityAreaDashboard['founderIdentity'], 'founderNumber'>,
): string {
  return `Founder #${String(identity.founderNumber).padStart(4, '0')}`
}

export function founderIdentityClaimSourceLabel(
  source: RealityAreaDashboard['founderIdentity']['claimSource'],
): string {
  switch (source) {
    case 'telegram':
      return 'Telegram claim'
    case 'geolocation':
      return 'Geolocation claim'
    case 'ip':
      return 'IP claim'
    case 'manual':
      return 'Manual claim'
  }
}

export function founderIdentityTelegramStatusLabel(
  identity: Pick<RealityAreaDashboard['founderIdentity'], 'telegramUserId' | 'telegramAccountId'>,
): string {
  if (identity.telegramUserId) return `Telegram linked ${identity.telegramUserId}`
  if (identity.telegramAccountId) return `Telegram linked ${identity.telegramAccountId.replace(/^telegram:/, '')}`
  return 'Telegram pending'
}

export function founderGrowthStatusLabel(
  growth: Pick<RealityAreaGrowthDashboard, 'manualEvidenceRequired'>,
): string {
  return growth.manualEvidenceRequired ? 'Manual evidence' : 'Tracked'
}

export function founderGrowthSummaryItems(growth: RealityAreaGrowthDashboard): FounderGrowthSummaryItem[] {
  return [{
    key: 'channel',
    label: 'Channel',
    value: growth.channel === 'telegram' ? 'Telegram' : growth.channel,
    tone: 'warning',
  }, {
    key: 'real',
    label: 'Real citizens',
    value: String(growth.realPopulation),
    tone: growth.realPopulation > 1 ? 'stable' : 'warning',
  }, {
    key: 'sim',
    label: 'Sim citizens',
    value: String(growth.simPopulation),
    tone: growth.simPopulation > 0 ? 'stable' : 'warning',
  }, {
    key: 'invites',
    label: 'Tracked invites',
    value: String(growth.trackedInvites),
    tone: 'warning',
  }]
}

export function founderGrowthBlockerText(blocker: RealityAreaGrowthBlocker): string {
  switch (blocker) {
    case 'telegram_invite_links_disabled':
      return 'Telegram invite links'
    case 'invite_tracking_disabled':
      return 'Invite tracking'
    case 'automatic_growth_rewards_disabled':
      return 'Automatic growth rewards'
    case 'manual_review_required':
      return 'Manual review'
  }
}

export function founderHandoffStatusLabel(
  handoff: Pick<RealityAreaHandoffDashboard, 'enabled' | 'manualReviewRequired'>,
): string {
  return handoff.enabled ? 'Enabled' : handoff.manualReviewRequired ? 'Manual review' : 'Disabled'
}

export function founderHandoffSummaryItems(handoff: RealityAreaHandoffDashboard): FounderHandoffSummaryItem[] {
  const transfer = handoff.transferPackage
  return [{
    key: 'seat',
    label: 'Seat',
    value: `#${String(transfer.founderNumber).padStart(4, '0')}`,
    tone: 'stable',
  }, {
    key: 'businesses',
    label: 'Businesses',
    value: String(transfer.businessCount),
    tone: transfer.businessCount > 0 ? 'warning' : 'stable',
  }, {
    key: 'debt',
    label: 'Debt',
    value: formatMoney(transfer.outstandingDebt),
    tone: transfer.outstandingDebt > 0 ? 'warning' : 'stable',
  }, {
    key: 'candidate',
    label: 'Candidate',
    value: founderHandoffCandidateLabel(handoff),
    tone: handoff.successorCandidateCitizenId ? 'warning' : 'stable',
  }]
}

export function founderHandoffBlockerText(blocker: RealityAreaHandoffBlocker): string {
  switch (blocker) {
    case 'replacement_workflow_disabled':
      return 'Replacement workflow'
    case 'waitlist_handoff_disabled':
      return 'Waitlist handoff'
    case 'candidate_selection_disabled':
      return 'Candidate selection'
    case 'main_founder_approval_required':
      return 'Main founder approval'
    case 'manual_review_required':
      return 'Manual review'
  }
}

export function founderHandoffPackageText(handoff: RealityAreaHandoffDashboard): string {
  const transfer = handoff.transferPackage
  return `${transfer.areaId} · ${transfer.founderCreatedBusinessCount} founder-created · ${transfer.inheritedBusinessCount} inherited`
}

function founderHandoffCandidateLabel(
  handoff: Pick<RealityAreaHandoffDashboard, 'successorCandidateName' | 'successorCandidateSource'>,
): string {
  if (handoff.successorCandidateName) return handoff.successorCandidateName
  return handoff.successorCandidateSource === 'named_heir' ? 'Named heir' : 'None'
}

export function founderLandRightsStatusLabel(
  land: Pick<RealityAreaLandRightsDashboard, 'enabled' | 'mode'>,
): string {
  if (land.enabled) return 'Enabled'
  switch (land.mode) {
    case 'disabled_until_survival_business_loop_review':
      return 'Disabled'
  }
}

export function founderLandRightsSummaryItems(land: RealityAreaLandRightsDashboard): FounderLandRightsSummaryItem[] {
  return [{
    key: 'wording',
    label: 'Wording',
    value: land.publicWording === 'reservation_building_rights' ? 'Building rights' : land.publicWording,
    tone: 'stable',
  }, {
    key: 'area',
    label: 'Area',
    value: land.areaLabel,
    tone: 'stable',
  }, {
    key: 'businesses',
    label: 'Businesses',
    value: String(land.businessCount),
    tone: land.businessCount > 0 ? 'stable' : 'warning',
  }, {
    key: 'rent',
    label: 'Rent',
    value: land.leaseTemplate.fixedMonthlyRent === null
      ? 'not quoted'
      : formatMoney(land.leaseTemplate.fixedMonthlyRent),
    tone: 'warning',
  }]
}

export function founderLandRightsLeaseTemplateText(land: RealityAreaLandRightsDashboard): string {
  const template = land.leaseTemplate
  const feePercent = Math.round(template.platformFeeRate * 100)
  return `${template.termDays} days · receiver ${template.receiverCitizenId} · platform fee ${feePercent}%`
}

export function founderLandRightsBlockerText(blocker: RealityAreaLandRightsBlocker): string {
  switch (blocker) {
    case 'land_reservations_disabled':
      return 'Land reservations'
    case 'land_purchases_disabled':
      return 'Land purchases'
    case 'leases_disabled':
      return 'Land leases'
    case 'rent_collection_disabled':
      return 'Rent collection'
    case 'operator_acceptance_disabled':
      return 'Operator acceptance'
    case 'manual_review_required':
      return 'Manual review'
    case 'compliance_review_required':
      return 'Compliance review'
  }
}

export function founderSettlementStatusLabel(settlement: Pick<RealityAreaSettlementDashboard, 'mode'>): string {
  switch (settlement.mode) {
    case 'ledger_only':
      return 'Disabled'
  }
}

export function founderPayoutReadinessStatusLabel(
  payout: Pick<RealityAreaPayoutReadinessDashboard, 'enabled' | 'mode'>,
): string {
  if (payout.enabled) return 'Enabled'
  switch (payout.mode) {
    case 'game_credits_only':
      return 'Game credits only'
  }
}

export function founderPayoutReadinessSummaryItems(
  payout: RealityAreaPayoutReadinessDashboard,
): FounderPayoutReadinessSummaryItem[] {
  return [{
    key: 'credits',
    label: 'Game credits',
    value: formatMoney(payout.gameCredits),
    tone: 'stable',
  }, {
    key: 'eligible',
    label: 'Payout eligible',
    value: formatMoney(payout.payoutEligibleCredits),
    tone: 'stable',
  }, {
    key: 'kyc',
    label: 'KYC',
    value: payout.kycStatus === 'not_started' ? 'not started' : payout.kycStatus,
    tone: 'warning',
  }, {
    key: 'tax',
    label: 'Tax',
    value: payout.taxProfileStatus === 'not_started' ? 'not started' : payout.taxProfileStatus,
    tone: 'warning',
  }]
}

export function founderPayoutReadinessBlockerText(blocker: RealityAreaPayoutReadinessBlocker): string {
  switch (blocker) {
    case 'game_credits_only':
      return 'Game credits only'
    case 'payouts_disabled':
      return 'Payouts'
    case 'withdrawals_disabled':
      return 'Withdrawals'
    case 'kyc_disabled':
      return 'KYC'
    case 'tax_profile_disabled':
      return 'Tax profile'
    case 'manual_payout_review_required':
      return 'Manual payout review'
    case 'compliance_review_required':
      return 'Compliance review'
    case 'ton_settlement_disabled':
      return 'TON settlement'
  }
}

export function founderPayoutReadinessPolicyText(
  payout: Pick<RealityAreaPayoutReadinessDashboard, 'noProfitPromise' | 'stablecoinRailPlanned'>,
): string {
  const promise = payout.noProfitPromise ? 'no profit promise' : 'profit wording review'
  const rail = payout.stablecoinRailPlanned ? 'stablecoin rail planned later' : 'no settlement rail'
  return `${promise} · ${rail}`
}

export function founderSettlementSummaryItems(
  settlement: RealityAreaSettlementDashboard,
): FounderSettlementSummaryItem[] {
  return [{
    key: 'rail',
    label: 'Rail',
    value: settlement.rail.toUpperCase(),
    tone: 'warning',
  }, {
    key: 'mode',
    label: 'Mode',
    value: 'ledger only',
    tone: 'stable',
  }, {
    key: 'credits',
    label: 'Game credits',
    value: formatMoney(settlement.gameCredits),
    tone: 'stable',
  }, {
    key: 'eligible',
    label: 'Payout eligible',
    value: formatMoney(settlement.payoutEligibleCredits),
    tone: 'stable',
  }]
}

export function founderSettlementBlockerText(blocker: RealityAreaSettlementBlocker): string {
  switch (blocker) {
    case 'ton_connect_disabled':
      return 'TON Connect'
    case 'deposits_disabled':
      return 'Deposits'
    case 'withdrawals_disabled':
      return 'Withdrawals'
    case 'land_reservations_disabled':
      return 'Land reservations'
    case 'leases_disabled':
      return 'Land leases'
    case 'manual_payout_review_required':
      return 'Manual payout review'
    case 'compliance_review_required':
      return 'Compliance review'
  }
}

export function founderLegacyRoyaltyStatusLabel(
  royalty: Pick<RealityAreaLegacyRoyaltyDashboard, 'payoutEnabled'>,
): string {
  return royalty.payoutEnabled ? 'Enabled' : 'Disabled'
}

export function founderLegacyRoyaltySummaryItems(
  royalty: RealityAreaLegacyRoyaltyDashboard,
): FounderLegacyRoyaltySummaryItem[] {
  const eligibleAssets = royalty.royaltyEligibleBusinessIds.length
  const excludedAssets = royalty.royaltyExcludedBusinessIds.length
  return [{
    key: 'scope',
    label: 'Scope',
    value: legacyRoyaltyScopeLabel(royalty.appliesTo),
    tone: 'stable',
  }, {
    key: 'rate',
    label: 'Modeled rate',
    value: `${Math.round(royalty.royaltyRate * 100)}%`,
    tone: eligibleAssets > 0 ? 'warning' : 'stable',
  }, {
    key: 'eligible',
    label: 'Eligible assets',
    value: String(eligibleAssets),
    tone: eligibleAssets > 0 ? 'warning' : 'stable',
  }, {
    key: 'excluded',
    label: 'Excluded assets',
    value: String(excludedAssets),
    tone: 'stable',
  }]
}

export function founderLegacyRoyaltyBlockerText(blocker: RealityAreaLegacyRoyaltyBlocker): string {
  switch (blocker) {
    case 'replacement_workflow_disabled':
      return 'Replacement workflow'
    case 'waitlist_handoff_disabled':
      return 'Waitlist handoff'
    case 'treasury_payout_disabled':
      return 'Treasury payout'
    case 'compliance_review_required':
      return 'Compliance review'
  }
}

export function founderCovenantStatusLabel(status: AreaFounderCovenantDashboard['status']): string {
  switch (status) {
    case 'unclaimed':
      return 'Unclaimed'
    case 'active':
      return 'Active'
    case 'watch':
      return 'Watch'
    case 'manual_review':
      return 'Manual review'
  }
}

export function founderCovenantTone(status: AreaFounderCovenantDashboard['status']): 'stable' | 'warning' | 'critical' {
  if (status === 'manual_review') return 'critical'
  if (status === 'watch' || status === 'unclaimed') return 'warning'
  return 'stable'
}

export function founderCovenantChecklistStatusLabel(
  status: FounderCovenantReviewChecklistItem['status'],
): string {
  switch (status) {
    case 'met':
      return 'Met'
    case 'watch':
      return 'Watch'
    case 'manual_review':
      return 'Manual'
  }
}

export function founderCovenantReviewInputStatusLabel(
  status: FounderCovenantReviewInput['status'],
): string {
  switch (status) {
    case 'captured':
      return 'Captured'
    case 'watch':
      return 'Watch'
    case 'manual_needed':
      return 'Manual'
  }
}

export function founderCovenantReviewInputStatusClass(
  status: FounderCovenantReviewInput['status'],
): FounderCovenantReviewChecklistItem['status'] {
  switch (status) {
    case 'captured':
      return 'met'
    case 'watch':
      return 'watch'
    case 'manual_needed':
      return 'manual_review'
  }
}

export function founderCovenantStageStatusLabel(status: FounderCovenantStage['status']): string {
  switch (status) {
    case 'current':
      return 'Current'
    case 'recommended':
      return 'Suggested'
    case 'locked':
      return 'Locked'
  }
}

export function founderCovenantStageTone(status: FounderCovenantStage['status']): FounderCovenantReviewTone {
  if (status === 'recommended') return 'warning'
  return 'stable'
}

export function founderCovenantManualActionStatusLabel(action: Pick<FounderCovenantManualAction, 'recommended'>): string {
  return action.recommended ? 'Suggested' : 'Manual'
}

export function founderCovenantManualActionKindLabel(kind: FounderCovenantManualAction['kind']): string {
  switch (kind) {
    case 'record_review':
      return 'Record review'
    case 'send_warning':
      return 'Send warning'
    case 'start_probation':
      return 'Start probation'
    case 'recommend_replacement':
      return 'Recommend replacement'
  }
}

export function founderCovenantApprovalRequestText(request: FounderCovenantApprovalRequest): string {
  return `${founderCovenantAuthorityRoleLabel(request.authorityGate.requiredRole)} approval · ${request.blockers.length} blocker${request.blockers.length === 1 ? '' : 's'}`
}

export function founderCovenantApprovalBlockerText(
  request: Pick<FounderCovenantApprovalRequest, 'blockers'>,
): string {
  if (request.blockers.length === 0) return 'No blockers'
  return `Blocked by ${request.blockers.map(founderCovenantApprovalBlockerLabel).join(', ')}`
}

export function founderCovenantApprovalRequestStatusLabel(
  request: Pick<FounderCovenantApprovalRequest, 'approvalEnabled' | 'executionEnabled'>,
): string {
  return request.approvalEnabled || request.executionEnabled ? 'Ready' : 'Locked'
}

export function founderCovenantLatestReviewStatusLabel(
  review: {
    evidenceOnly: boolean
    automationEnabled: boolean
    authorityGate: { requiredRole: FounderCovenantManualAction['authorityGate']['requiredRole'] }
  },
): string {
  const role = founderCovenantAuthorityRoleLabel(review.authorityGate.requiredRole)
  return review.evidenceOnly && !review.automationEnabled ? `${role} / Evidence only` : role
}

export function founderCovenantReviewSignalSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'signals'>,
): string {
  const count = review.signals.length
  if (count === 0) return 'No signals captured'
  return `${count} signal${count === 1 ? '' : 's'} captured`
}

export function founderCovenantReviewSnapshotSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'activityReview' | 'reviewChecklist'>,
): string {
  if (!review.activityReview) return 'Snapshot unavailable'
  const manualItems = review.reviewChecklist.filter((item) => item.status === 'manual_review').length
  const watchItems = review.reviewChecklist.filter((item) => item.status === 'watch').length
  return `Snapshot score ${review.activityReview.score}/100 · ${manualItems} manual · ${watchItems} watch`
}

export function founderCovenantReviewInputSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'reviewInputs'>,
): string {
  if (review.reviewInputs.length === 0) return 'No input snapshot'
  const captured = review.reviewInputs.filter((input) => input.status === 'captured').length
  const manual = review.reviewInputs.filter((input) => input.status === 'manual_needed').length
  const watch = review.reviewInputs.filter((input) => input.status === 'watch').length
  return `Inputs snapshot · ${captured} captured · ${manual} manual · ${watch} watch`
}

export function founderCovenantStageSnapshotSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'stages'>,
): string {
  if (review.stages.length === 0) return 'No stage snapshot'
  const current = review.stages.find((stage) => stage.status === 'current')
  const recommended = review.stages.filter((stage) => stage.status === 'recommended')
  if (recommended.length > 0) {
    return `Stage snapshot · ${recommended.map((stage) => stage.label).join(', ')} suggested`
  }
  return `Stage snapshot · ${current?.label ?? 'No active stage'}`
}

export function founderCovenantReviewCadenceSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'reviewSchedule'>,
): string {
  const schedule = review.reviewSchedule
  if (!schedule) return 'Schedule unavailable'
  if (schedule.monthlyReviewDue) return 'Monthly review captured'
  if (schedule.weeklyReviewDue) return 'Weekly review captured'
  return 'Ad hoc review captured'
}

export function founderCovenantReviewDecisionSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'decision'>,
): string {
  if (!review.decision) return 'Decision unavailable'
  return `${founderCovenantStatusLabel(review.decision.status)} / ${founderCovenantNextActionLabel(review.decision.nextAction)}`
}

export function founderCovenantReviewActionSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'manualActions'>,
): string {
  if (review.manualActions.length === 0) return 'No action snapshot'
  const suggested = review.manualActions.filter((action) => action.recommended).length
  const executable = review.manualActions.filter((action) => action.authorityGate.executionEnabled).length
  return `${suggested} suggested · ${executable} executable`
}

export function founderCovenantReviewApprovalSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'approvalRequests'>,
): string {
  const count = review.approvalRequests.length
  if (count === 0) return 'No approval snapshot'
  const executable = review.approvalRequests.filter((request) => request.executionEnabled).length
  const blockers = review.approvalRequests.reduce((total, request) => total + request.blockers.length, 0)
  return `${count} approval${count === 1 ? '' : 's'} captured · ${executable} executable · ${blockers} blocker${blockers === 1 ? '' : 's'}`
}

export function founderCovenantReviewItems(review: FounderCovenantActivityReview): FounderCovenantReviewItem[] {
  return [
    positiveFlag('active', 'Active', review.active),
    positiveFlag('useful', 'Useful', review.useful),
    positiveFlag('building', 'Building', review.building),
    positiveFlag('staffed', 'Staffed', review.staffed),
    riskFlag('indebted', 'Debt', review.indebted),
    riskFlag('hospitalized', 'Hospital', review.hospitalized),
    riskFlag('atRisk', 'At risk', review.atRisk),
  ]
}

export function founderCovenantReviewQueueSummary(queue: FounderCovenantReviewQueue): string {
  return `${founderCovenantReviewQueueNextStepLabel(queue.nextStep)} · ${queue.pendingApprovalCount} approval${queue.pendingApprovalCount === 1 ? '' : 's'} · ${queue.pendingNotificationCount} draft${queue.pendingNotificationCount === 1 ? '' : 's'}`
}

export function founderCovenantReviewQueueStatusLabel(queue: FounderCovenantReviewQueue): string {
  return queue.executionEnabled ? 'Executable' : 'Evidence only'
}

export function founderCovenantReviewQueueDetailText(queue: FounderCovenantReviewQueue): string {
  const approvals = queue.pendingApprovalKinds.length > 0
    ? queue.pendingApprovalKinds.map(founderCovenantManualActionKindLabel).join(', ')
    : 'none'
  const drafts = queue.pendingNotificationKinds.length > 0
    ? queue.pendingNotificationKinds.map(founderCovenantNotificationKindLabel).join(', ')
    : 'none'
  return `Approvals: ${approvals} · Drafts: ${drafts}`
}

export function founderCovenantReviewQueueSnapshotSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'reviewQueue'>,
): string {
  return `Queue snapshot · ${founderCovenantReviewQueueSummary(review.reviewQueue)} · ${review.reviewQueue.blockerCount} blocker${review.reviewQueue.blockerCount === 1 ? '' : 's'}`
}

export function founderCovenantOperatorQueueSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'totals' | 'hasMore'>,
): string {
  const { totals } = queue
  const riskParts = [
    `${totals.manualReviewRequired} manual review${totals.manualReviewRequired === 1 ? '' : 's'}`,
    `${totals.neverReviewed} never reviewed`,
    `${totals.freshReviewed} freshly reviewed`,
    `${totals.staleReviewed} stale review${totals.staleReviewed === 1 ? '' : 's'}`,
    `${totals.staleWeeklyDue} stale weekly`,
    `${totals.staleMonthlyDue} stale monthly`,
    `${totals.scanAnomalies} scan anomal${totals.scanAnomalies === 1 ? 'y' : 'ies'}`,
    `${totals.weeklyDue} weekly due`,
    `${totals.monthlyDue} monthly due`,
    `${totals.warningApprovals} warning approval${totals.warningApprovals === 1 ? '' : 's'}`,
    `${totals.probationApprovals} probation approval${totals.probationApprovals === 1 ? '' : 's'}`,
    `${totals.replacementApprovals} replacement approval${totals.replacementApprovals === 1 ? '' : 's'}`,
    `${totals.warningDrafts} warning draft${totals.warningDrafts === 1 ? '' : 's'}`,
    `${totals.manualReviewDrafts} manual-review draft${totals.manualReviewDrafts === 1 ? '' : 's'}`,
    `${totals.overdue} overdue`,
    `${totals.hospitalized} hospitalized`,
    `${totals.indebted} indebted`,
  ]
  return `${totals.founders} founder${totals.founders === 1 ? '' : 's'} · ${riskParts.join(' · ')} · ${formatMoney(totals.totalOutstandingDebt)} debt${queue.hasMore ? ' · more available' : ''}`
}

export function founderCovenantOperatorQueuePageSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'scanned' | 'caughtUp' | 'current' | 'failed' | 'hasMore' | 'totals'>,
): string {
  return `${queue.scanned} scanned · ${queue.caughtUp} caught up · ${queue.current} current · ${queue.failed} failed · ${founderCovenantOperatorQueueFreshnessCoverageText(queue.totals)}${queue.hasMore ? ' · next page ready' : ''}`
}

export function founderCovenantOperatorQueueWorkloadSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const evidenceFounders = queue.items.filter((item) => item.reviewReadiness.evidenceRequiredCount > 0).length
  const evidenceGaps = queue.items.reduce((sum, item) => sum + item.reviewReadiness.evidenceRequiredCount, 0)
  const blockedFounders = queue.items.filter((item) => item.pendingApprovalRequests.some((request) => request.blockers.length > 0)).length
  const approvalRequests = queue.items.reduce((sum, item) => sum + item.reviewReadiness.approvalRequestCount, 0)
  const recordReadyFounders = queue.items.filter((item) =>
    founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))
  ).length
  const overdueCleanupFounders = queue.items.filter((item) =>
    founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review'
  ).length

  return `${evidenceFounders} evidence queue · ${evidenceGaps} gaps · ${blockedFounders} blocked · ${approvalRequests} approvals · ${recordReadyFounders} record ready · ${overdueCleanupFounders} overdue cleanup`
}

export function founderCovenantOperatorQueueWorkflowSplitSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const blockedFounders = queue.items.filter((item) => item.pendingApprovalRequests.some((request) => request.blockers.length > 0)).length
  const recordReadyFounders = queue.items.filter((item) =>
    founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))
  ).length
  const overdueCleanupFounders = queue.items.filter((item) =>
    founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review'
  ).length
  return `Workflow split: ${blockedFounders} blocked approvals · ${recordReadyFounders} record ready · ${overdueCleanupFounders} overdue cleanup`
}

export function founderCovenantOperatorQueueFocusSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  return `Focus: ${founderCovenantOperatorQueueWorkloadSummary(queue)} · ${founderCovenantOperatorQueueWorkflowSplitSummary(queue)} · ${founderCovenantOperatorQueueCadenceReadySummary(queue)}`
}

export function founderCovenantOperatorQueueActionSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  return `Action: ${founderCovenantOperatorQueuePrimaryWorkloadText(queue).replace('Primary workload: ', '')} · ${founderCovenantOperatorQueueRecommendedActionText(queue).replace('Recommended next: ', '')}`
}

export function founderCovenantOperatorQueueActivityRiskMix(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): FounderCovenantOperatorQueueActivityRiskMix {
  return queue.items.reduce<FounderCovenantOperatorQueueActivityRiskMix>((totals, item) => {
    if (!item.activityReview.active) totals.inactive += 1
    if (!item.activityReview.useful) totals.usefulnessGaps += 1
    if (!item.activityReview.building) totals.buildGaps += 1
    if (!item.activityReview.staffed) totals.staffingGaps += 1
    if (item.economicExposure.outstandingDebt > 0) totals.debtRisk += 1
    if (item.activityReview.hospitalized) totals.hospitalized += 1
    if (item.activityReview.atRisk) totals.atRisk += 1
    return totals
  }, {
    inactive: 0,
    usefulnessGaps: 0,
    buildGaps: 0,
    staffingGaps: 0,
    debtRisk: 0,
    hospitalized: 0,
    atRisk: 0,
  })
}

export function founderCovenantOperatorQueueActivityRiskSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const risks = founderCovenantOperatorQueueActivityRiskMix(queue)
  return `Founder state: inactive ${risks.inactive} · usefulness gaps ${risks.usefulnessGaps} · build gaps ${risks.buildGaps} · staffing gaps ${risks.staffingGaps} · debt risk ${risks.debtRisk} · hospitalized ${risks.hospitalized} · at risk ${risks.atRisk}`
}

export function founderCovenantOperatorQueueTelegramDraftSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'totals'>,
): string {
  const { totals } = queue
  return `Telegram drafts: ${totals.warningDrafts} warning · ${totals.manualReviewDrafts} manual review · ${totals.pendingNotifications} total`
}

export function founderCovenantOperatorQueueCadenceReadyMix(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): FounderCovenantOperatorQueueCadenceReadyMix {
  return queue.items.reduce<FounderCovenantOperatorQueueCadenceReadyMix>((totals, item) => {
    if (!founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))) return totals
    if (item.weeklyReviewDue) totals.weekly += 1
    if (item.monthlyReviewDue) totals.monthly += 1
    return totals
  }, {
    weekly: 0,
    monthly: 0,
  })
}

export function founderCovenantOperatorQueueCadenceReadySummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const cadence = founderCovenantOperatorQueueCadenceReadyMix(queue)
  return `Cadence ready: ${cadence.weekly} weekly · ${cadence.monthly} monthly`
}

export function founderCovenantOperatorQueuePrimaryWorkloadText(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const evidenceGaps = queue.items.reduce((sum, item) => sum + item.reviewReadiness.evidenceRequiredCount, 0)
  const blockedFounders = queue.items.filter((item) => item.pendingApprovalRequests.some((request) => request.blockers.length > 0)).length
  const recordFounders = queue.items.filter((item) => founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))).length
  const overdueFounders = queue.items.filter((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review').length

  if (evidenceGaps === 0 && blockedFounders === 0 && overdueFounders === 0 && recordFounders === 0) {
    return 'Primary workload: monitor'
  }
  if (evidenceGaps >= blockedFounders && evidenceGaps >= overdueFounders && evidenceGaps >= recordFounders) {
    return 'Primary workload: collect evidence'
  }
  if (blockedFounders >= overdueFounders && blockedFounders >= recordFounders) {
    return 'Primary workload: clear blockers'
  }
  if (recordFounders >= overdueFounders) {
    return 'Primary workload: record due reviews'
  }
  return 'Primary workload: clear overdue reviews'
}

export function founderCovenantOperatorQueueRecommendedActionText(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const evidenceGaps = queue.items.reduce((sum, item) => sum + item.reviewReadiness.evidenceRequiredCount, 0)
  const blockedFounders = queue.items.filter((item) => item.pendingApprovalRequests.some((request) => request.blockers.length > 0)).length
  const recordFounders = queue.items.filter((item) => founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))).length
  const overdueFounders = queue.items.filter((item) => founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review').length

  if (evidenceGaps === 0 && blockedFounders === 0 && overdueFounders === 0 && recordFounders === 0) {
    return 'Recommended next: monitor current founders'
  }
  if (evidenceGaps >= blockedFounders && evidenceGaps >= overdueFounders && evidenceGaps >= recordFounders) {
    return 'Recommended next: attach missing manual evidence'
  }
  if (blockedFounders >= overdueFounders && blockedFounders >= recordFounders) {
    return 'Recommended next: review blocked approvals'
  }
  if (recordFounders >= overdueFounders) {
    return 'Recommended next: record due founder reviews'
  }
  return 'Recommended next: clear overdue founder reviews'
}

export function founderCovenantOperatorQueueActionMix(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): FounderCovenantOperatorQueueActionMix {
  return queue.items.reduce<FounderCovenantOperatorQueueActionMix>((totals, item) => {
    const recommendation = founderCovenantOperatorQueueRecommendedNextText(item)
    if (recommendation === 'Attach missing manual evidence') totals.evidence += 1
    else if (recommendation === 'Review blocked approvals') totals.blocked += 1
    else if (recommendation === 'Clear overdue review') totals.overdue += 1
    else if (founderCovenantOperatorQueueIsRecordRecommendation(recommendation)) totals.record += 1
    else totals.monitor += 1
    return totals
  }, {
    evidence: 0,
    blocked: 0,
    overdue: 0,
    record: 0,
    monitor: 0,
  })
}

export function founderCovenantOperatorQueueItemSummary(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'covenantStatus'
    | 'manualReviewRequired'
    | 'reviewFreshness'
    | 'activityReview'
    | 'economicExposure'
    | 'signalCounts'
    | 'blockerCount'
    | 'transactionsAdded'
  > & Partial<Pick<
    RealityFounderCovenantReviewQueueItem,
    'reviewReadiness' | 'pendingApprovalRequests' | 'overdue' | 'manualActions' | 'weeklyReviewDue' | 'monthlyReviewDue'
  >>,
): string {
  const status = founderCovenantStatusLabel(item.covenantStatus)
  const review = item.manualReviewRequired ? 'manual review' : 'watch'
  const base = `${status} · ${review} · ${founderCovenantOperatorQueueReviewFreshnessLabel(item.reviewFreshness)} · score ${item.activityReview.score}/100 · ${formatMoney(item.economicExposure.outstandingDebt)} debt · ${item.signalCounts.warning} warning${item.signalCounts.warning === 1 ? '' : 's'} · ${item.signalCounts.critical} critical · ${item.blockerCount} blocker${item.blockerCount === 1 ? '' : 's'} · ${item.transactionsAdded} tx`
  if (
    !item.reviewReadiness ||
    !item.pendingApprovalRequests ||
    item.overdue === undefined ||
    !item.manualActions ||
    item.weeklyReviewDue === undefined ||
    item.monthlyReviewDue === undefined
  ) {
    return base
  }
  const recommended = founderCovenantOperatorQueueRecommendedNextText({
    reviewReadiness: item.reviewReadiness,
    pendingApprovalRequests: item.pendingApprovalRequests,
    overdue: item.overdue,
    manualActions: item.manualActions,
    weeklyReviewDue: item.weeklyReviewDue,
    monthlyReviewDue: item.monthlyReviewDue,
  })
  return `${base} · ${recommended}`
}

export function founderCovenantOperatorQueueItemTitle(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'founderNumber' | 'areaLabel'>,
): string {
  return `#${String(item.founderNumber).padStart(4, '0')} · ${item.areaLabel}`
}

export function founderCovenantOperatorQueueItemStatusClass(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'manualReviewRequired' | 'covenantStatus' | 'overdue' | 'activityReview'>,
): FounderCovenantOperatorQueueStatusClass {
  if (item.manualReviewRequired || item.covenantStatus === 'manual_review') return 'manual_review'
  if (item.overdue || item.covenantStatus === 'watch' || item.activityReview.atRisk) return 'watch'
  return 'met'
}

export function founderCovenantOperatorQueueItemStatusLabel(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'manualReviewRequired' | 'covenantStatus' | 'overdue' | 'activityReview'>,
): string {
  if (item.manualReviewRequired || item.covenantStatus === 'manual_review') return 'Manual'
  if (item.overdue) return 'Due'
  if (item.covenantStatus === 'watch' || item.activityReview.atRisk) return 'Watch'
  return 'Tracked'
}

export function founderCovenantOperatorQueueItemDateSummary(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'scanStatus'
    | 'checkedAt'
    | 'lastReviewAt'
    | 'reviewFreshness'
    | 'nextWeeklyReviewAt'
    | 'nextMonthlyReviewAt'
    | 'weeklyReviewDue'
    | 'monthlyReviewDue'
  >,
): string {
  const lastReview = item.lastReviewAt
    ? `${shortDate(item.lastReviewAt)} (${founderCovenantOperatorQueueReviewFreshnessLabel(item.reviewFreshness)})`
    : 'none'
  const weekly = item.weeklyReviewDue ? 'weekly due' : `weekly ${shortDate(item.nextWeeklyReviewAt)}`
  const monthly = item.monthlyReviewDue ? 'monthly due' : `monthly ${shortDate(item.nextMonthlyReviewAt)}`
  return `${founderCovenantOperatorQueueScanStatusLabel(item.scanStatus)} · checked ${shortDate(item.checkedAt)} · last ${lastReview} · ${weekly} · ${monthly}`
}

export function founderCovenantOperatorQueueSignalText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'signalKinds'>,
): string {
  return item.signalKinds.length > 0 ? item.signalKinds.join(', ') : 'none'
}

export function founderCovenantOperatorQueueReviewRows(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): FounderCovenantOperatorQueueReviewRow[] {
  return queue.items
    .map((item) => ({
      key: `${item.areaId}:${item.founderCitizenId}`,
      title: founderCovenantOperatorQueueItemTitle(item),
      areaId: item.areaId,
      founderCitizenId: item.founderCitizenId,
      reviewFreshness: item.reviewFreshness,
      canRecordReview: item.reviewQueue.recordReviewEnabled,
      statusClass: founderCovenantOperatorQueueItemStatusClass(item),
      statusLabel: founderCovenantOperatorQueueItemStatusLabel(item),
      summary: founderCovenantOperatorQueueItemSummary(item),
      dateSummary: founderCovenantOperatorQueueItemDateSummary(item),
      latestReviewText: founderCovenantOperatorQueueLatestReviewText(item),
      activitySignalText: founderCovenantOperatorQueueActivitySignalText(item),
      economicExposureText: founderCovenantOperatorQueueEconomicExposureText(item),
      stageText: founderCovenantOperatorQueueStageText(item),
      reviewReadinessText: founderCovenantOperatorQueueReviewReadinessText(item),
      checklistText: founderCovenantOperatorQueueChecklistText(item),
      evidenceInputText: founderCovenantOperatorQueueEvidenceInputText(item),
      evidenceNextText: founderCovenantOperatorQueueEvidenceNextText(item),
      recommendedNextText: founderCovenantOperatorQueueRecommendedNextText(item),
      recommendedNextTone: founderCovenantOperatorQueueRecommendedNextTone(item),
      manualActionText: founderCovenantOperatorQueueManualActionText(item),
      approvalRequestText: founderCovenantOperatorQueueApprovalRequestText(item),
      notificationDraftText: founderCovenantOperatorQueueNotificationDraftText(item),
      telegramOutputText: founderCovenantOperatorQueueTelegramOutputText(item),
      telegramOutputTone: founderCovenantOperatorQueueTelegramOutputTone(item),
      signalText: founderCovenantOperatorQueueSignalText(item),
      priorityScore: founderCovenantOperatorQueuePriorityScore(item),
      priorityReasons: founderCovenantOperatorQueuePriorityReasons(item),
    }))
    .sort((a, b) =>
      b.priorityScore - a.priorityScore ||
      founderCovenantOperatorQueueTelegramSortScore(b.telegramOutputText) - founderCovenantOperatorQueueTelegramSortScore(a.telegramOutputText) ||
      a.title.localeCompare(b.title)
    )
}

export function founderCovenantOperatorQueueFilteredReviewRows(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort = 'priority',
): FounderCovenantOperatorQueueReviewRow[] {
  const items = queue.items.filter((item) => founderCovenantOperatorQueueMatchesFilter(item, filter))

  const rows = founderCovenantOperatorQueueReviewRows({ items })
  if (sort === 'priority') return rows
  if (sort === 'coverage') {
    return [...rows].sort((a, b) =>
      founderCovenantOperatorQueueCoverageSortScore(b.reviewFreshness) - founderCovenantOperatorQueueCoverageSortScore(a.reviewFreshness) ||
      b.priorityScore - a.priorityScore ||
      founderCovenantOperatorQueueTelegramSortScore(b.telegramOutputText) - founderCovenantOperatorQueueTelegramSortScore(a.telegramOutputText) ||
      a.title.localeCompare(b.title)
    )
  }
  if (sort === 'action') {
    return [...rows].sort((a, b) =>
      founderCovenantOperatorQueueRecommendedNextSortScore(a.recommendedNextText) - founderCovenantOperatorQueueRecommendedNextSortScore(b.recommendedNextText) ||
      b.priorityScore - a.priorityScore ||
      founderCovenantOperatorQueueTelegramSortScore(b.telegramOutputText) - founderCovenantOperatorQueueTelegramSortScore(a.telegramOutputText) ||
      a.title.localeCompare(b.title)
    )
  }
  return [...rows].sort((a, b) => a.title.localeCompare(b.title))
}

export function founderCovenantOperatorQueueFilterSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort = 'priority',
): string {
  const count = founderCovenantOperatorQueueFilteredReviewRows(queue, filter, sort).length
  const sliceTotals = founderCovenantOperatorQueueSliceTotals(queue, filter)
  const freshness = founderCovenantOperatorQueueFreshnessCoverageText(sliceTotals)
  switch (filter) {
    case 'all':
      return `${count} founder${count === 1 ? '' : 's'} in current page · ${freshness}`
    case 'never_reviewed':
      return `${count} founder${count === 1 ? '' : 's'} never reviewed · ${freshness}`
    case 'stale_reviewed':
      return `${count} founder${count === 1 ? '' : 's'} stale reviewed · ${freshness}`
    case 'stale_weekly_due':
      return `${count} founder${count === 1 ? '' : 's'} stale weekly due · ${freshness}`
    case 'stale_monthly_due':
      return `${count} founder${count === 1 ? '' : 's'} stale monthly due · ${freshness}`
    case 'weekly_due':
      return `${count} founder${count === 1 ? '' : 's'} weekly review due · ${freshness}`
    case 'monthly_due':
      return `${count} founder${count === 1 ? '' : 's'} monthly review due · ${freshness}`
    case 'fresh_reviewed':
      return `${count} founder${count === 1 ? '' : 's'} fresh reviewed · ${freshness}`
    case 'manual_review':
      return `${count} founder${count === 1 ? '' : 's'} need manual review · ${freshness}`
    case 'needs_evidence':
      return `${count} founder${count === 1 ? '' : 's'} need manual evidence · ${freshness}`
    case 'action_evidence':
      return `${count} founder${count === 1 ? '' : 's'} next need evidence · ${freshness}`
    case 'action_blocked':
      return `${count} founder${count === 1 ? '' : 's'} next need approval review · ${freshness}`
    case 'action_overdue':
      return `${count} founder${count === 1 ? '' : 's'} next need overdue cleanup · ${freshness}`
    case 'action_record':
      return `${count} founder${count === 1 ? '' : 's'} next need record review · ${freshness}`
    case 'action_monitor':
      return `${count} founder${count === 1 ? '' : 's'} next need monitoring only · ${freshness}`
    case 'overdue':
      return `${count} founder${count === 1 ? '' : 's'} overdue · ${freshness}`
    case 'blocked':
      return `${count} founder${count === 1 ? '' : 's'} blocked by workflow gaps · ${freshness}`
    case 'hospitalized':
      return `${count} founder${count === 1 ? '' : 's'} hospitalized · ${freshness}`
    case 'inactive':
      return `${count} founder${count === 1 ? '' : 's'} inactive · ${freshness}`
    case 'debt_risk':
      return `${count} founder${count === 1 ? '' : 's'} in debt risk · ${freshness}`
    case 'at_risk':
      return `${count} founder${count === 1 ? '' : 's'} at risk · ${freshness}`
    case 'telegram_ready':
      return `${count} founder${count === 1 ? '' : 's'} Telegram ready · ${freshness}`
    case 'scan_anomaly':
      return `${count} founder${count === 1 ? '' : 's'} with scan anomalies · ${freshness}`
  }
}

export function founderCovenantOperatorQueueFilterCountsSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
): string {
  const all = founderCovenantOperatorQueueFilteredReviewRows(queue, 'all').length
  const neverReviewed = founderCovenantOperatorQueueFilteredReviewRows(queue, 'never_reviewed').length
  const staleReviewed = founderCovenantOperatorQueueFilteredReviewRows(queue, 'stale_reviewed').length
  const staleWeeklyDue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'stale_weekly_due').length
  const staleMonthlyDue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'stale_monthly_due').length
  const weeklyDue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'weekly_due').length
  const monthlyDue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'monthly_due').length
  const freshReviewed = founderCovenantOperatorQueueFilteredReviewRows(queue, 'fresh_reviewed').length
  const manual = founderCovenantOperatorQueueFilteredReviewRows(queue, 'manual_review').length
  const evidence = founderCovenantOperatorQueueFilteredReviewRows(queue, 'needs_evidence').length
  const nextEvidence = founderCovenantOperatorQueueFilteredReviewRows(queue, 'action_evidence').length
  const nextBlocked = founderCovenantOperatorQueueFilteredReviewRows(queue, 'action_blocked').length
  const nextOverdue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'action_overdue').length
  const nextRecord = founderCovenantOperatorQueueFilteredReviewRows(queue, 'action_record').length
  const nextMonitor = founderCovenantOperatorQueueFilteredReviewRows(queue, 'action_monitor').length
  const overdue = founderCovenantOperatorQueueFilteredReviewRows(queue, 'overdue').length
  const blocked = founderCovenantOperatorQueueFilteredReviewRows(queue, 'blocked').length
  const hospital = founderCovenantOperatorQueueFilteredReviewRows(queue, 'hospitalized').length
  const inactive = founderCovenantOperatorQueueFilteredReviewRows(queue, 'inactive').length
  const debtRisk = founderCovenantOperatorQueueFilteredReviewRows(queue, 'debt_risk').length
  const atRisk = founderCovenantOperatorQueueFilteredReviewRows(queue, 'at_risk').length
  const telegramReady = founderCovenantOperatorQueueFilteredReviewRows(queue, 'telegram_ready').length
  const scan = founderCovenantOperatorQueueFilteredReviewRows(queue, 'scan_anomaly').length
  return `All ${all} · Never ${neverReviewed} · Stale ${staleReviewed} · Stale week ${staleWeeklyDue} · Stale month ${staleMonthlyDue} · Weekly due ${weeklyDue} · Monthly due ${monthlyDue} · Fresh ${freshReviewed} · Manual ${manual} · Evidence ${evidence} · Next evidence ${nextEvidence} · Next blocked ${nextBlocked} · Next overdue ${nextOverdue} · Next record ${nextRecord} · Next monitor ${nextMonitor} · Overdue ${overdue} · Blocked ${blocked} · Hospital ${hospital} · Inactive ${inactive} · Debt ${debtRisk} · Risk ${atRisk} · Telegram ${telegramReady} · Scan ${scan}`
}

export function founderCovenantOperatorQueueTelegramWorkSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
  filter: FounderCovenantOperatorQueueFilter,
  sort: FounderCovenantOperatorQueueSort = 'priority',
): string {
  const rows = founderCovenantOperatorQueueFilteredReviewRows(queue, filter, sort)
  const manual = rows.filter((row) => row.telegramOutputText === 'Telegram manual + warning' || row.telegramOutputText === 'Telegram manual').length
  const warning = rows.filter((row) => row.telegramOutputText === 'Telegram manual + warning' || row.telegramOutputText === 'Telegram warning').length
  const update = rows.filter((row) => row.telegramOutputText !== 'Telegram none').length
  return `Telegram work: ${update} review update${update === 1 ? '' : 's'} · ${manual} manual draft${manual === 1 ? '' : 's'} · ${warning} warning draft${warning === 1 ? '' : 's'}`
}

export function founderCovenantOperatorQueueSliceTotals(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'items'>,
  filter: FounderCovenantOperatorQueueFilter,
): FounderCovenantOperatorQueueSliceTotals {
  const items = queue.items.filter((item) => founderCovenantOperatorQueueMatchesFilter(item, filter))

  return {
    founders: items.length,
    manualReviewRequired: items.filter((item) => item.manualReviewRequired).length,
    neverReviewed: items.filter((item) => item.lastReviewAt === null).length,
    freshReviewed: items.filter((item) => item.reviewFreshness === 'fresh').length,
    staleReviewed: items.filter((item) => item.reviewFreshness === 'stale').length,
    staleWeeklyDue: items.filter((item) => item.reviewFreshness === 'stale' && item.weeklyReviewDue && !item.monthlyReviewDue).length,
    staleMonthlyDue: items.filter((item) => item.reviewFreshness === 'stale' && item.monthlyReviewDue).length,
    scanAnomalies: items.filter((item) => item.scanStatus === 'invalid' || item.scanStatus === 'unavailable').length,
    weeklyDue: items.filter((item) => item.weeklyReviewDue).length,
    monthlyDue: items.filter((item) => item.monthlyReviewDue).length,
    overdue: items.filter((item) => item.overdue).length,
    hospitalized: items.filter((item) => item.activityReview.hospitalized).length,
    indebted: items.filter((item) => item.economicExposure.outstandingDebt > 0).length,
    blockers: items.reduce((sum, item) => sum + item.blockerCount, 0),
    active: items.filter((item) => item.activityReview.active).length,
    useful: items.filter((item) => item.activityReview.useful).length,
    building: items.filter((item) => item.activityReview.building).length,
    staffed: items.filter((item) => item.activityReview.staffed).length,
    atRisk: items.filter((item) => item.activityReview.atRisk).length,
  }
}

function founderCovenantOperatorQueueReviewFreshnessLabel(
  freshness: RealityFounderCovenantReviewQueueItem['reviewFreshness'],
): string {
  switch (freshness) {
    case 'never':
      return 'never reviewed'
    case 'fresh':
      return 'fresh review'
    case 'stale':
      return 'stale review'
  }
}

function founderCovenantOperatorQueueMatchesFilter(
  item: RealityFounderCovenantReviewQueueDashboard['items'][number],
  filter: FounderCovenantOperatorQueueFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'never_reviewed':
      return item.reviewFreshness === 'never'
    case 'stale_reviewed':
      return item.reviewFreshness === 'stale'
    case 'stale_weekly_due':
      return item.reviewFreshness === 'stale' && item.weeklyReviewDue && !item.monthlyReviewDue
    case 'stale_monthly_due':
      return item.reviewFreshness === 'stale' && item.monthlyReviewDue
    case 'weekly_due':
      return item.weeklyReviewDue
    case 'monthly_due':
      return item.monthlyReviewDue
    case 'fresh_reviewed':
      return item.reviewFreshness === 'fresh'
    case 'manual_review':
      return item.manualReviewRequired || item.covenantStatus === 'manual_review'
    case 'needs_evidence':
      return item.reviewReadiness.evidenceRequiredCount > 0
    case 'action_evidence':
      return founderCovenantOperatorQueueRecommendedNextText(item) === 'Attach missing manual evidence'
    case 'action_blocked':
      return founderCovenantOperatorQueueRecommendedNextText(item) === 'Review blocked approvals'
    case 'action_overdue':
      return founderCovenantOperatorQueueRecommendedNextText(item) === 'Clear overdue review'
    case 'action_record':
      return founderCovenantOperatorQueueIsRecordRecommendation(founderCovenantOperatorQueueRecommendedNextText(item))
    case 'action_monitor':
      return founderCovenantOperatorQueueRecommendedNextText(item) === 'Monitor founder'
    case 'overdue':
      return item.overdue
    case 'blocked':
      return item.pendingApprovalRequests.some((request) => request.blockers.length > 0)
    case 'hospitalized':
      return item.activityReview.hospitalized
    case 'inactive':
      return !item.activityReview.active
    case 'debt_risk':
      return item.economicExposure.outstandingDebt > 0
    case 'at_risk':
      return item.activityReview.atRisk
    case 'telegram_ready':
      return item.pendingNotificationDrafts.length > 0 || item.pendingApprovalRequests.some((request) => request.kind === 'send_warning')
    case 'scan_anomaly':
      return item.scanStatus === 'invalid' || item.scanStatus === 'unavailable'
  }
}

function founderCovenantOperatorQueueRecordRecommendationLabel(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'weeklyReviewDue' | 'monthlyReviewDue'>,
): string {
  if (item.monthlyReviewDue) return 'Record monthly review'
  if (item.weeklyReviewDue) return 'Record weekly review'
  return 'Record review'
}

function founderCovenantOperatorQueueIsRecordRecommendation(recommendation: string): boolean {
  return recommendation === 'Record review' ||
    recommendation === 'Record weekly review' ||
    recommendation === 'Record monthly review'
}

function founderCovenantOperatorQueueFreshnessCoverageText(
  totals: Pick<FounderCovenantOperatorQueueSliceTotals, 'neverReviewed' | 'freshReviewed' | 'staleReviewed'>,
): string {
  return `${totals.neverReviewed} never · ${totals.staleReviewed} stale · ${totals.freshReviewed} fresh`
}

function founderCovenantOperatorQueueCoverageSortScore(
  freshness: RealityFounderCovenantReviewQueueItem['reviewFreshness'],
): number {
  switch (freshness) {
    case 'never':
      return 3
    case 'stale':
      return 2
    case 'fresh':
      return 1
  }
}

export function founderCovenantOperatorQueueLatestReviewText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'latestReview'>,
): string | null {
  if (!item.latestReview) return null
  return `Latest review ${shortDate(item.latestReview.reviewedAt)} · ${item.latestReview.reviewerId} · ${item.latestReview.summary}`
}

export function founderCovenantOperatorQueueActivitySignalText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'activitySignals'>,
): string {
  if (item.activitySignals.length === 0) return 'none'
  const manual = item.activitySignals.filter((signal) => signal.status === 'manual_review')
  const watch = item.activitySignals.filter((signal) => signal.status === 'watch')
  const met = item.activitySignals.filter((signal) => signal.status === 'met')
  const parts: string[] = []
  if (manual.length > 0) parts.push(`Manual: ${manual.map(founderCovenantActivitySignalLabel).join(', ')}`)
  if (watch.length > 0) parts.push(`Watch: ${watch.map(founderCovenantActivitySignalLabel).join(', ')}`)
  if (met.length > 0) parts.push(`Met: ${met.map(founderCovenantActivitySignalLabel).join(', ')}`)
  return parts.join(' · ')
}

function founderCovenantActivitySignalLabel(
  signal: RealityFounderCovenantReviewQueueItem['activitySignals'][number],
): string {
  return `${signal.label} ${signal.value ? 'yes' : 'no'}`
}

export function founderCovenantOperatorQueueEconomicExposureText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'economicExposure'>,
): string {
  const exposure = item.economicExposure
  const insured = exposure.insured ? 'insured' : 'uninsured'
  const availability = exposure.hospitalized ? 'hospitalized' : 'available'
  return [
    `Founder ${formatMoney(exposure.founderCash)}`,
    `debt ${formatMoney(exposure.outstandingDebt)} (${exposure.debtCount})`,
    `businesses ${exposure.businessCount} / ${formatMoney(exposure.businessCash)}`,
    `unstaffed ${exposure.unstaffedBusinessCount}`,
    insured,
    availability,
    'game credits only',
  ].join(' · ')
}

export function founderCovenantOperatorQueueStageText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'stages'>,
): string {
  if (item.stages.length === 0) return 'none'
  const current = item.stages.find((stage) => stage.status === 'current')
  const suggested = item.stages.filter((stage) => stage.status === 'recommended')
  const locked = item.stages.filter((stage) => stage.status === 'locked')
  const parts: string[] = []
  if (current) parts.push(`Current: ${current.label}`)
  if (suggested.length > 0) parts.push(`Suggested: ${suggested.map((stage) => stage.label).join(', ')}`)
  if (locked.length > 0) parts.push(`Locked: ${locked.map((stage) => stage.label).join(', ')}`)
  return parts.join(' · ')
}

export function founderCovenantOperatorQueueReviewReadinessText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'reviewReadiness'>,
): string {
  const readiness = item.reviewReadiness
  const details: string[] = []
  if (readiness.evidenceRequiredCount > 0) {
    details.push(`${readiness.evidenceRequiredCount} evidence gap${readiness.evidenceRequiredCount === 1 ? '' : 's'}`)
  }
  if (readiness.approvalRequestCount > 0) {
    details.push(`${readiness.approvalRequestCount} approval request${readiness.approvalRequestCount === 1 ? '' : 's'}`)
  }
  if (readiness.blockerCount > 0) {
    details.push(`${readiness.blockerCount} blocker${readiness.blockerCount === 1 ? '' : 's'}`)
  }
  if (readiness.overdue) details.push('overdue')
  const detailText = details.length > 0 ? ` · ${details.join(', ')}` : ''
  return `${readiness.label}: ${readiness.summary}${detailText}`
}

export function founderCovenantOperatorQueueChecklistText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'reviewChecklist'>,
): string {
  if (item.reviewChecklist.length === 0) return 'none'
  const manual = item.reviewChecklist.filter((entry) => entry.status === 'manual_review')
  const watch = item.reviewChecklist.filter((entry) => entry.status === 'watch')
  if (manual.length === 0 && watch.length === 0) return 'all met'
  const parts: string[] = []
  if (manual.length > 0) parts.push(`Manual: ${manual.map((entry) => entry.label).join(', ')}`)
  if (watch.length > 0) parts.push(`Watch: ${watch.map((entry) => entry.label).join(', ')}`)
  return parts.join(' · ')
}

export function founderCovenantOperatorQueueEvidenceInputText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'reviewInputs'>,
): string {
  const manual = item.reviewInputs.filter((input) => input.manualEvidenceRequired || input.status === 'manual_needed')
  if (manual.length > 0) return manual.map((input) => input.label).join(', ')
  const watch = item.reviewInputs.filter((input) => input.status === 'watch')
  return watch.length > 0 ? `Watch: ${watch.map((input) => input.label).join(', ')}` : 'complete'
}

export function founderCovenantOperatorQueueEvidenceNextText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'reviewInputs'>,
): string {
  const manual = item.reviewInputs.filter((input) => input.manualEvidenceRequired || input.status === 'manual_needed')
  if (manual.length === 0) return 'No manual evidence queued.'
  const [first, second] = manual
  if (!second) return `Next: ${first.label}`
  const remaining = manual.length - 2
  return remaining > 0
    ? `Next: ${first.label}, ${second.label} · ${remaining} more`
    : `Next: ${first.label}, ${second.label}`
}

export function founderCovenantOperatorQueueRecommendedNextText(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    'reviewReadiness' | 'pendingApprovalRequests' | 'overdue' | 'manualActions' | 'weeklyReviewDue' | 'monthlyReviewDue'
  >,
): string {
  if (item.reviewReadiness.evidenceRequiredCount > 0) {
    return 'Attach missing manual evidence'
  }
  if (item.pendingApprovalRequests.some((request) => request.blockers.length > 0)) {
    return 'Review blocked approvals'
  }
  const suggested = item.manualActions.find((action) => action.recommended)
  if (suggested) {
    if (suggested.kind === 'record_review') {
      return founderCovenantOperatorQueueRecordRecommendationLabel(item)
    }
    return founderCovenantManualActionKindLabel(suggested.kind)
  }
  if (item.overdue) {
    return 'Clear overdue review'
  }
  return 'Monitor founder'
}

export function founderCovenantOperatorQueueRecommendedNextTone(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    'reviewReadiness' | 'pendingApprovalRequests' | 'overdue' | 'manualActions' | 'weeklyReviewDue' | 'monthlyReviewDue'
  >,
): FounderCovenantReviewTone {
  if (item.reviewReadiness.evidenceRequiredCount > 0) {
    return 'critical'
  }
  if (item.pendingApprovalRequests.some((request) => request.blockers.length > 0)) {
    return 'critical'
  }
  if (item.overdue) {
    return 'warning'
  }
  if (item.manualActions.some((action) => action.recommended)) {
    return 'warning'
  }
  return 'stable'
}

function founderCovenantOperatorQueueRecommendedNextSortScore(recommendation: string): number {
  switch (recommendation) {
    case 'Attach missing manual evidence':
      return 1
    case 'Review blocked approvals':
      return 2
    case 'Clear overdue review':
      return 3
    case 'Record weekly review':
      return 4
    case 'Record monthly review':
      return 4
    case 'Record review':
      return 4
    case 'Monitor founder':
      return 5
    default:
      return 6
  }
}

function founderCovenantOperatorQueueTelegramSortScore(output: string): number {
  switch (output) {
    case 'Telegram manual + warning':
      return 3
    case 'Telegram manual':
      return 2
    case 'Telegram warning':
      return 1
    default:
      return 0
  }
}

export function founderCovenantOperatorQueueManualActionText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'manualActions'>,
): string {
  const suggested = item.manualActions.filter((action) => action.recommended)
  if (suggested.length === 0) return 'none'
  return suggested
    .map((action) => {
      const status = action.kind === 'record_review' ? 'evidence-only' : 'locked'
      return `${founderCovenantManualActionKindLabel(action.kind)} ${status}`
    })
    .join(', ')
}

export function founderCovenantOperatorQueueApprovalRequestText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingApprovalRequests'>,
): string {
  if (item.pendingApprovalRequests.length === 0) return 'none'
  return item.pendingApprovalRequests
    .map((request) => {
      const blockerText = request.blockers.length === 0
        ? 'no blockers'
        : `${request.blockers.length} blocker${request.blockers.length === 1 ? '' : 's'}`
      return `${founderCovenantManualActionKindLabel(request.kind)} locked (${blockerText})`
    })
    .join(', ')
}

export function founderCovenantOperatorQueueNotificationDraftText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingNotificationDrafts'>,
): string {
  if (item.pendingNotificationDrafts.length === 0) return 'none'
  return item.pendingNotificationDrafts
    .map((draft) => `${founderCovenantNotificationKindLabel(draft.kind)} locked (${founderCovenantNotificationChannelLabel(draft.channel)})`)
    .join(', ')
}

export function founderCovenantOperatorQueueTelegramOutputText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingNotificationDrafts' | 'pendingApprovalRequests'>,
): string {
  const manual = item.pendingNotificationDrafts.some((draft) => draft.kind === 'manual_review_required')
  const warning = item.pendingApprovalRequests.some((request) => request.kind === 'send_warning')
  if (manual && warning) return 'Telegram manual + warning'
  if (manual) return 'Telegram manual'
  if (warning) return 'Telegram warning'
  return 'Telegram none'
}

export function founderCovenantOperatorQueueTelegramOutputTone(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingNotificationDrafts' | 'pendingApprovalRequests'>,
): FounderCovenantReviewTone {
  const manual = item.pendingNotificationDrafts.some((draft) => draft.kind === 'manual_review_required')
  const warning = item.pendingApprovalRequests.some((request) => request.kind === 'send_warning')
  if (manual && warning) return 'warning'
  if (manual) return 'warning'
  if (warning) return 'critical'
  return 'stable'
}

export function founderCovenantOperatorQueuePriorityScore(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'manualReviewRequired'
    | 'covenantStatus'
    | 'overdue'
    | 'reviewFreshness'
    | 'scanStatus'
    | 'activityReview'
    | 'economicExposure'
    | 'reviewReadiness'
    | 'signalCounts'
    | 'blockerCount'
  >,
): number {
  let score = 0
  if (item.manualReviewRequired) score += 500
  if (item.covenantStatus === 'manual_review') score += 250
  if (item.covenantStatus === 'watch') score += 120
  if (item.overdue) score += 90
  if (item.reviewFreshness === 'never') score += 85
  if (item.reviewFreshness === 'stale') score += 35
  if (item.activityReview.hospitalized) score += 180
  if (item.activityReview.atRisk) score += 140
  if (!item.activityReview.active) score += 60
  if (!item.activityReview.useful) score += 50
  if (!item.activityReview.building) score += 50
  if (!item.activityReview.staffed) score += 40
  score += Math.min(120, item.reviewReadiness.evidenceRequiredCount * 20)
  if (item.reviewReadiness.blockerCount > 0 && item.reviewReadiness.evidenceRequiredCount === 0) {
    score += 90
  }
  if (item.economicExposure.outstandingDebt > 0) {
    score += Math.min(140, Math.ceil(item.economicExposure.outstandingDebt / 50))
  }
  score += Math.min(120, item.economicExposure.unstaffedBusinessCount * 40)
  score += item.signalCounts.critical * 70
  score += item.signalCounts.warning * 25
  score += Math.min(120, item.blockerCount * 15)
  if (item.scanStatus === 'invalid' || item.scanStatus === 'unavailable') score += 80
  return score
}

export function founderCovenantOperatorQueuePriorityReasons(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'manualReviewRequired'
    | 'covenantStatus'
    | 'overdue'
    | 'reviewFreshness'
    | 'scanStatus'
    | 'activityReview'
    | 'economicExposure'
    | 'reviewReadiness'
    | 'signalCounts'
    | 'blockerCount'
  >,
): string[] {
  const reasons: string[] = []
  if (item.manualReviewRequired || item.covenantStatus === 'manual_review') reasons.push('manual review')
  if (item.reviewFreshness === 'never') reasons.push('never reviewed')
  if (item.reviewFreshness === 'stale') reasons.push('stale review')
  if (item.overdue) reasons.push('overdue')
  if (item.activityReview.hospitalized) reasons.push('hospitalized')
  if (item.activityReview.atRisk) reasons.push('at risk')
  if (!item.activityReview.active) reasons.push('inactive')
  if (!item.activityReview.useful) reasons.push('usefulness missing')
  if (!item.activityReview.building) reasons.push('no build evidence')
  if (!item.activityReview.staffed) reasons.push('staffing gap')
  if (item.reviewReadiness.evidenceRequiredCount > 0) {
    reasons.push(`${item.reviewReadiness.evidenceRequiredCount} evidence gap${item.reviewReadiness.evidenceRequiredCount === 1 ? '' : 's'}`)
  }
  if (item.reviewReadiness.blockerCount > 0 && item.reviewReadiness.evidenceRequiredCount === 0) {
    reasons.push('approval blockers')
  }
  if (item.economicExposure.outstandingDebt > 0) {
    reasons.push(`${formatMoney(item.economicExposure.outstandingDebt)} debt`)
  }
  if (item.economicExposure.unstaffedBusinessCount > 0) {
    reasons.push(`${item.economicExposure.unstaffedBusinessCount} unstaffed business${item.economicExposure.unstaffedBusinessCount === 1 ? '' : 'es'}`)
  }
  if (item.signalCounts.critical > 0) reasons.push(`${item.signalCounts.critical} critical signal${item.signalCounts.critical === 1 ? '' : 's'}`)
  if (item.signalCounts.warning > 0) reasons.push(`${item.signalCounts.warning} warning signal${item.signalCounts.warning === 1 ? '' : 's'}`)
  if (item.blockerCount > 0) reasons.push(`${item.blockerCount} blocker${item.blockerCount === 1 ? '' : 's'}`)
  if (item.scanStatus === 'invalid' || item.scanStatus === 'unavailable') reasons.push(`scan ${item.scanStatus}`)
  return reasons.length > 0 ? reasons : ['tracked']
}

function founderCovenantOperatorQueueScanStatusLabel(
  status: RealityFounderCovenantReviewQueueItem['scanStatus'],
): string {
  switch (status) {
    case 'caught_up':
      return 'caught up'
    case 'current':
      return 'current'
    case 'invalid':
      return 'invalid'
    case 'unavailable':
      return 'unavailable'
  }
}

function shortDate(value: string): string {
  return value.slice(0, 10)
}

function founderCovenantNextActionLabel(
  nextAction: NonNullable<FounderCovenantReviewHistoryItem['decision']>['nextAction'],
): string {
  switch (nextAction) {
    case 'claim_area':
      return 'Claim area'
    case 'none':
      return 'No action'
    case 'warn_founder':
      return 'Warn founder'
    case 'manual_review':
      return 'Manual review'
  }
}

function founderCovenantReviewQueueNextStepLabel(nextStep: FounderCovenantReviewQueue['nextStep']): string {
  switch (nextStep) {
    case 'record_review':
      return 'Record review'
    case 'main_founder_approval':
      return 'Main founder approval'
    case 'monitor':
      return 'Monitor'
  }
}

function founderCovenantNotificationKindLabel(kind: FounderCovenantReviewQueue['pendingNotificationKinds'][number]): string {
  switch (kind) {
    case 'founder_warning':
      return 'Founder warning'
    case 'manual_review_required':
      return 'Manual review'
  }
}

function founderCovenantNotificationChannelLabel(channel: 'telegram'): string {
  switch (channel) {
    case 'telegram':
      return 'Telegram'
  }
}

export function founderCovenantReviewScheduleItems(
  schedule: FounderCovenantReviewSchedule | null,
  checkedAt: number,
): FounderCovenantScheduleItem[] {
  if (!schedule) return []
  return [{
    key: 'last',
    label: 'Last',
    value: schedule.lastReviewAt === null ? 'none' : `${durationLabel(checkedAt - schedule.lastReviewAt)} ago`,
    tone: schedule.lastReviewAt === null ? 'warning' : 'stable',
  }, {
    key: 'weekly',
    label: 'Weekly',
    value: schedule.weeklyReviewDue ? 'due' : durationLabel(schedule.nextWeeklyReviewAt - checkedAt),
    tone: schedule.weeklyReviewDue ? 'warning' : 'stable',
  }, {
    key: 'monthly',
    label: 'Monthly',
    value: schedule.monthlyReviewDue ? 'due' : durationLabel(schedule.nextMonthlyReviewAt - checkedAt),
    tone: schedule.monthlyReviewDue ? 'warning' : 'stable',
  }]
}

export function founderCovenantNotificationDraftText(draft: FounderCovenantNotificationDraft): string {
  return `${channelLabel(draft.channel)} / ${founderCovenantAuthorityRoleLabel(draft.authorityGate.requiredRole)} approval`
}

export function founderCovenantNotificationDraftGateText(
  draft: Pick<FounderCovenantNotificationDraft, 'authorityGate' | 'requiresApproval' | 'sendEnabled'>,
): string {
  const role = founderCovenantAuthorityRoleLabel(draft.authorityGate.requiredRole)
  if (!draft.requiresApproval && draft.sendEnabled) return `${role} approval cleared / Delivery ready`
  return `${role} approval required / Delivery disabled`
}

export function founderCovenantNotificationDraftStatusLabel(
  draft: Pick<FounderCovenantNotificationDraft, 'sendEnabled'>,
): string {
  return draft.sendEnabled ? 'Ready' : 'Disabled'
}

function legacyRoyaltyScopeLabel(scope: RealityAreaLegacyRoyaltyDashboard['appliesTo']): string {
  switch (scope) {
    case 'inherited_founder_created_businesses_only':
      return 'Inherited assets'
  }
}

export function founderCovenantSignalText(signal: FounderCovenantSignal): string {
  switch (signal.kind) {
    case 'founder_unavailable':
      return 'Founder unavailable'
    case 'no_business_built':
      return 'No business built'
    case 'understaffed_businesses':
      return `Understaffed: ${signal.businessIds?.join(', ') ?? 'businesses'}`
    case 'essential_shortage':
      return `Shortage: ${signal.businessKinds?.join(', ') ?? 'essential services'}`
    case 'sim_departure':
      return `Sim departures: ${signal.amount ?? 0}`
    case 'founder_debt':
      return `Founder debt: ${formatMoney(signal.amount ?? 0)}`
    case 'review_due':
      return 'Review due'
  }
}

function durationLabel(ms: number): string {
  const remaining = Math.max(0, ms)
  const hours = Math.ceil(remaining / 3_600_000)
  if (hours <= 0) return 'now'
  if (hours < 24) return `${hours}h`
  return `${Math.ceil(hours / 24)}d`
}

function channelLabel(channel: FounderCovenantNotificationDraft['channel']): string {
  switch (channel) {
    case 'telegram':
      return 'Telegram'
  }
}

function founderCovenantAuthorityRoleLabel(
  role: FounderCovenantManualAction['authorityGate']['requiredRole'],
): string {
  switch (role) {
    case 'area_reviewer':
      return 'Area reviewer'
    case 'main_founder':
      return 'Main founder'
  }
}

function founderCovenantApprovalBlockerLabel(
  blocker: FounderCovenantApprovalRequest['blockers'][number],
): string {
  switch (blocker) {
    case 'approval_workflow_disabled':
      return 'approval workflow'
    case 'telegram_delivery_disabled':
      return 'Telegram delivery'
    case 'probation_execution_disabled':
      return 'probation execution'
    case 'replacement_disabled':
      return 'replacement'
    case 'waitlist_handoff_disabled':
      return 'waitlist handoff'
  }
}

export function founderLedgerSummaryItems(ledger: AreaLedgerDashboard): FounderLedgerSummaryItem[] {
  return [{
    key: 'events',
    label: 'Events',
    value: String(ledger.transactionCount),
    tone: ledger.transactionCount > 0 ? 'stable' : 'warning',
  }, {
    key: 'sales',
    label: 'Sales',
    value: formatMoney(ledger.totalsByKind.customer_purchase),
    tone: ledger.totalsByKind.customer_purchase > 0 ? 'stable' : 'warning',
  }, {
    key: 'wages',
    label: 'Wages',
    value: formatMoney(ledger.totalsByKind.worker_wage),
    tone: ledger.totalsByKind.worker_wage > 0 ? 'warning' : 'stable',
  }, {
    key: 'debt',
    label: 'Debt issued',
    value: formatMoney(ledger.totalsByKind.medical_debt),
    tone: ledger.totalsByKind.medical_debt > 0 ? 'critical' : 'stable',
  }, {
    key: 'game-only',
    label: 'Game-only',
    value: formatMoney(ledger.payoutClassification.gameOnlyAmount),
    tone: 'stable',
  }, {
    key: 'payout-eligible',
    label: 'Payout eligible',
    value: formatMoney(ledger.payoutClassification.payoutEligibleAmount),
    tone: ledger.payoutClassification.payoutEligibleAmount > 0 ? 'critical' : 'stable',
  }]
}

export function founderAreaEventSummaryItems(events: AreaEventsDashboard): FounderAreaEventSummaryItem[] {
  return [{
    key: 'events',
    label: 'Events',
    value: String(events.eventCount),
    tone: events.eventCount > 0 ? 'warning' : 'stable',
  }, {
    key: 'departures',
    label: 'Sim departures',
    value: String(events.simDepartures),
    tone: events.simDepartures > 0 ? 'warning' : 'stable',
  }, {
    key: 'warnings',
    label: 'Warnings',
    value: String(events.warningEvents),
    tone: events.warningEvents > 0 ? 'warning' : 'stable',
  }, {
    key: 'critical',
    label: 'Critical',
    value: String(events.criticalEvents),
    tone: events.criticalEvents > 0 ? 'critical' : 'stable',
  }]
}

export function founderAreaEventTitle(event: Pick<AreaEventDashboard, 'kind' | 'displayName'>): string {
  switch (event.kind) {
    case 'sim_citizen_departure':
      return `${event.displayName} left`
  }
}

export function founderAreaEventDetail(
  event: Pick<AreaEventDashboard, 'kind' | 'reason' | 'serviceKind'>,
): string {
  switch (event.kind) {
    case 'sim_citizen_departure':
      return `${founderAreaDepartureReasonLabel(event.reason)} · ${event.serviceKind} unserved`
  }
}

function founderAreaDepartureReasonLabel(reason: AreaEventDashboard['reason']): string {
  switch (reason) {
    case 'water_unserved':
      return 'Water shortage'
    case 'food_unserved':
      return 'Food shortage'
    case 'housing_unserved':
      return 'Housing shortage'
  }
}

export function founderLedgerTransactionTitle(transaction: Pick<AreaTransactionDashboard, 'kind'>): string {
  return ledgerKindLabel(transaction.kind)
}

function ledgerKindLabel(kind: WorldTransactionKind): string {
  switch (kind) {
    case 'founder_credit':
      return 'Founder credit'
    case 'sim_citizen_credit':
      return 'Sim citizen credit'
    case 'business_build':
      return 'Business build'
    case 'customer_purchase':
      return 'Customer purchase'
    case 'worker_wage':
      return 'Worker wage'
    case 'hospital_bill':
      return 'Hospital bill'
    case 'insurance_premium':
      return 'Insurance premium'
    case 'insurance_payout':
      return 'Insurance payout'
    case 'medical_debt':
      return 'Medical debt'
    case 'debt_repayment':
      return 'Debt repayment'
  }
}

function positiveFlag(key: string, label: string, on: boolean): FounderCovenantReviewItem {
  return {
    key,
    label,
    value: on ? 'yes' : 'no',
    tone: on ? 'stable' : 'warning',
  }
}

function riskFlag(key: string, label: string, on: boolean): FounderCovenantReviewItem {
  return {
    key,
    label,
    value: on ? 'yes' : 'no',
    tone: on ? 'critical' : 'stable',
  }
}
