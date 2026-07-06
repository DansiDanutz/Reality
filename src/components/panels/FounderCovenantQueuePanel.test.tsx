import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type {
  RealityFounderCovenantReviewQueueDashboard,
  RealityFounderCovenantReviewQueueItem,
} from '../../lib/realityArea'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'
import {
  founderCovenantOperatorQueueItemDateSummary,
  founderCovenantOperatorQueueItemStatusClass,
  founderCovenantOperatorQueueItemStatusLabel,
  founderCovenantOperatorQueueItemTitle,
  founderCovenantOperatorQueueApprovalRequestText,
  founderCovenantOperatorQueueNotificationDraftText,
  founderCovenantOperatorQueuePriorityReasons,
  founderCovenantOperatorQueuePriorityScore,
  founderCovenantOperatorQueueReviewRows,
} from './founderAreaPanelView'

describe('FounderCovenantQueuePanel', () => {
  test('renders a passive founder covenant operator queue without execution controls', () => {
    const html = renderToStaticMarkup(<FounderCovenantQueuePanel queue={founderQueue()} />)

    expect(html).toContain('Founder Review Queue')
    expect(html).toContain('Evidence only')
    expect(html).toContain('manual review only')
    expect(html).toContain('automation disabled')
    expect(html).toContain('approval workflow disabled')
    expect(html).toContain('replacement disabled')
    expect(html).toContain('waitlist disabled')
    expect(html).toContain('2 founders · 1 manual review · 1 overdue · 1 hospitalized · 1 indebted · $350 debt · more available')
    expect(html).toContain('2 scanned · 1 caught up · 1 current · 0 failed · next page ready')
    expect(html).toContain('#0012 · Bucharest Founder Block')
    expect(html).toContain('founder-12 · Manual review · manual review · score 35/100 · $350 debt')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('Priority: manual review, overdue, hospitalized, at risk, inactive')
    expect(html).toContain('Signals: founder_debt, review_due')
    expect(html).toContain('manual only')
    expect(html).not.toContain('Approve')
    expect(html).not.toContain('Replace')
  })

  test('renders latest review evidence for previously reviewed founders', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantQueuePanel
        queue={{
          ...founderQueue(),
          items: [founderQueueItem({
            lastReviewAt: '2026-07-06T08:00:00.000Z',
            latestReview: {
              reviewedAt: '2026-07-06T08:00:00.000Z',
              reviewerId: 'telegram-operator:42424242',
              actionKind: 'record_review',
              summary: 'Reviewed contribution and ideas evidence.',
              evidenceOnly: true,
              automationEnabled: false,
            },
          })],
        }}
      />,
    )

    expect(html).toContain('Latest review 2026-07-06 · telegram-operator:42424242 · Reviewed contribution and ideas evidence.')
    expect(html).not.toContain('Approve')
    expect(html).not.toContain('Replace')
  })

  test('renders evidence recording controls only when an operator handler is provided', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantQueuePanel canRecordReview onRecordReview={() => undefined} queue={founderQueue()} />,
    )

    expect(html).toContain('Record evidence')
    expect(html).not.toContain('Approve')
    expect(html).not.toContain('Replace')
  })

  test('labels founder covenant queue row status and dates for manual review', () => {
    const manual = founderQueueItem()
    const watch = founderQueueItem({
      manualReviewRequired: false,
      covenantStatus: 'watch',
      overdue: true,
      activityReview: {
        ...manual.activityReview,
        atRisk: false,
        score: 72,
      },
    })
    const tracked = founderQueueItem({
      manualReviewRequired: false,
      covenantStatus: 'active',
      overdue: false,
      signalKinds: [],
      activityReview: {
        ...manual.activityReview,
        atRisk: false,
        score: 91,
      },
    })

    expect(founderCovenantOperatorQueueItemTitle(manual)).toBe('#0012 · Bucharest Founder Block')
    expect(founderCovenantOperatorQueueItemStatusClass(manual)).toBe('manual_review')
    expect(founderCovenantOperatorQueueItemStatusLabel(manual)).toBe('Manual')
    expect(founderCovenantOperatorQueueItemStatusClass(watch)).toBe('watch')
    expect(founderCovenantOperatorQueueItemStatusLabel(watch)).toBe('Due')
    expect(founderCovenantOperatorQueueItemStatusClass(tracked)).toBe('met')
    expect(founderCovenantOperatorQueueItemStatusLabel(tracked)).toBe('Tracked')
    expect(founderCovenantOperatorQueueItemDateSummary(manual)).toBe(
      'caught up · checked 2026-07-06 · last none · weekly 2026-07-12 · monthly 2026-08-05',
    )
    expect(founderCovenantOperatorQueueApprovalRequestText(manual)).toBe('Send warning locked (2 blockers)')
    expect(founderCovenantOperatorQueueNotificationDraftText(manual)).toBe('Manual review locked (Telegram)')
  })

  test('orders founder covenant review rows by manual triage priority', () => {
    const manual = founderQueueItem()
    const tracked = founderQueueItem({
      areaId: 'founder-area-0011',
      areaLabel: 'Iasi Founder Block',
      founderCitizenId: 'founder-11',
      founderNumber: 11,
      covenantStatus: 'active',
      manualReviewRequired: false,
      overdue: false,
      activityReview: {
        ...manual.activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        score: 95,
      },
      economicExposure: {
        ...manual.economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
      blockerCount: 0,
    })
    const watch = founderQueueItem({
      areaId: 'founder-area-0013',
      areaLabel: 'Cluj Founder Block',
      founderCitizenId: 'founder-13',
      founderNumber: 13,
      covenantStatus: 'watch',
      manualReviewRequired: false,
      overdue: true,
      activityReview: {
        ...manual.activityReview,
        active: true,
        useful: true,
        building: true,
        staffed: false,
        hospitalized: false,
        atRisk: true,
        score: 64,
      },
      economicExposure: {
        ...manual.economicExposure,
        outstandingDebt: 50,
        debtCount: 1,
        unstaffedBusinessCount: 1,
        hospitalized: false,
      },
      signalCounts: { total: 1, info: 0, warning: 1, critical: 0 },
      signalKinds: ['review_due'],
      blockerCount: 1,
    })
    const rows = founderCovenantOperatorQueueReviewRows({
      items: [tracked, watch, manual],
    })

    expect(rows.map((row) => row.founderCitizenId)).toEqual(['founder-12', 'founder-13', 'founder-11'])
    expect(founderCovenantOperatorQueuePriorityScore(manual)).toBeGreaterThan(
      founderCovenantOperatorQueuePriorityScore(watch),
    )
    expect(founderCovenantOperatorQueuePriorityReasons(tracked)).toEqual(['tracked'])
  })

  test('renders an empty page as evidence-only review state', () => {
    const empty = {
      ...founderQueue(),
      hasMore: false,
      nextCursor: null,
      scanned: 0,
      caughtUp: 0,
      current: 0,
      items: [],
      results: [],
      totals: {
        ...founderQueue().totals,
        founders: 0,
        manualReviewRequired: 0,
        overdue: 0,
        hospitalized: 0,
        indebted: 0,
        totalOutstandingDebt: 0,
        blockers: 0,
      },
    }

    const html = renderToStaticMarkup(<FounderCovenantQueuePanel queue={empty} />)

    expect(html).toContain('0 founders · 0 manual reviews · 0 overdue · 0 hospitalized · 0 indebted · $0 debt')
    expect(html).toContain('No founders in this review page.')
  })
})

