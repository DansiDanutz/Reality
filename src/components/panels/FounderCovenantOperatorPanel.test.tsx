import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import FounderCovenantOperatorPanel from './FounderCovenantOperatorPanel'

describe('FounderCovenantOperatorPanel', () => {
  test('renders an isolated operator queue shell without a loaded token', () => {
    const html = renderToStaticMarkup(<FounderCovenantOperatorPanel />)

    expect(html).toContain('Founder Ops')
    expect(html).toContain('Operator token')
    expect(html).toContain('Telegram operator auth idle')
    expect(html).toContain('enforcement locked')
    expect(html).toContain('ephemeral token')
    expect(html).toContain('player state isolated')
    expect(html).toContain('evidence writes only')
    expect(html).toContain('Review note')
    expect(html).toContain('Population')
    expect(html).toContain('No operator queue loaded.')
    expect(html).not.toContain('operator-token')
    expect(html).not.toContain('Approve')
    expect(html).not.toContain('Replace')
  })

  test('renders an initial queue through the evidence-only queue panel', () => {
    const html = renderToStaticMarkup(<FounderCovenantOperatorPanel initialQueue={operatorQueue()} />)

    expect(html).toContain('Founder Review Queue')
    expect(html).toContain('Evidence only')
    expect(html).toContain('#0012 · Bucharest Founder Block')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('Priority: manual review, overdue, hospitalized, at risk')
    expect(html).toContain('Record evidence')
    expect(html).toContain('Next page')
    expect(html).toContain('More founders available')
    expect(html).not.toContain('operator-token')
  })

  test('renders an operator authority error without queue data', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel initialError="Founder covenant review queue requires an operator token." />,
    )

    expect(html).toContain('Founder covenant review queue requires an operator token.')
    expect(html).not.toContain('Founder Review Queue')
  })

  test('renders Telegram operator readiness without printing the scoped token', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialOperatorAuth={{ status: 'ready', expiresAt: Date.parse('2026-07-06T12:15:00.000Z') }}
      />,
    )

    expect(html).toContain('Telegram operator ready until 12:15 UTC')
    expect(html).toContain('Operator token')
    expect(html).not.toContain('operator-token')
    expect(html).not.toContain('roqt1.')
  })

  test('keeps manual operator token fallback visible when Telegram auth is unavailable', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantOperatorPanel
        initialOperatorAuth={{
          status: 'unavailable',
          message: 'Telegram Mini App session not detected. Manual operator token remains available.',
        }}
      />,
    )

    expect(html).toContain('Telegram Mini App session not detected. Manual operator token remains available.')
    expect(html).toContain('Operator token')
    expect(html).toContain('Scan')
  })
})

function operatorQueue(): RealityFounderCovenantReviewQueueDashboard {
  return {
    generatedAt: '2026-07-06T04:00:00.000Z',
    evidenceOnly: true,
    automationEnabled: false,
    executionEnabled: false,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    approvalWorkflowEnabled: false,
    limit: 1,
    pages: 1,
    pagesScanned: 1,
    cursor: null,
    nextCursor: 'next-review-cursor',
    scanned: 1,
    caughtUp: 1,
    current: 0,
    failed: 0,
    hasMore: true,
    totals: {
      founders: 1,
      active: 0,
      useful: 0,
      building: 1,
      staffed: 0,
      indebted: 1,
      hospitalized: 1,
      atRisk: 1,
      manualReviewRequired: 1,
      overdue: 1,
      totalFounderCash: 199_500,
      totalOutstandingDebt: 350,
      totalBusinessCash: 25,
      unstaffedBusinesses: 1,
      insuredFounders: 0,
      pendingApprovals: 1,
      pendingNotifications: 1,
      blockers: 3,
    },
    items: [{
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
      pendingApprovalRequests: [{
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
      }],
      pendingApprovalKinds: ['send_warning'],
      pendingNotificationDrafts: [{
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
      }],
      pendingNotificationKinds: ['manual_review_required'],
      blockerCount: 3,
      scanStatus: 'caught_up',
      transactionsAdded: 1,
    }],
    results: [{
      citizenId: 'founder-12',
      areaId: 'founder-area-0012',
      status: 'caught_up',
      updatedAt: '2026-07-06T04:00:00.000Z',
      transactionsAdded: 1,
    }],
  }
}
