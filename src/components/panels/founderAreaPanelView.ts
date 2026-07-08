import { formatMoney } from '../../game/engine'
import type {
  AreaBusinessDashboard,
  AreaCitizenDashboard,
  AreaEventDashboard,
  AreaEventsDashboard,
  AreaFounderCovenantDashboard,
  AreaJobsDashboard,
  AreaLedgerDashboard,
  AreaTransactionDashboard,
  CitizenSurvivalSignal,
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

export interface FounderCovenantOperatorQueueReviewRow {
  key: string
  title: string
  areaId: string
  founderCitizenId: string
  canRecordReview: boolean
  statusClass: FounderCovenantOperatorQueueStatusClass
  statusLabel: string
  summary: string
  dateSummary: string
  latestReviewText: string | null
  reviewQueueSummaryText: string
  reviewQueueDetailText: string
  activitySignalText: string
  economicExposureText: string
  stageText: string
  reviewReadinessText: string
  checklistText: string
  evidenceInputText: string
  manualActionText: string
  approvalRequestText: string
  approvalBlockerText: string
  notificationDraftText: string
  signalText: string
  priorityScore: number
  priorityReasons: string[]
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
  identity: Pick<
    RealityAreaDashboard['founderIdentity'],
    'telegramUserId' | 'telegramAccountId' | 'telegramUsername' | 'telegramName'
  >,
): string {
  if (identity.telegramUsername) return `Telegram linked @${identity.telegramUsername}`
  if (identity.telegramName) return `Telegram linked ${identity.telegramName}`
  if (identity.telegramUserId) return `Telegram linked ${identity.telegramUserId}`
  if (identity.telegramAccountId) return `Telegram linked ${identity.telegramAccountId.replace(/^telegram:/, '')}`
  return 'Telegram pending'
}

export function founderCitizenConditionText(
  citizen: Pick<AreaCitizenDashboard, 'state' | 'health' | 'participantLabel'>,
): string {
  return `${citizen.state} · health ${Math.round(citizen.health)} · ${citizen.participantLabel}`
}

export function founderCitizenNeedText(
  citizen: Pick<AreaCitizenDashboard, 'needs' | 'health'>,
): string {
  return [
    `water ${Math.round(citizen.needs.hydration)}`,
    `food ${Math.round(citizen.needs.hunger)}`,
    `rest ${Math.round(citizen.needs.energy)}`,
    `health ${Math.round(citizen.health)}`,
  ].join(' · ')
}

export function founderRecoverySummaryText(
  citizen: Pick<AreaCitizenDashboard, 'state' | 'debt' | 'insuranceActive' | 'insurancePaidUntil' | 'needs' | 'health'> | undefined,
  survival?: Pick<CitizenSurvivalSignal, 'risk' | 'hospitalizedUntil' | 'warnings'>,
): string {
  if (!citizen) return 'Founder status unavailable'
  const parts: string[] = []
  if (survival?.hospitalizedUntil || citizen.state === 'hospitalized') {
    parts.push(`Hospital until ${founderUtcMinuteText(survival?.hospitalizedUntil ?? Date.now())}`)
  } else if (survival?.risk === 'danger') {
    parts.push('Founder in danger')
  } else if (survival?.risk === 'warning') {
    parts.push('Founder under watch')
  } else {
    parts.push('Founder active')
  }
  parts.push(citizen.insuranceActive ? 'insured' : 'uninsured')
  if (citizen.debt > 0) parts.push(`debt ${formatMoney(citizen.debt)}`)
  const urgentNeeds = [
    citizen.needs.hydration <= 50 ? `water ${Math.round(citizen.needs.hydration)}` : null,
    citizen.needs.hunger <= 50 ? `food ${Math.round(citizen.needs.hunger)}` : null,
    citizen.needs.energy <= 40 ? `rest ${Math.round(citizen.needs.energy)}` : null,
    citizen.health <= 65 ? `health ${Math.round(citizen.health)}` : null,
  ].filter(Boolean)
  if (urgentNeeds.length > 0) parts.push(`urgent ${urgentNeeds.join(', ')}`)
  return parts.join(' · ')
}

export function founderEstateProtectionText(
  citizen: Pick<AreaCitizenDashboard, 'estateProtection'> | undefined,
): string {
  if (!citizen) return 'Estate status unavailable'
  const estate = citizen.estateProtection
  const heir = estate.namedHeirName ?? (estate.namedHeirCitizenId ? `heir ${estate.namedHeirCitizenId}` : 'no heir named')
  const coverage = estate.protectedByInsurance ? 'insurance-backed' : 'not protected'
  return `${heir} · ${coverage} · manual review`
}

export function founderOperatingPriorityText(input: {
  founder: Pick<AreaCitizenDashboard, 'state' | 'debt'> | undefined
  survival?: Pick<CitizenSurvivalSignal, 'risk'>
  jobs: Pick<AreaJobsDashboard, 'understaffedBusinesses' | 'candidates'>
  firstBuild: readonly Pick<RealityAreaDashboard['firstBuild'][number], 'name' | 'canBuildNow'>[]
  covenant: Pick<AreaFounderCovenantDashboard, 'manualReviewRequired' | 'reviewQueue'>
}): string {
  if (!input.founder) return 'Next: founder status unavailable'
  if (input.founder.state === 'hospitalized' || input.survival?.risk === 'hospitalized') {
    return 'Next: recover first before managing the area again'
  }
  if (input.jobs.understaffedBusinesses > 0) {
    const hireNow = input.jobs.candidates.find((candidate) =>
      candidate.action === 'hire_now' && candidate.recommendedBusinessName
    )
    if (hireNow?.recommendedBusinessName) {
      return `Next: staff ${hireNow.recommendedBusinessName} before expanding`
    }
    return `Next: staff ${input.jobs.understaffedBusinesses} business${input.jobs.understaffedBusinesses === 1 ? '' : 'es'} before expanding`
  }
  const buildNow = input.firstBuild.find((recommendation) => recommendation.canBuildNow)
  if (buildNow) return `Next: build ${buildNow.name}`
  if (input.founder.debt > 0) return `Next: review debt ${formatMoney(input.founder.debt)} before expanding`
  if (input.covenant.manualReviewRequired || input.covenant.reviewQueue.blockerCount > 0) {
    return 'Next: keep evidence current for manual review'
  }
  return 'Next: monitor demand and keep the area stable'
}

export function founderNeedMetricDetailText(input: {
  simDemand: number
  realDemand: number
  shortage: number
  remainingLicenses: number
  licenseSlots: number
  saturation: number
}): string {
  return [
    `sim ${input.simDemand}`,
    `real ${input.realDemand}`,
    `short ${input.shortage}`,
    `licenses ${input.remainingLicenses}/${input.licenseSlots}`,
    `sat ${Math.round(input.saturation * 100)}%`,
  ].join(' · ')
}

export function founderJobsMetricDetailText(
  jobs: Pick<AreaJobsDashboard, 'hireableSimWorkers' | 'openPositions' | 'understaffedBusinesses' | 'realWorkersRequiringAcceptance'>,
): string {
  return [
    `hireable ${jobs.hireableSimWorkers}`,
    `open ${jobs.openPositions}`,
    `unstaffed ${jobs.understaffedBusinesses}`,
    `acceptance ${jobs.realWorkersRequiringAcceptance}`,
  ].join(' · ')
}

export function founderFirstBuildEconomicsText(
  recommendation: Pick<
    RealityAreaDashboard['firstBuild'][number],
    'currentSupply' | 'estimatedPaybackHours' | 'cashShortfall' | 'citizensUntilNextLicense'
  >,
): string {
  const payback = recommendation.estimatedPaybackHours === null
    ? 'payback unknown'
    : `payback ${Math.round(recommendation.estimatedPaybackHours)}h`
  const shortfall = recommendation.cashShortfall > 0
    ? `short ${formatMoney(recommendation.cashShortfall)}`
    : 'cash ready'
  return [
    `supply ${recommendation.currentSupply}`,
    payback,
    shortfall,
    `next license ${recommendation.citizensUntilNextLicense} citizens`,
  ].join(' · ')
}

export function founderCitizenProtectionText(
  citizen: Pick<AreaCitizenDashboard, 'insuranceActive' | 'insurancePaidUntil' | 'insuranceBusinessId' | 'insuranceAction'>,
  survival?: Pick<CitizenSurvivalSignal, 'hospitalizedUntil'>,
): string {
  if (survival?.hospitalizedUntil) return `Hospital until ${founderUtcMinuteText(survival.hospitalizedUntil)}`
  if (citizen.insuranceActive && citizen.insurancePaidUntil) {
    return `Insured until ${founderUtcMinuteText(citizen.insurancePaidUntil)}`
  }
  if (citizen.insuranceBusinessId) return 'Insurance expired'
  if (citizen.insuranceAction.available && citizen.insuranceAction.premium !== null) {
    return `Uninsured · premium ${formatMoney(citizen.insuranceAction.premium)}`
  }
  return 'Uninsured'
}

export function founderCitizenDebtActionText(
  debt: Pick<AreaCitizenDashboard['debts'][number], 'creditorId' | 'recommendedPayment' | 'canRepayNow' | 'blockers'> | undefined,
): string | null {
  if (!debt) return null
  if (debt.canRepayNow) return `Repay ${formatMoney(debt.recommendedPayment)} to ${debt.creditorId}`
  if (debt.blockers.includes('actor_unavailable')) return 'Debt locked while hospitalized'
  if (debt.blockers.includes('insufficient_funds')) {
    return debt.recommendedPayment > 0
      ? `Debt due · repay up to ${formatMoney(debt.recommendedPayment)} now`
      : 'Debt due · founder cash required'
  }
  return 'Debt review required'
}

export function founderCitizenInsuranceActionText(
  citizen: Pick<AreaCitizenDashboard, 'insuranceActive' | 'insuranceBusinessId' | 'insuranceAction'>,
): string | null {
  if (citizen.insuranceActive) return null
  if (citizen.insuranceBusinessId) return 'Insurance renewal required'
  if (citizen.insuranceAction.canBuyNow && citizen.insuranceAction.premium !== null) {
    return `Insurance ready · premium ${formatMoney(citizen.insuranceAction.premium)}`
  }
  if (citizen.insuranceAction.blockers.includes('actor_unavailable')) return 'Insurance locked while hospitalized'
  if (citizen.insuranceAction.blockers.includes('insufficient_funds') && citizen.insuranceAction.premium !== null) {
    return `Insurance blocked · premium ${formatMoney(citizen.insuranceAction.premium)}`
  }
  if (citizen.insuranceAction.blockers.includes('service_unavailable')) return 'No insurance provider available'
  return null
}

export function founderBusinessStatusText(
  business: Pick<AreaBusinessDashboard, 'status' | 'activeStaff' | 'targetStaff' | 'hourlyCapacity'>,
): string {
  return `${business.status} · staff ${business.activeStaff}/${business.targetStaff} · capacity ${business.hourlyCapacity}/hour`
}

export function founderBusinessAlertText(
  alert: AreaBusinessDashboard['alerts'][number],
): string {
  switch (alert.kind) {
    case 'understaffed':
      return alert.severity === 'critical' ? 'No active staff on shift' : 'Staffing below target'
    case 'cash_risk':
      return 'Cash at risk for next wage cycle'
    case 'owner_unavailable':
      return 'Owner unavailable during hospitalization'
    case 'quality_degraded':
      return alert.severity === 'critical' ? 'Service quality has broken down' : 'Service quality is slipping'
    case 'negative_cash_flow':
      return 'Spending is outpacing revenue'
  }
}

export function founderBusinessAlertSummaryText(
  business: Pick<AreaBusinessDashboard, 'alerts'>,
): string | null {
  if (business.alerts.length === 0) return null
  return business.alerts.map(founderBusinessAlertText).join(' · ')
}

export function founderBusinessLedgerText(
  business: Pick<AreaBusinessDashboard, 'ledger'>,
): string {
  const ledger = business.ledger
  const netPrefix = ledger.netCashFlow >= 0 ? '+' : '-'
  const receivables = ledger.receivablesIssued > 0 ? ` · receivables ${formatMoney(ledger.receivablesIssued)}` : ''
  return [
    `revenue ${formatMoney(ledger.revenue)}`,
    `expenses ${formatMoney(ledger.expenses)}`,
    `net ${netPrefix}${formatMoney(Math.abs(ledger.netCashFlow))}`,
    `wages ${formatMoney(ledger.wagesPaid)}`,
  ].join(' · ') + receivables
}

export function founderFirstBuildReasonText(
  recommendation: Pick<
    RealityAreaDashboard['firstBuild'][number],
    'reason' | 'canBuildNow' | 'founderCanAfford' | 'blockers'
  >,
): string {
  if (recommendation.canBuildNow) return recommendation.reason
  if (recommendation.blockers.includes('actor_unavailable')) return 'Founder is recovering and cannot build yet'
  if (recommendation.blockers.includes('insufficient_funds') || !recommendation.founderCanAfford) {
    return 'Founder cash is too low for this build'
  }
  if (recommendation.blockers.includes('license_unavailable')) return 'Starter license is already taken in this area'
  return recommendation.reason
}

export function founderFirstBuildActionLabel(
  recommendation: Pick<
    RealityAreaDashboard['firstBuild'][number],
    'canBuildNow' | 'action' | 'reason'
  >,
): string {
  if (recommendation.canBuildNow) return 'Build'
  if (recommendation.reason.startsWith('Current businesses need staff before expansion.')) return 'Staff first'
  if (recommendation.reason.startsWith('Current businesses need staff before expansion,')) return 'Staff first'
  switch (recommendation.action) {
    case 'claim_area':
      return 'Claim area'
    case 'recover_first':
      return 'Recover'
    case 'save_credits':
      return 'Save'
    case 'grow_demand':
      return 'Grow demand'
    case 'wait_for_demand':
      return 'Wait'
    case 'build_now':
      return 'Build'
  }
}

export function founderWorkerCandidateActionText(
  candidate: Pick<
    AreaJobsDashboard['candidates'][number],
    'action' | 'recommendedBusinessName' | 'recommendedBusinessKind'
  >,
): string {
  switch (candidate.action) {
    case 'hire_now':
      return candidate.recommendedBusinessName
        ? `Ready for ${candidate.recommendedBusinessName} · clears staffing pressure`
        : 'Ready to hire · clears staffing pressure'
    case 'founder_unavailable':
      return 'Founder recovering before hiring resumes'
    case 'requires_acceptance':
      return candidate.recommendedBusinessKind
        ? `${candidate.recommendedBusinessKind} role needs worker acceptance before staffing clears`
        : 'Worker acceptance required'
    case 'waiting_for_position':
      return 'No understaffed role open right now'
  }
}

export function founderSurvivalActionText(
  action: Pick<CitizenSurvivalSignal['actions'][number], 'intent' | 'serviceKind' | 'lowestPrice' | 'available' | 'canAfford' | 'blockers'> | undefined,
  survival?: Pick<CitizenSurvivalSignal, 'risk'>,
): string | null {
  if (!action) return null
  if (survival?.risk === 'hospitalized') return `${founderSurvivalIntentLabel(action.intent)} locked during recovery`
  if (action.available && action.canAfford && action.lowestPrice !== null) {
    return `${founderSurvivalIntentLabel(action.intent)} ready · ${formatMoney(action.lowestPrice)}`
  }
  if (action.blockers.includes('service_unavailable')) {
    return `${founderServiceKindLabel(action.serviceKind)} unavailable nearby`
  }
  if (action.blockers.includes('insufficient_funds') && action.lowestPrice !== null) {
    return `${founderSurvivalIntentLabel(action.intent)} blocked · need ${formatMoney(action.lowestPrice)}`
  }
  return `${founderSurvivalIntentLabel(action.intent)} pending`
}

export function founderSurvivalWarningText(
  survival: Pick<CitizenSurvivalSignal, 'risk' | 'warnings'> | undefined,
): string | null {
  if (!survival || survival.warnings.length === 0) return null
  const prefix = survival.risk === 'danger' || survival.risk === 'hospitalized' ? 'Critical' : 'Watch'
  return `${prefix}: ${survival.warnings.map(founderSurvivalWarningLabel).join(', ')}`
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
    case 'telegram_identity_required':
      return 'Telegram identity'
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
    case 'telegram_identity_required':
      return 'Telegram identity'
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

export function founderCovenantReviewActorText(
  review: {
    reviewerId: string
    reviewedAt?: string | number
    at?: string | number
  },
): string {
  const at = review.reviewedAt ?? review.at
  return `Reviewed ${founderUtcMinuteText(at ?? 0)} · ${review.reviewerId}`
}

export function founderCovenantReviewAuthorityText(
  review: Pick<FounderCovenantReviewHistoryItem, 'authorityGate'>,
): string {
  const role = founderCovenantAuthorityRoleLabel(review.authorityGate.requiredRole)
  return review.authorityGate.status === 'evidence_only' ? `${role} / Evidence only` : `${role} / Approval required`
}

export function founderCovenantReviewSignalSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'signals'>,
): string {
  const count = review.signals.length
  if (count === 0) return 'No signals captured'
  return `${count} signal${count === 1 ? '' : 's'} captured`
}

export function founderCovenantReviewSignalDetailText(
  review: Pick<FounderCovenantReviewHistoryItem, 'signals'>,
): string {
  if (review.signals.length === 0) return 'Signal detail unavailable'
  return review.signals.map(founderCovenantSignalText).join(', ')
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

export function founderCovenantReviewInputDetailText(
  review: Pick<FounderCovenantReviewHistoryItem, 'reviewInputs'>,
): string {
  if (review.reviewInputs.length === 0) return 'Input detail unavailable'
  const manual = review.reviewInputs.filter((input) => input.manualEvidenceRequired || input.status === 'manual_needed')
  if (manual.length > 0) return manual.map((input) => input.label).join(', ')
  const watch = review.reviewInputs.filter((input) => input.status === 'watch')
  return watch.length > 0 ? `Watch: ${watch.map((input) => input.label).join(', ')}` : 'Complete'
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

export function founderCovenantReviewActionDetailText(
  review: Pick<FounderCovenantReviewHistoryItem, 'manualActions'>,
): string {
  const suggested = review.manualActions.filter((action) => action.recommended)
  if (suggested.length === 0) return 'Action detail unavailable'
  return suggested
    .map((action) => {
      const status = action.kind === 'record_review' ? 'evidence-only' : 'locked'
      return `${founderCovenantManualActionKindLabel(action.kind)} ${status}`
    })
    .join(', ')
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

export function founderCovenantReviewApprovalBlockerSummary(
  review: Pick<FounderCovenantReviewHistoryItem, 'approvalRequests'>,
): string {
  const blockers = Array.from(new Set(review.approvalRequests.flatMap((request) => request.blockers)))
  if (blockers.length === 0) return 'No approval blockers'
  return `Approval blockers: ${blockers.map(founderCovenantApprovalBlockerLabel).join(', ')}`
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

export function founderCovenantSelfExposureText(
  founder: Pick<AreaCitizenDashboard, 'money' | 'debt' | 'debts' | 'insuranceActive' | 'state'> | undefined,
  businesses: readonly Pick<AreaBusinessDashboard, 'cash' | 'activeStaff' | 'targetStaff'>[],
): string {
  if (!founder) return 'Exposure unavailable'
  const debtCount = founder.debts.length
  const businessCash = businesses.reduce((total, business) => total + business.cash, 0)
  const unstaffedBusinessCount = businesses.filter((business) => business.activeStaff < business.targetStaff).length
  const insured = founder.insuranceActive ? 'insured' : 'uninsured'
  const availability = founder.state === 'hospitalized' ? 'hospitalized' : 'available'
  return [
    `Founder ${formatMoney(founder.money)}`,
    `debt ${formatMoney(founder.debt)} (${debtCount})`,
    `businesses ${businesses.length} / ${formatMoney(businessCash)}`,
    `unstaffed ${unstaffedBusinessCount}`,
    insured,
    availability,
    'game credits only',
  ].join(' · ')
}

export function founderCovenantSelfReadinessText(
  covenant: Pick<AreaFounderCovenantDashboard, 'reviewInputs' | 'approvalRequests' | 'reviewQueue' | 'reviewSchedule'>,
): string {
  const evidenceRequiredCount = covenant.reviewInputs.filter((input) =>
    input.manualEvidenceRequired || input.status === 'manual_needed'
  ).length
  const approvalRequestCount = covenant.approvalRequests.length
  const blockerCount = covenant.reviewQueue.blockerCount
  const overdue = covenant.reviewSchedule?.overdue ?? false
  const label = blockerCount > 0 ? 'Blocked' : evidenceRequiredCount > 0 ? 'Needs evidence' : 'Monitoring'
  const summary = blockerCount > 0
    ? `${blockerCount} approval blocker${blockerCount === 1 ? '' : 's'} before enforcement.`
    : evidenceRequiredCount > 0
      ? `${evidenceRequiredCount} manual evidence gap${evidenceRequiredCount === 1 ? '' : 's'} to review.`
      : 'No manual review required yet.'
  const details: string[] = []
  if (evidenceRequiredCount > 0) {
    details.push(`${evidenceRequiredCount} evidence gap${evidenceRequiredCount === 1 ? '' : 's'}`)
  }
  if (approvalRequestCount > 0) {
    details.push(`${approvalRequestCount} approval request${approvalRequestCount === 1 ? '' : 's'}`)
  }
  if (blockerCount > 0) {
    details.push(`${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`)
  }
  if (overdue) details.push('overdue')
  const detailText = details.length > 0 ? ` · ${details.join(', ')}` : ''
  return `${label}: ${summary}${detailText}`
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
    `${totals.overdue} overdue`,
    `${totals.hospitalized} hospitalized`,
    `${totals.indebted} indebted`,
  ]
  return `${totals.founders} founder${totals.founders === 1 ? '' : 's'} · ${riskParts.join(' · ')} · ${formatMoney(totals.totalOutstandingDebt)} debt${queue.hasMore ? ' · more available' : ''}`
}

export function founderCovenantOperatorQueuePageSummary(
  queue: Pick<RealityFounderCovenantReviewQueueDashboard, 'scanned' | 'caughtUp' | 'current' | 'failed' | 'hasMore'>,
): string {
  return `${queue.scanned} scanned · ${queue.caughtUp} caught up · ${queue.current} current · ${queue.failed} failed${queue.hasMore ? ' · next page ready' : ''}`
}

export function founderCovenantOperatorQueueItemSummary(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'covenantStatus'
    | 'manualReviewRequired'
    | 'activityReview'
    | 'economicExposure'
    | 'signalCounts'
    | 'blockerCount'
    | 'transactionsAdded'
  >,
): string {
  const status = founderCovenantStatusLabel(item.covenantStatus)
  const review = item.manualReviewRequired ? 'manual review' : 'watch'
  return `${status} · ${review} · score ${item.activityReview.score}/100 · ${formatMoney(item.economicExposure.outstandingDebt)} debt · ${item.signalCounts.warning} warning${item.signalCounts.warning === 1 ? '' : 's'} · ${item.signalCounts.critical} critical · ${item.blockerCount} blocker${item.blockerCount === 1 ? '' : 's'} · ${item.transactionsAdded} tx`
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
  item: Pick<RealityFounderCovenantReviewQueueItem, 'scanStatus' | 'checkedAt' | 'lastReviewAt' | 'nextWeeklyReviewAt' | 'nextMonthlyReviewAt'>,
): string {
  const lastReview = item.lastReviewAt ? shortDate(item.lastReviewAt) : 'none'
  return `${founderCovenantOperatorQueueScanStatusLabel(item.scanStatus)} · checked ${shortDate(item.checkedAt)} · last ${lastReview} · weekly ${shortDate(item.nextWeeklyReviewAt)} · monthly ${shortDate(item.nextMonthlyReviewAt)}`
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
      canRecordReview: item.reviewQueue.recordReviewEnabled,
      statusClass: founderCovenantOperatorQueueItemStatusClass(item),
      statusLabel: founderCovenantOperatorQueueItemStatusLabel(item),
      summary: founderCovenantOperatorQueueItemSummary(item),
      dateSummary: founderCovenantOperatorQueueItemDateSummary(item),
      latestReviewText: founderCovenantOperatorQueueLatestReviewText(item),
      reviewQueueSummaryText: founderCovenantReviewQueueSummary(item.reviewQueue),
      reviewQueueDetailText: founderCovenantReviewQueueDetailText(item.reviewQueue),
      activitySignalText: founderCovenantOperatorQueueActivitySignalText(item),
      economicExposureText: founderCovenantOperatorQueueEconomicExposureText(item),
      stageText: founderCovenantOperatorQueueStageText(item),
      reviewReadinessText: founderCovenantOperatorQueueReviewReadinessText(item),
      checklistText: founderCovenantOperatorQueueChecklistText(item),
      evidenceInputText: founderCovenantOperatorQueueEvidenceInputText(item),
      manualActionText: founderCovenantOperatorQueueManualActionText(item),
      approvalRequestText: founderCovenantOperatorQueueApprovalRequestText(item),
      approvalBlockerText: founderCovenantOperatorQueueApprovalBlockerText(item),
      notificationDraftText: founderCovenantOperatorQueueNotificationDraftText(item),
      signalText: founderCovenantOperatorQueueSignalText(item),
      priorityScore: founderCovenantOperatorQueuePriorityScore(item),
      priorityReasons: founderCovenantOperatorQueuePriorityReasons(item),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title))
}

export function founderCovenantOperatorQueueLatestReviewText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'latestReview'>,
): string | null {
  if (!item.latestReview) return null
  const action = founderCovenantManualActionKindLabel(item.latestReview.actionKind)
  const mode = item.latestReview.evidenceOnly && !item.latestReview.automationEnabled ? 'Evidence only' : 'Automation'
  return `Latest review ${shortDate(item.latestReview.reviewedAt)} · ${action} · ${mode} · ${item.latestReview.reviewerId} · ${item.latestReview.summary}`
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

export function founderCovenantOperatorQueueApprovalBlockerText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingApprovalRequests'>,
): string {
  const blockers = Array.from(new Set(item.pendingApprovalRequests.flatMap((request) => request.blockers)))
  if (blockers.length === 0) return 'none'
  return blockers.map(founderCovenantApprovalBlockerLabel).join(', ')
}

export function founderCovenantOperatorQueueNotificationDraftText(
  item: Pick<RealityFounderCovenantReviewQueueItem, 'pendingNotificationDrafts'>,
): string {
  if (item.pendingNotificationDrafts.length === 0) return 'none'
  return item.pendingNotificationDrafts
    .map((draft) => `${founderCovenantNotificationKindLabel(draft.kind)} locked (${founderCovenantNotificationChannelLabel(draft.channel)})`)
    .join(', ')
}

export function founderCovenantOperatorQueuePriorityScore(
  item: Pick<
    RealityFounderCovenantReviewQueueItem,
    | 'manualReviewRequired'
    | 'covenantStatus'
    | 'overdue'
    | 'scanStatus'
    | 'activityReview'
    | 'economicExposure'
    | 'signalCounts'
    | 'blockerCount'
  >,
): number {
  let score = 0
  if (item.manualReviewRequired) score += 500
  if (item.covenantStatus === 'manual_review') score += 250
  if (item.covenantStatus === 'watch') score += 120
  if (item.overdue) score += 90
  if (item.activityReview.hospitalized) score += 180
  if (item.activityReview.atRisk) score += 140
  if (!item.activityReview.active) score += 60
  if (!item.activityReview.useful) score += 50
  if (!item.activityReview.building) score += 50
  if (!item.activityReview.staffed) score += 40
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
    | 'scanStatus'
    | 'activityReview'
    | 'economicExposure'
    | 'signalCounts'
    | 'blockerCount'
  >,
): string[] {
  const reasons: string[] = []
  if (item.manualReviewRequired || item.covenantStatus === 'manual_review') reasons.push('manual review')
  if (item.overdue) reasons.push('overdue')
  if (item.activityReview.hospitalized) reasons.push('hospitalized')
  if (item.activityReview.atRisk) reasons.push('at risk')
  if (!item.activityReview.active) reasons.push('inactive')
  if (!item.activityReview.useful) reasons.push('usefulness missing')
  if (!item.activityReview.building) reasons.push('no build evidence')
  if (!item.activityReview.staffed) reasons.push('staffing gap')
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

function founderUtcMinuteText(value: string | number): string {
  const iso = new Date(value).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

function founderSurvivalIntentLabel(
  intent: CitizenSurvivalSignal['actions'][number]['intent'],
): string {
  switch (intent) {
    case 'buyWater':
      return 'Water'
    case 'buyFood':
      return 'Food'
    case 'buyHousing':
      return 'Rest'
    case 'visitClinic':
      return 'Clinic'
  }
}

function founderSurvivalWarningLabel(
  warning: CitizenSurvivalSignal['warnings'][number],
): string {
  switch (warning) {
    case 'water':
      return 'water'
    case 'food':
      return 'food'
    case 'rest':
      return 'rest'
    case 'health':
      return 'health'
  }
}

function founderServiceKindLabel(
  kind: CitizenSurvivalSignal['actions'][number]['serviceKind'],
): string {
  switch (kind) {
    case 'water':
      return 'Water service'
    case 'food':
      return 'Food service'
    case 'housing':
      return 'Housing'
    case 'clinic':
      return 'Clinic'
  }
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
