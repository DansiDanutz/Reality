import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { RealityFounderCovenantReviewQueueDashboard } from '../../lib/realityArea'
import FounderCovenantOperatorPanel from './FounderCovenantOperatorPanel'
import {
  queueContextText,
  queueCoveragePresetLabel,
  queuePresetChipTone,
  queueSortChipTone,
  queueViewChipTone,
} from './founderCovenantOperatorQueueView'

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
    expect(html).toContain('Activity: Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes')
    expect(html).toContain('Exposure: Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only')
    expect(html).toContain('Stages: Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement')
    expect(html).toContain('Readiness: Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue')
    expect(html).toContain('Evidence: Population growth, External contribution, Ideas and feedback')
    expect(html).toContain('Actions: Record review evidence-only, Send warning locked')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('Priority: manual review, never reviewed, overdue, hospitalized, at risk')
    expect(html).toContain('Filter: All')
    expect(html).toContain('1 founder in current page · 1 never · 0 stale · 0 fresh')
    expect(html).toContain('All 1 · Never 1 · Stale 0 · Fresh 0 · Manual 1 · Hospital 1 · Scan 0')
    expect(html).toContain('Sort: Priority')
    expect(html).toContain('Coverage')
    expect(html).toContain('<span>Never</span><strong>1</strong>')
    expect(html).toContain('<span>Fresh</span><strong>0</strong>')
    expect(html).toContain('<span>Stale</span><strong>0</strong>')
    expect(html).toContain('aria-label="Founder operator queue view summary"')
    expect(html).toContain('class="founder-ledger-chip stable"><span>View</span><strong>All</strong>')
    expect(html).toContain('class="founder-ledger-chip stable"><span>Sort</span><strong>Priority</strong>')
    expect(html).not.toContain('<span>Preset</span>')
    expect(html).toContain('<span>Cursor</span><strong>start</strong>')
    expect(html).toContain('<span>Resume</span><strong>more</strong>')
    expect(html).toContain('Record evidence')
    expect(html).toContain('Copy view')
    expect(html).toContain('Clear copied')
    expect(html).toContain('Refresh page')
    expect(html).toContain('Restart scan')
    expect(html).toContain('Never')
    expect(html).toContain('Stale')
    expect(html).toContain('Fresh')
    expect(html).toContain('Default View')
    expect(html).toContain('Coverage All')
    expect(html).toContain('Cleanup Never')
    expect(html).toContain('Cleanup Stale')
    expect(html).toContain('Audit Fresh')
    expect(html).toContain('class="btn small primary" type="button">All</button>')
    expect(html).toContain('class="btn small primary" type="button">Priority</button>')
    expect(html).toContain('class="btn small primary" type="button">Default View</button>')
    expect(html).toContain('Founder #')
    expect(html).toContain('Next page')
    expect(html).toContain('More founders available')
    expect(html).toContain('Copy status: not copied yet')
    expect(html).toContain('View: All / Priority / start')
    expect(html).toContain('Start of queue · more founders available')
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

  test('derives coverage preset context from filter and sort state', () => {
    expect(queueCoveragePresetLabel('all', 'coverage')).toBe('Coverage All')
    expect(queueCoveragePresetLabel('never_reviewed', 'coverage')).toBe('Cleanup Never')
    expect(queueCoveragePresetLabel('stale_reviewed', 'coverage')).toBe('Cleanup Stale')
    expect(queueCoveragePresetLabel('fresh_reviewed', 'coverage')).toBe('Audit Fresh')
    expect(queueCoveragePresetLabel('manual_review', 'coverage')).toBeNull()
    expect(queueViewChipTone('all')).toBe('stable')
    expect(queueViewChipTone('never_reviewed')).toBe('warning')
    expect(queueSortChipTone('priority')).toBe('stable')
    expect(queueSortChipTone('coverage')).toBe('warning')
    expect(queuePresetChipTone('all', 'priority')).toBe('stable')
    expect(queuePresetChipTone('all', 'coverage')).toBe('critical')
    expect(queueContextText('all', 'coverage', null)).toBe(
      'View: All / Coverage / start · Preset: Coverage All',
    )
    expect(queueContextText('stale_reviewed', 'coverage', 'cursor-2')).toBe(
      'View: Stale / Coverage / cursor-2 · Preset: Cleanup Stale',
    )
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
      neverReviewed: 1,
      freshReviewed: 0,
      staleReviewed: 0,
      scanAnomalies: 0,
      weeklyDue: 0,
      monthlyDue: 0,
      warningApprovals: 1,
      probationApprovals: 0,
      replacementApprovals: 0,
      warningDrafts: 0,
      manualReviewDrafts: 1,
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
      activitySignals: [{
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
      }],
      reviewInputs: [{
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
      }],
      stages: [{
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
      }],
      reviewReadiness: {
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
      },
      reviewChecklist: [{
        key: 'active',
        label: 'Active',
        status: 'manual_review',
        evidence: 'Founder is unavailable and needs manual review.',
      }],
      manualActions: [{
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
      }],
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
