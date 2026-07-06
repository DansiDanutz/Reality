import { formatMoney } from '../../game/engine'
import type {
  AreaFounderCovenantDashboard,
  AreaLedgerDashboard,
  AreaTransactionDashboard,
  FounderCovenantActivityReview,
  FounderCovenantApprovalRequest,
  FounderCovenantManualAction,
  FounderCovenantNotificationDraft,
  FounderCovenantReviewHistoryItem,
  FounderCovenantReviewChecklistItem,
  FounderCovenantReviewSchedule,
  FounderCovenantSignal,
  WorldTransactionKind,
} from '../../game/worldSim'

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

export interface FounderCovenantScheduleItem {
  key: string
  label: string
  value: string
  tone: FounderCovenantReviewTone
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
  return `${founderCovenantAuthorityRoleLabel(request.authorityGate.requiredRole)} approval · execution disabled`
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
  return `${count} approval${count === 1 ? '' : 's'} captured · ${executable} executable`
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

export function founderCovenantNotificationDraftStatusLabel(
  draft: Pick<FounderCovenantNotificationDraft, 'sendEnabled'>,
): string {
  return draft.sendEnabled ? 'Ready' : 'Disabled'
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
  }]
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