function founderQueue(): RealityFounderCovenantReviewQueueDashboard {
  const item = founderQueueItem()
  const current = founderQueueItem({
    areaId: 'founder-area-0013',
    areaLabel: 'Cluj Founder Block',
    founderCitizenId: 'founder-13',
    founderNumber: 13,
    covenantStatus: 'active',
    manualReviewRequired: false,
    overdue: false,
    economicExposure: {
      ...item.economicExposure,
      founderCash: 200_000,
      outstandingDebt: 0,
      debtCount: 0,
      businessCash: 45,
      businessCount: 1,
      unstaffedBusinessCount: 0,
      insured: true,
      hospitalized: false,
    },
    signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
    signalKinds: [],
    blockerCount: 0,
    scanStatus: 'current',
    transactionsAdded: 0,
  })

  return {
    generatedAt: '2026-07-06T04:00:00.000Z',
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    approvalWorkflowEnabled: false,
    limit: 2,
    pages: 1,
    pagesScanned: 1,
    cursor: 'review-cursor-1',
    nextCursor: 'review-cursor-2',
    scanned: 2,
    caughtUp: 1,
    current: 1,
    failed: 0,
    hasMore: true,
    totals: {
      founders: 2,
      active: 1,
      useful: 1,
      building: 1,
      staffed: 1,
      indebted: 1,
      hospitalized: 1,
      atRisk: 1,
      manualReviewRequired: 1,
      overdue: 1,
      totalFounderCash: 399_500,
      totalOutstandingDebt: 350,
      totalBusinessCash: 70,
      unstaffedBusinesses: 1,
      insuredFounders: 1,
      pendingApprovals: 1,
      pendingNotifications: 1,
      blockers: 3,
    },
    items: [item, current],
    results: [{
      citizenId: 'founder-12',
      areaId: 'founder-area-0012',
      status: 'caught_up',
      updatedAt: '2026-07-06T04:00:00.000Z',
      transactionsAdded: 1,
    }, {
      citizenId: 'founder-13',
      areaId: 'founder-area-0013',
      status: 'current',
      updatedAt: '2026-07-06T04:00:00.000Z',
      transactionsAdded: 0,
    }],
  }
}

