import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type {
  RealityFounderCovenantReviewQueueDashboard,
  RealityFounderCovenantReviewQueueItem,
} from '../../lib/realityArea'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'
import {
  founderCovenantOperatorQueueActivitySignalText,
  founderCovenantOperatorQueueEconomicExposureText,
  founderCovenantOperatorQueueFilterCountsSummary,
  founderCovenantOperatorQueueFilteredReviewRows,
  founderCovenantOperatorQueueFilterSummary,
  founderCovenantOperatorQueueItemDateSummary,
  founderCovenantOperatorQueueItemStatusClass,
  founderCovenantOperatorQueueItemStatusLabel,
  founderCovenantOperatorQueueItemTitle,
  founderCovenantOperatorQueueApprovalRequestText,
  founderCovenantOperatorQueueChecklistText,
  founderCovenantOperatorQueueEvidenceInputText,
  founderCovenantOperatorQueueManualActionText,
  founderCovenantOperatorQueueNotificationDraftText,
  founderCovenantOperatorQueueReviewReadinessText,
  founderCovenantOperatorQueueSliceTotals,
  founderCovenantOperatorQueueStageText,
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
    expect(html).toContain('2 founders · 1 manual review · 1 never reviewed · 0 freshly reviewed · 0 stale reviews · 0 stale weekly · 0 stale monthly · 0 scan anomalies · 0 weekly due · 0 monthly due · 1 warning approval · 0 probation approvals · 0 replacement approvals · 0 warning drafts · 1 manual-review draft · 1 overdue · 1 hospitalized · 1 indebted · $350 debt · more available')
    expect(html).toContain('2 scanned · 1 caught up · 1 current · 0 failed · 1 never · 0 stale · 0 fresh · next page ready')
    expect(html).toContain('Filter: All')
    expect(html).toContain('2 founders in current page')
    expect(html).toContain('All 2 · Never 2 · Stale 0 · Stale week 0 · Stale month 0 · Fresh 0 · Manual 1 · Evidence 1 · Overdue 1 · Blocked 1 · Hospital 1 · Scan 0')
    expect(html).toContain('Sort: Priority')
    expect(html).toContain('<span>Never</span><strong>2</strong>')
    expect(html).toContain('<span>Fresh</span><strong>0</strong>')
    expect(html).toContain('<span>Stale</span><strong>0</strong>')
    expect(html).toContain('<span>Stale week</span><strong>0</strong>')
    expect(html).toContain('<span>Stale month</span><strong>0</strong>')
    expect(html).toContain('<span>Weekly</span><strong>0</strong>')
    expect(html).toContain('<span>Monthly</span><strong>0</strong>')
    expect(html).toContain('aria-label="Founder operator queue coverage"')
    expect(html).toContain('<span>Active</span><strong>1</strong>')
    expect(html).toContain('<span>Useful</span><strong>1</strong>')
    expect(html).toContain('<span>Building</span><strong>2</strong>')
    expect(html).toContain('<span>Staffed</span><strong>1</strong>')
    expect(html).toContain('<span>At risk</span><strong>1</strong>')
    expect(html).toContain('#0012 · Bucharest Founder Block')
    expect(html).toContain('founder-12 · Manual review · manual review · never reviewed · score 35/100 · $350 debt')
    expect(html).toContain('Activity: Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes')
    expect(html).toContain('Exposure: Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only')
    expect(html).toContain('Stages: Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement')
    expect(html).toContain('Readiness: Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue')
    expect(html).toContain('Checklist: Manual: Active, Hospital, At risk · Watch: Useful, Staffed, Debt')
    expect(html).toContain('Evidence: Population growth, External contribution, Ideas and feedback')
    expect(html).toContain('Actions: Record review evidence-only, Send warning locked')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('Priority: manual review, never reviewed, overdue, hospitalized, at risk, inactive')
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
            reviewFreshness: 'fresh',
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
    expect(founderCovenantOperatorQueueItemDateSummary({
      ...manual,
      lastReviewAt: '2026-06-20T04:00:00.000Z',
      reviewFreshness: 'stale',
    })).toBe('caught up · checked 2026-07-06 · last 2026-06-20 (stale review) · weekly 2026-07-12 · monthly 2026-08-05')
    expect(founderCovenantOperatorQueueItemDateSummary({
      ...manual,
      weeklyReviewDue: true,
      monthlyReviewDue: false,
    })).toBe('caught up · checked 2026-07-06 · last none · weekly due · monthly 2026-08-05')
    expect(founderCovenantOperatorQueueActivitySignalText(manual)).toBe(
      'Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes',
    )
    expect(founderCovenantOperatorQueueEconomicExposureText(manual)).toBe(
      'Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only',
    )
    expect(founderCovenantOperatorQueueStageText(manual)).toBe(
      'Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement',
    )
    expect(founderCovenantOperatorQueueReviewReadinessText(manual)).toBe(
      'Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue',
    )
    expect(founderCovenantOperatorQueueChecklistText(manual)).toBe(
      'Manual: Active, Hospital, At risk · Watch: Useful, Staffed, Debt',
    )
    expect(founderCovenantOperatorQueueEvidenceInputText(manual)).toBe(
      'Population growth, External contribution, Ideas and feedback',
    )
    expect(founderCovenantOperatorQueueManualActionText(manual)).toBe(
      'Record review evidence-only, Send warning locked',
    )
    expect(founderCovenantOperatorQueueApprovalRequestText(manual)).toBe('Send warning locked (2 blockers)')
    expect(founderCovenantOperatorQueueNotificationDraftText(manual)).toBe('Manual review locked (Telegram)')
  })

  test('orders founder covenant review rows by manual triage priority', () => {
    const manual = founderQueueItem()
    const staleTracked = founderQueueItem({
      areaId: 'founder-area-0010',
      areaLabel: 'Constanta Founder Block',
      founderCitizenId: 'founder-10',
      founderNumber: 10,
      manualReviewRequired: false,
      covenantStatus: 'active',
      overdue: false,
      reviewFreshness: 'stale',
      lastReviewAt: '2026-06-20T04:00:00.000Z',
      activityReview: {
        ...manual.activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        indebted: false,
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
      transactionsAdded: 0,
    })
    const tracked = founderQueueItem({
      areaId: 'founder-area-0011',
      areaLabel: 'Iasi Founder Block',
      founderCitizenId: 'founder-11',
      founderNumber: 11,
      covenantStatus: 'active',
      manualReviewRequired: false,
      overdue: false,
      reviewFreshness: 'fresh',
      lastReviewAt: '2026-07-06T03:30:00.000Z',
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
      items: [tracked, watch, manual, staleTracked],
    })

    expect(rows.map((row) => row.founderCitizenId)).toEqual(['founder-12', 'founder-13', 'founder-10', 'founder-11'])
    expect(founderCovenantOperatorQueuePriorityScore(manual)).toBeGreaterThan(
      founderCovenantOperatorQueuePriorityScore(watch),
    )
    expect(founderCovenantOperatorQueuePriorityScore(staleTracked)).toBeGreaterThan(
      founderCovenantOperatorQueuePriorityScore(tracked),
    )
    expect(founderCovenantOperatorQueuePriorityReasons(manual)).toContain('never reviewed')
    expect(founderCovenantOperatorQueuePriorityReasons(staleTracked)).toContain('stale review')
    expect(founderCovenantOperatorQueuePriorityReasons(tracked)).toEqual(['tracked'])
  })

  test('orders founder covenant review rows by coverage risk', () => {
    const neverReviewed = founderQueueItem({
      areaId: 'founder-area-0012',
      founderCitizenId: 'founder-12',
      founderNumber: 12,
      reviewFreshness: 'never',
      lastReviewAt: null,
    })
    const staleReviewed = founderQueueItem({
      areaId: 'founder-area-0010',
      areaLabel: 'Constanta Founder Block',
      founderCitizenId: 'founder-10',
      founderNumber: 10,
      manualReviewRequired: false,
      covenantStatus: 'active',
      overdue: false,
      reviewFreshness: 'stale',
      lastReviewAt: '2026-06-20T04:00:00.000Z',
      activityReview: {
        ...neverReviewed.activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        indebted: false,
        score: 90,
      },
      economicExposure: {
        ...neverReviewed.economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
      blockerCount: 0,
      transactionsAdded: 0,
    })
    const freshReviewed = founderQueueItem({
      areaId: 'founder-area-0011',
      areaLabel: 'Iasi Founder Block',
      founderCitizenId: 'founder-11',
      founderNumber: 11,
      manualReviewRequired: false,
      covenantStatus: 'active',
      overdue: false,
      reviewFreshness: 'fresh',
      lastReviewAt: '2026-07-06T03:30:00.000Z',
      activityReview: {
        ...neverReviewed.activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        indebted: false,
        score: 95,
      },
      economicExposure: {
        ...neverReviewed.economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
      blockerCount: 0,
      transactionsAdded: 0,
    })

    expect(founderCovenantOperatorQueueFilteredReviewRows({
      items: [freshReviewed, staleReviewed, neverReviewed],
    }, 'all', 'coverage').map((row) => row.founderCitizenId)).toEqual(['founder-12', 'founder-10', 'founder-11'])
  })

  test('filters queue rows for manual review, evidence gaps, overdue, blocked, hospitalization, and scan anomalies', () => {
    const invalid = founderQueueItem({
      areaId: 'founder-area-0014',
      areaLabel: 'Timisoara Founder Block',
      founderCitizenId: 'founder-14',
      founderNumber: 14,
      manualReviewRequired: false,
      covenantStatus: 'watch',
      overdue: false,
      scanStatus: 'invalid',
      activityReview: {
        ...founderQueueItem().activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        score: 81,
      },
      economicExposure: {
        ...founderQueueItem().economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      reviewReadiness: {
        status: 'monitoring',
        label: 'Monitoring',
        summary: 'Scan anomaly needs review, but no approval workflow is blocked.',
        evidenceRequiredCount: 0,
        approvalRequestCount: 0,
        blockerCount: 0,
        overdue: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      },
      reviewQueue: {
        ...founderQueueItem().reviewQueue,
        nextStep: 'monitor',
        recommendedActionKinds: [],
        pendingApprovalKinds: [],
        pendingApprovalCount: 0,
        pendingNotificationKinds: [],
        pendingNotificationCount: 0,
        blockerCount: 0,
        blockers: [],
      },
      manualActions: [{
        ...founderManualActions()[0],
        recommended: false,
        reason: 'Scan anomaly review is observational until evidence is recorded.',
      }],
      pendingApprovalRequests: [],
      pendingApprovalKinds: [],
      pendingNotificationDrafts: [],
      pendingNotificationKinds: [],
      blockerCount: 0,
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
    })
    const queue = {
      ...founderQueue(),
      items: [founderQueueItem(), founderQueue().items[1], invalid],
    }
    const stale = founderQueueItem({
      areaId: 'founder-area-0015',
      areaLabel: 'Brasov Founder Block',
      founderCitizenId: 'founder-15',
      founderNumber: 15,
      manualReviewRequired: false,
      covenantStatus: 'watch',
      overdue: false,
      reviewFreshness: 'stale',
      lastReviewAt: '2026-06-20T04:00:00.000Z',
      activityReview: {
        ...founderQueueItem().activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        indebted: false,
        score: 82,
      },
      economicExposure: {
        ...founderQueueItem().economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      reviewReadiness: {
        status: 'monitoring',
        label: 'Monitoring',
        summary: 'Stale cadence needs review coverage, but no approval workflow is blocked.',
        evidenceRequiredCount: 0,
        approvalRequestCount: 0,
        blockerCount: 0,
        overdue: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      },
      reviewQueue: {
        ...founderQueueItem().reviewQueue,
        nextStep: 'monitor',
        recommendedActionKinds: [],
        pendingApprovalKinds: [],
        pendingApprovalCount: 0,
        pendingNotificationKinds: [],
        pendingNotificationCount: 0,
        blockerCount: 0,
        blockers: [],
      },
      manualActions: [{
        ...founderManualActions()[0],
        recommended: false,
        reason: 'Stale review coverage is being monitored without blocked approvals.',
      }],
      pendingApprovalRequests: [],
      pendingApprovalKinds: [],
      pendingNotificationDrafts: [],
      pendingNotificationKinds: [],
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
      blockerCount: 0,
      transactionsAdded: 0,
    })
    const queueWithStale = {
      ...queue,
      items: [...queue.items, stale],
    }
    const fresh = founderQueueItem({
      areaId: 'founder-area-0016',
      areaLabel: 'Sibiu Founder Block',
      founderCitizenId: 'founder-16',
      founderNumber: 16,
      manualReviewRequired: false,
      covenantStatus: 'active',
      overdue: false,
      reviewFreshness: 'fresh',
      lastReviewAt: '2026-07-06T03:30:00.000Z',
      activityReview: {
        ...founderQueueItem().activityReview,
        active: true,
        useful: true,
        staffed: true,
        hospitalized: false,
        atRisk: false,
        indebted: false,
        score: 88,
      },
      economicExposure: {
        ...founderQueueItem().economicExposure,
        outstandingDebt: 0,
        debtCount: 0,
        unstaffedBusinessCount: 0,
        hospitalized: false,
      },
      reviewReadiness: {
        status: 'ready',
        label: 'Ready',
        summary: 'Fresh review is current with no approval blockers.',
        evidenceRequiredCount: 0,
        approvalRequestCount: 0,
        blockerCount: 0,
        overdue: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      },
      reviewQueue: {
        ...founderQueueItem().reviewQueue,
        nextStep: 'monitor',
        recommendedActionKinds: [],
        pendingApprovalKinds: [],
        pendingApprovalCount: 0,
        pendingNotificationKinds: [],
        pendingNotificationCount: 0,
        blockerCount: 0,
        blockers: [],
      },
      manualActions: [{
        ...founderManualActions()[0],
        recommended: false,
        reason: 'Fresh review needs monitoring only.',
      }],
      pendingApprovalRequests: [],
      pendingApprovalKinds: [],
      pendingNotificationDrafts: [],
      pendingNotificationKinds: [],
      signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
      signalKinds: [],
      blockerCount: 0,
      transactionsAdded: 0,
    })
    const queueWithCoverage = {
      ...queueWithStale,
      items: [...queueWithStale.items, fresh],
    }

    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'never_reviewed').map((row) => row.founderCitizenId)).toEqual(['founder-12', 'founder-14', 'founder-13'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queueWithStale, 'stale_reviewed').map((row) => row.founderCitizenId)).toEqual(['founder-15'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queueWithStale, 'stale_weekly_due').map((row) => row.founderCitizenId)).toEqual([])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queueWithStale, 'stale_monthly_due').map((row) => row.founderCitizenId)).toEqual([])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queueWithCoverage, 'fresh_reviewed').map((row) => row.founderCitizenId)).toEqual(['founder-16'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'manual_review').map((row) => row.founderCitizenId)).toEqual(['founder-12'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'needs_evidence').map((row) => row.founderCitizenId)).toEqual(['founder-12'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'overdue').map((row) => row.founderCitizenId)).toEqual(['founder-12'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'blocked').map((row) => row.founderCitizenId)).toEqual(['founder-12'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'hospitalized').map((row) => row.founderCitizenId)).toEqual(['founder-12'])
    expect(founderCovenantOperatorQueueFilteredReviewRows(queue, 'scan_anomaly', 'founder').map((row) => row.founderCitizenId)).toEqual(['founder-14'])
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'never_reviewed')).toBe('3 founders never reviewed · 3 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queueWithStale, 'stale_reviewed')).toBe('1 founder stale reviewed · 0 never · 1 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queueWithStale, 'stale_weekly_due')).toBe('0 founders stale weekly due · 0 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queueWithStale, 'stale_monthly_due')).toBe('0 founders stale monthly due · 0 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queueWithCoverage, 'fresh_reviewed')).toBe('1 founder fresh reviewed · 0 never · 0 stale · 1 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'manual_review')).toBe('1 founder need manual review · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'needs_evidence')).toBe('1 founder need manual evidence · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'overdue')).toBe('1 founder overdue · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'blocked')).toBe('1 founder blocked by workflow gaps · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'hospitalized')).toBe('1 founder hospitalized · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterSummary(queue, 'scan_anomaly')).toBe('1 founder with scan anomalies · 1 never · 0 stale · 0 fresh')
    expect(founderCovenantOperatorQueueFilterCountsSummary(queue)).toBe('All 3 · Never 3 · Stale 0 · Stale week 0 · Stale month 0 · Fresh 0 · Manual 1 · Evidence 1 · Overdue 1 · Blocked 1 · Hospital 1 · Scan 1')
    expect(founderCovenantOperatorQueueFilterCountsSummary(queueWithStale)).toBe('All 4 · Never 3 · Stale 1 · Stale week 0 · Stale month 0 · Fresh 0 · Manual 1 · Evidence 1 · Overdue 1 · Blocked 1 · Hospital 1 · Scan 1')
    expect(founderCovenantOperatorQueueFilterCountsSummary(queueWithCoverage)).toBe('All 5 · Never 3 · Stale 1 · Stale week 0 · Stale month 0 · Fresh 1 · Manual 1 · Evidence 1 · Overdue 1 · Blocked 1 · Hospital 1 · Scan 1')
    expect(founderCovenantOperatorQueueSliceTotals(queue, 'never_reviewed')).toMatchObject({
      founders: 3,
      neverReviewed: 3,
      freshReviewed: 0,
      staleReviewed: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
    })
    expect(founderCovenantOperatorQueueSliceTotals(queueWithStale, 'stale_reviewed')).toMatchObject({
      founders: 1,
      neverReviewed: 0,
      freshReviewed: 0,
      staleReviewed: 1,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
    })
    expect(founderCovenantOperatorQueueSliceTotals(queueWithStale, 'stale_weekly_due')).toMatchObject({
      founders: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
    })
    expect(founderCovenantOperatorQueueSliceTotals(queueWithStale, 'stale_monthly_due')).toMatchObject({
      founders: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
    })
    expect(founderCovenantOperatorQueueSliceTotals(queueWithCoverage, 'fresh_reviewed')).toMatchObject({
      founders: 1,
      neverReviewed: 0,
      freshReviewed: 1,
      staleReviewed: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
    })
    expect(founderCovenantOperatorQueueSliceTotals(queue, 'manual_review')).toMatchObject({
      founders: 1,
      manualReviewRequired: 1,
      hospitalized: 1,
      active: 0,
      building: 1,
      staffed: 0,
      atRisk: 1,
    })
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
        neverReviewed: 0,
        freshReviewed: 0,
        staleReviewed: 0,
        staleWeeklyDue: 0,
        staleMonthlyDue: 0,
        scanAnomalies: 0,
        weeklyDue: 0,
        monthlyDue: 0,
        warningApprovals: 0,
        probationApprovals: 0,
        replacementApprovals: 0,
        warningDrafts: 0,
        manualReviewDrafts: 0,
        overdue: 0,
        hospitalized: 0,
        indebted: 0,
        totalOutstandingDebt: 0,
        blockers: 0,
      },
    }

    const html = renderToStaticMarkup(<FounderCovenantQueuePanel queue={empty} />)

    expect(html).toContain('0 founders · 0 manual reviews · 0 never reviewed · 0 freshly reviewed · 0 stale reviews · 0 stale weekly · 0 stale monthly · 0 scan anomalies · 0 weekly due · 0 monthly due · 0 warning approvals · 0 probation approvals · 0 replacement approvals · 0 warning drafts · 0 manual-review drafts · 0 overdue · 0 hospitalized · 0 indebted · $0 debt')
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
    activityReview: {
      ...item.activityReview,
      active: true,
      useful: true,
      staffed: true,
      indebted: false,
      hospitalized: false,
      atRisk: false,
      score: 92,
    },
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
    reviewReadiness: {
      status: 'ready',
      label: 'Ready',
      summary: 'No approval blockers are holding this founder.',
      evidenceRequiredCount: 0,
      approvalRequestCount: 0,
      blockerCount: 0,
      overdue: false,
      manualOnly: true,
      automationEnabled: false,
      executionEnabled: false,
    },
    reviewQueue: {
      ...item.reviewQueue,
      nextStep: 'monitor',
      recommendedActionKinds: [],
      pendingApprovalKinds: [],
      pendingApprovalCount: 0,
      pendingNotificationKinds: [],
      pendingNotificationCount: 0,
      blockerCount: 0,
      blockers: [],
    },
    manualActions: [{
      ...founderManualActions()[0],
      recommended: false,
      reason: 'No additional review action is suggested for this founder yet.',
    }],
    pendingApprovalRequests: [],
    pendingApprovalKinds: [],
    pendingNotificationDrafts: [],
    pendingNotificationKinds: [],
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
      neverReviewed: 1,
      freshReviewed: 0,
      staleReviewed: 0,
      staleWeeklyDue: 0,
      staleMonthlyDue: 0,
      scanAnomalies: 0,
      weeklyDue: 0,
      monthlyDue: 0,
      warningApprovals: 1,
      probationApprovals: 0,
      replacementApprovals: 0,
      warningDrafts: 0,
      manualReviewDrafts: 1,
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
    reviewFreshness: 'never',
    latestReview: null,
    nextWeeklyReviewAt: '2026-07-12T04:00:00.000Z',
    nextMonthlyReviewAt: '2026-08-05T04:00:00.000Z',
    weeklyReviewDue: false,
    monthlyReviewDue: false,
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
    activitySignals: founderActivitySignals(),
    reviewInputs: founderReviewInputs(),
    stages: founderStages(),
    reviewReadiness: founderReviewReadiness(),
    reviewChecklist: founderReviewChecklist(),
    manualActions: founderManualActions(),
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

