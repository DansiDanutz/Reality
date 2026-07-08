import type { RealityFounderCovenantReviewQueueItem } from '../../lib/realityArea'

type CadenceKind = 'weekly' | 'monthly'

export function withRecordReadyCadenceFounder(
  item: RealityFounderCovenantReviewQueueItem,
  options: {
    cadence: CadenceKind
    areaId?: string
    areaLabel?: string
    founderCitizenId?: string
    founderNumber?: number
    lastReviewAt?: string
    reviewFreshness?: RealityFounderCovenantReviewQueueItem['reviewFreshness']
    score?: number
    summary?: string
    reason?: string
  },
): RealityFounderCovenantReviewQueueItem {
  const monthly = options.cadence === 'monthly'
  return {
    ...item,
    areaId: options.areaId ?? item.areaId,
    areaLabel: options.areaLabel ?? item.areaLabel,
    founderCitizenId: options.founderCitizenId ?? item.founderCitizenId,
    founderNumber: options.founderNumber ?? item.founderNumber,
    manualReviewRequired: false,
    covenantStatus: 'watch',
    overdue: true,
    reviewFreshness: options.reviewFreshness ?? (monthly ? 'stale' : 'fresh'),
    lastReviewAt: options.lastReviewAt ?? (monthly ? '2026-06-01T04:00:00.000Z' : '2026-07-01T04:00:00.000Z'),
    weeklyReviewDue: true,
    monthlyReviewDue: monthly,
    activityReview: {
      ...item.activityReview,
      active: true,
      useful: true,
      staffed: true,
      hospitalized: false,
      atRisk: false,
      indebted: false,
      score: options.score ?? (monthly ? 80 : 84),
    },
    economicExposure: {
      ...item.economicExposure,
      outstandingDebt: 0,
      debtCount: 0,
      unstaffedBusinessCount: 0,
      hospitalized: false,
    },
    reviewReadiness: {
      status: 'ready',
      label: 'Ready',
      summary: options.summary ?? (monthly
        ? 'Monthly review is overdue and ready to be recorded.'
        : 'Weekly review is due and ready to be recorded.'),
      evidenceRequiredCount: 0,
      approvalRequestCount: 0,
      blockerCount: 0,
      overdue: true,
      manualOnly: true,
      automationEnabled: false,
      executionEnabled: false,
    },
    reviewQueue: {
      ...item.reviewQueue,
      nextStep: 'record_review',
      recommendedActionKinds: ['record_review'],
      pendingApprovalKinds: [],
      pendingApprovalCount: 0,
      pendingNotificationKinds: [],
      pendingNotificationCount: 0,
      blockerCount: 0,
      blockers: [],
    },
    manualActions: item.manualActions.map((action, index) => ({
      ...action,
      recommended: index === 0,
      reason: index === 0
        ? options.reason ?? (monthly
          ? 'Monthly covenant review is overdue and ready to be recorded.'
          : 'Weekly covenant review is due and ready to be recorded.')
        : action.reason,
    })),
    pendingApprovalRequests: [],
    pendingApprovalKinds: [],
    pendingNotificationDrafts: [],
    pendingNotificationKinds: [],
    signalCounts: { total: 1, info: 0, warning: 1, critical: 0 },
    signalKinds: ['review_due'],
    blockerCount: 0,
    transactionsAdded: 0,
  }
}
