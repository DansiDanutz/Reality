import type {
  FounderCovenantActivityReview,
  FounderCovenantApprovalBlocker,
  FounderCovenantManualActionKind,
  FounderCovenantSignal,
  FounderCovenantStageKind,
} from './worldSim'

export type FounderCovenantEnforcementStatus = 'clear' | 'watch' | 'manual_review'

export interface FounderCovenantEnforcementInput {
  founderCitizenId: string
  currentStage: FounderCovenantStageKind
  activityReview: FounderCovenantActivityReview
  signals: readonly FounderCovenantSignal[]
  reviewedAt: number
  approvedById?: string | null
}

export interface FounderCovenantEnforcementAuthorityGate {
  requiredRole: 'main_founder'
  approvedById: string | null
  approvalRequired: boolean
  automationEnabled: false
  executionEnabled: false
}

export interface FounderCovenantEnforcementRecommendation {
  actionKind: FounderCovenantManualActionKind
  recommendedStage: FounderCovenantStageKind
  status: FounderCovenantEnforcementStatus
  reason: string
  requiresMainFounderApproval: boolean
  authorityGate: FounderCovenantEnforcementAuthorityGate
  approvalBlockers: readonly FounderCovenantApprovalBlocker[]
}

export interface FounderCovenantEnforcementPolicy {
  founderCitizenId: string
  reviewedAt: number
  currentStage: FounderCovenantStageKind
  recommendedStage: FounderCovenantStageKind
  actionKind: FounderCovenantManualActionKind
  status: FounderCovenantEnforcementStatus
  manualOnly: true
  automationEnabled: false
  executionEnabled: false
  removalEnabled: false
  replacementEnabled: false
  waitlistHandoffEnabled: false
  warningExecutionEnabled: false
  probationExecutionEnabled: false
  evidenceOnly: boolean
  score: number
  criticalSignalCount: number
  warningSignalCount: number
  recommendation: FounderCovenantEnforcementRecommendation
}

export function founderCovenantEnforcementPolicy(
  input: FounderCovenantEnforcementInput,
): FounderCovenantEnforcementPolicy {
  const criticalSignalCount = input.signals.filter((signal) => signal.severity === 'critical').length
  const warningSignalCount = input.signals.filter((signal) => signal.severity === 'warning').length
  const score = clampScore(input.activityReview.score)
  const unavailable = !input.activityReview.active || input.activityReview.hospitalized
  const actionKind = recommendedAction({
    currentStage: input.currentStage,
    score,
    criticalSignalCount,
    warningSignalCount,
    unavailable,
    atRisk: input.activityReview.atRisk,
  })
  const recommendedStage = stageForAction(actionKind, input.currentStage)
  const status: FounderCovenantEnforcementStatus = actionKind === 'record_review'
    ? 'clear'
    : actionKind === 'send_warning'
      ? 'watch'
      : 'manual_review'
  const authorityGate = authorityGateForAction(actionKind, input.approvedById)
  const approvalBlockers = blockersForAction(actionKind)

  return {
    founderCitizenId: input.founderCitizenId.trim(),
    reviewedAt: input.reviewedAt,
    currentStage: input.currentStage,
    recommendedStage,
    actionKind,
    status,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    removalEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    warningExecutionEnabled: false,
    probationExecutionEnabled: false,
    evidenceOnly: actionKind === 'record_review',
    score,
    criticalSignalCount,
    warningSignalCount,
    recommendation: {
      actionKind,
      recommendedStage,
      status,
      reason: reasonForAction(actionKind),
      requiresMainFounderApproval: actionKind !== 'record_review',
      authorityGate,
      approvalBlockers,
    },
  }
}

function recommendedAction(input: {
  currentStage: FounderCovenantStageKind
  score: number
  criticalSignalCount: number
  warningSignalCount: number
  unavailable: boolean
  atRisk: boolean
}): FounderCovenantManualActionKind {
  if (
    input.currentStage === 'probation' &&
    (input.unavailable || input.criticalSignalCount > 0 || input.score < 25)
  ) {
    return 'recommend_replacement'
  }
  if (
    input.currentStage === 'warning' &&
    (input.unavailable || input.criticalSignalCount > 0 || input.score < 45)
  ) {
    return 'start_probation'
  }
  if (input.currentStage === 'active' && (input.unavailable || input.criticalSignalCount > 0)) {
    return 'start_probation'
  }
  if (input.warningSignalCount > 0 || input.atRisk || input.score < 70) return 'send_warning'
  return 'record_review'
}

function stageForAction(
  actionKind: FounderCovenantManualActionKind,
  currentStage: FounderCovenantStageKind,
): FounderCovenantStageKind {
  switch (actionKind) {
    case 'record_review':
      return currentStage
    case 'send_warning':
      return 'warning'
    case 'start_probation':
      return 'probation'
    case 'recommend_replacement':
      return 'removed'
  }
}

function authorityGateForAction(
  actionKind: FounderCovenantManualActionKind,
  approvedById: string | null | undefined,
): FounderCovenantEnforcementAuthorityGate {
  const approved = cleanOptionalId(approvedById)
  return {
    requiredRole: 'main_founder',
    approvedById: approved,
    approvalRequired: actionKind !== 'record_review',
    automationEnabled: false,
    executionEnabled: false,
  }
}

function blockersForAction(actionKind: FounderCovenantManualActionKind): readonly FounderCovenantApprovalBlocker[] {
  switch (actionKind) {
    case 'record_review':
      return []
    case 'send_warning':
      return ['approval_workflow_disabled', 'telegram_delivery_disabled']
    case 'start_probation':
      return ['approval_workflow_disabled', 'probation_execution_disabled']
    case 'recommend_replacement':
      return ['approval_workflow_disabled', 'replacement_disabled', 'waitlist_handoff_disabled']
  }
}

function reasonForAction(actionKind: FounderCovenantManualActionKind): string {
  switch (actionKind) {
    case 'record_review':
      return 'Founder covenant evidence can be recorded without enforcement.'
    case 'send_warning':
      return 'Founder has watch signals; warning remains manual and unsent.'
    case 'start_probation':
      return 'Founder has serious covenant risk; probation remains disabled until main-founder approval workflow exists.'
    case 'recommend_replacement':
      return 'Founder has probation-level unresolved risk; removal and waitlist replacement remain disabled.'
  }
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

function cleanOptionalId(value: string | null | undefined): string | null {
  const clean = value?.trim()
  return clean ? clean : null
}