function founderStages(): RealityFounderCovenantReviewQueueItem['stages'] {
  return [{
    kind: 'active',
    label: 'Active',
    status: 'locked',
    reason: 'Founder has covenant signals requiring reviewer attention.',
    requiresMainFounderApproval: false,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'warning',
    label: 'Warning',
    status: 'recommended',
    reason: 'Covenant signals suggest a manual founder warning.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'probation',
    label: 'Probation',
    status: 'locked',
    reason: 'Founder score and signals do not suggest probation.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'removed',
    label: 'Removed',
    status: 'locked',
    reason: 'Removal is not suggested by current covenant signals.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    kind: 'waitlist_replacement',
    label: 'Waitlist replacement',
    status: 'locked',
    reason: 'Waitlist handoff is disabled until the manual replacement workflow is approved.',
    requiresMainFounderApproval: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }]
}

function founderActivitySignals(): RealityFounderCovenantReviewQueueItem['activitySignals'] {
  return [{
    key: 'active',
    label: 'Active',
    value: false,
    status: 'manual_review',
    summary: 'No recent founder activity is visible.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'useful',
    label: 'Useful',
    value: false,
    status: 'watch',
    summary: 'Usefulness needs reviewer evidence.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'building',
    label: 'Building',
    value: true,
    status: 'met',
    summary: 'Founder has built or owns local business activity.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'staffed',
    label: 'Staffed',
    value: false,
    status: 'watch',
    summary: 'Founder businesses need staffing attention.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'indebted',
    label: 'Indebted',
    value: true,
    status: 'watch',
    summary: 'Founder has outstanding debt.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'hospitalized',
    label: 'Hospitalized',
    value: true,
    status: 'manual_review',
    summary: 'Founder is unavailable in hospital.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }, {
    key: 'at_risk',
    label: 'At risk',
    value: true,
    status: 'manual_review',
    summary: 'Founder covenant status requires manual attention.',
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }]
}