function founderQueueItem(
  overrides: Partial<RealityFounderCovenantReviewQueueItem> = {},
): RealityFounderCovenantReviewQueueItem {
  return {
    areaId: 'founder-area-0012',
    areaLabel: 'Bucharest Founder Block',
    founderCitizenId: 'founder-12',
    founderNumber: 12,
    updatedAt: '2026-07-06T04:00:00.000Z',
    checkedAt: '2026-07-06T04:00:00.000Z',
    lastReviewAt: null,
    latestReview: null,
    nextWeeklyReviewAt: '2026-07-12T04:00:00.000Z',
    nextMonthlyReviewAt: '2026-08-05T04:00:00.000Z',
    overdue: true,
    covenantStatus: 'manual_review',
    nextAction: 'manual_review',
    manualReviewRequired: true,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    activityReview: {
      checkedAt: '2026-07-06T04:00:00.000Z',
      active: false,
      useful: false,
      building: true,
      staffed: false,
      indebted: true,
      hospitalized: true,
      atRisk: true,
      score: 35,
    },
    economicExposure: {
      founderCash: 199_500,
      outstandingDebt: 350,
      debtCount: 1,
      businessCash: 25,
      businessCount: 2,
      unstaffedBusinessCount: 1,
      insured: false,
      hospitalized: true,
      gameCreditsOnly: true,
      payoutEligibleCredits: 0,
      manualPayoutReviewRequired: true,
    },
    reviewQueue: {
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      nextStep: 'main_founder_approval',
      recordReviewEnabled: true,
      recommendedActionKinds: ['send_warning'],
      pendingApprovalKinds: ['send_warning'],
      pendingApprovalCount: 1,
      pendingNotificationKinds: ['manual_review_required'],
      pendingNotificationCount: 1,
      blockerCount: 3,
      blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled', 'replacement_disabled'],
    },
    signalCounts: { total: 2, info: 0, warning: 1, critical: 1 },
    signalKinds: ['founder_debt', 'review_due'],
    recommendedActionKinds: ['send_warning'],
    pendingApprovalRequests: [founderApprovalRequest()],
    pendingApprovalKinds: ['send_warning'],
    pendingNotificationDrafts: [founderNotificationDraft()],
    pendingNotificationKinds: ['manual_review_required'],
    blockerCount: 3,
    scanStatus: 'caught_up',
    transactionsAdded: 1,
    ...overrides,
  }
}

function founderNotificationDraft(): RealityFounderCovenantReviewQueueItem['pendingNotificationDrafts'][number] {
  return {
    id: 'founder-area-0012:1783310400000:covenant-notification:manual_review_required:founder-12',
    at: '2026-07-06T04:00:00.000Z',
    kind: 'manual_review_required',
    channel: 'telegram',
    recipientCitizenId: 'founder-12',
    title: 'Founder covenant manual review required',
    body: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
    requiresApproval: true,
    sendEnabled: false,
    authorityGate: {
      requiredRole: 'main_founder',
      status: 'approval_required',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
  }
}

function founderApprovalRequest(): RealityFounderCovenantReviewQueueItem['pendingApprovalRequests'][number] {
  return {
    id: 'founder-area-0012:1783310400000:covenant-approval:send_warning:founder-12',
    at: '2026-07-06T04:00:00.000Z',
    kind: 'send_warning',
    label: 'Send warning',
    reason: 'Founder covenant signals suggest a warning.',
    status: 'pending_manual_approval',
    recommended: true,
    requiresApproval: true,
    approvalEnabled: false,
    automationEnabled: false,
    executionEnabled: false,
    authorityGate: {
      requiredRole: 'main_founder',
      status: 'approval_required',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
    notificationDraftId: 'founder-area-0012:1783310400000:covenant-notification:founder_warning:founder-12',
    blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
  }
}
