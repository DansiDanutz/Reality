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
    expect(html).toContain('Signals: founder_debt, review_due')
    expect(html).toContain('manual only')
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
    pendingApprovalKinds: ['send_warning'],
    pendingNotificationKinds: ['manual_review_required'],
    blockerCount: 3,
    scanStatus: 'caught_up',
    transactionsAdded: 1,
    ...overrides,
  }
}