function founderReviewReadiness(): RealityFounderCovenantReviewQueueItem['reviewReadiness'] {
  return {
    status: 'blocked',
    label: 'Blocked',
    summary: '3 approval blockers before enforcement.',
    evidenceRequiredCount: 3,
    approvalRequestCount: 1,
    blockerCount: 3,
    overdue: true,
    manualOnly: true,
    automationEnabled: false,
    executionEnabled: false,
  }
}

function founderManualActions(): RealityFounderCovenantReviewQueueItem['manualActions'] {
  return [{
    kind: 'record_review',
    label: 'Record review',
    recommended: true,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: {
      requiredRole: 'area_reviewer',
      status: 'evidence_only',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
    reason: 'Reviewer notes are manual evidence only; no automatic enforcement runs.',
    clientPayload: null,
  }, {
    kind: 'send_warning',
    label: 'Send warning',
    recommended: true,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: {
      requiredRole: 'main_founder',
      status: 'approval_required',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
    reason: 'Covenant signals suggest a manual founder warning.',
    clientPayload: null,
  }, {
    kind: 'start_probation',
    label: 'Start probation',
    recommended: false,
    requiresApproval: true,
    automationEnabled: false,
    authorityGate: {
      requiredRole: 'main_founder',
      status: 'approval_required',
      approvedById: null,
      approvedAt: null,
      executionEnabled: false,
    },
    reason: 'Founder score and signals do not suggest probation.',
    clientPayload: null,
  }]
}

function founderReviewInputs(): RealityFounderCovenantReviewQueueItem['reviewInputs'] {
  return [{
    kind: 'in_game_activity',
    label: 'In-game activity',
    status: 'watch',
    evidence: 'Founder needs more visible in-game building or demand-serving activity.',
    manualEvidenceRequired: false,
  }, {
    kind: 'area_health',
    label: 'Area health',
    status: 'watch',
    evidence: 'Area health has service or staffing issues to review.',
    manualEvidenceRequired: false,
  }, {
    kind: 'population_growth',
    label: 'Population growth',
    status: 'manual_needed',
    evidence: 'Invite quality and local population growth need manual proof until invite tracking exists.',
    manualEvidenceRequired: true,
  }, {
    kind: 'external_contribution',
    label: 'External contribution',
    status: 'manual_needed',
    evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
    manualEvidenceRequired: true,
  }, {
    kind: 'ideas_feedback',
    label: 'Ideas and feedback',
    status: 'manual_needed',
    evidence: 'Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
    manualEvidenceRequired: true,
  }, {
    kind: 'review_consistency',
    label: 'Review consistency',
    status: 'watch',
    evidence: 'Weekly/monthly review cadence is due or overdue.',
    manualEvidenceRequired: false,
  }]
}

function founderReviewChecklist(): RealityFounderCovenantReviewQueueItem['reviewChecklist'] {
  return [{
    key: 'active',
    label: 'Active',
    status: 'manual_review',
    evidence: 'Founder is unavailable and needs manual review.',
  }, {
    key: 'useful',
    label: 'Useful',
    status: 'watch',
    evidence: 'Founder needs useful activity serving local demand.',
  }, {
    key: 'building',
    label: 'Building',
    status: 'met',
    evidence: 'Founder owns at least one local business.',
  }, {
    key: 'staffed',
    label: 'Staffed',
    status: 'watch',
    evidence: 'Founder businesses need staff before review can clear.',
  }, {
    key: 'debt',
    label: 'Debt',
    status: 'watch',
    evidence: 'Founder has unpaid debt to review before profit or succession.',
  }, {
    key: 'hospital',
    label: 'Hospital',
    status: 'manual_review',
    evidence: 'Founder is hospitalized; replacement remains manual.',
  }, {
    key: 'risk',
    label: 'At risk',
    status: 'manual_review',
    evidence: 'Covenant signals need weekly/monthly review.',
  }, {
    key: 'manual_authority',
    label: 'Manual authority',
    status: 'met',
    evidence: 'Automatic removal and waitlist handoff are disabled.',
  }]
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
