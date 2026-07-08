import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type {
  RealityFounderCovenantReviewQueueDashboard,
  RealityFounderCovenantReviewQueueItem,
} from '../../lib/realityArea'
import { FounderCovenantQueuePanel } from './FounderCovenantQueuePanel'
import {
  founderCovenantOperatorQueueActivitySignalText,
  founderCovenantOperatorQueueActivityReasonText,
  founderCovenantOperatorQueueApprovalBlockerText,
  founderCovenantOperatorQueueApprovalAuthorityText,
  founderCovenantOperatorQueueApprovalGateText,
  founderCovenantOperatorQueueApprovalNotificationLinkText,
  founderCovenantOperatorQueueApprovalReasonText,
  founderCovenantOperatorQueueApprovalStatusText,
  founderCovenantOperatorQueueApprovalTimelineText,
  founderCovenantOperatorQueueEconomicExposureText,
  founderCovenantOperatorQueueEvidenceReasonText,
  founderCovenantOperatorQueueItemDateSummary,
  founderCovenantOperatorQueueLatestReviewAuthorityText,
  founderCovenantOperatorQueueLatestReviewText,
  founderCovenantOperatorQueueManualActionReasonText,
  founderCovenantOperatorQueueNextActionText,
  founderCovenantOperatorQueueResultAnomalyText,
  founderCovenantOperatorQueueResultText,
  founderCovenantOperatorQueueFilteredReviewRows,
  founderCovenantOperatorQueueReviewQueueBlockerText,
  founderCovenantOperatorQueueRecommendedActionText,
  founderCovenantOperatorQueueSignalText,
  founderCovenantOperatorQueueSignalCountText,
  founderCovenantOperatorQueueUpdatedAtText,
  founderCovenantOperatorQueueWindowText,
  founderCovenantOperatorQueueItemStatusClass,
  founderCovenantOperatorQueueItemStatusLabel,
  founderCovenantOperatorQueueItemTitle,
  founderCovenantOperatorQueueApprovalRequestText,
  founderCovenantOperatorQueueChecklistText,
  founderCovenantOperatorQueueChecklistReasonText,
  founderCovenantOperatorQueueEvidenceInputText,
  founderCovenantOperatorQueueManualActionText,
  founderCovenantOperatorQueueNotificationDraftGateText,
  founderCovenantOperatorQueueNotificationDraftStatusText,
  founderCovenantOperatorQueueNotificationDraftText,
  founderCovenantOperatorQueueNotificationDraftBodyText,
  founderCovenantOperatorQueueNotificationDraftTitleText,
  founderCovenantOperatorQueueNotificationDraftRecipientText,
  founderCovenantOperatorQueueNotificationDraftAuthorityText,
  founderCovenantOperatorQueueNotificationDraftTimelineText,
  founderCovenantOperatorQueueReviewReadinessText,
  founderCovenantOperatorQueueStageReasonText,
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
    expect(html).toContain('2 founders · 1 manual review · 1 overdue · 1 hospitalized · 1 indebted · $350 debt · more available')
    expect(html).toContain('2 scanned · 1 caught up · 1 current · 0 failed · next page ready')
    expect(html).toContain('Generated 2026-07-06 04:00 UTC · pages 1/1 · cursor review-cursor-1 · next review-cursor-2')
    expect(html).toContain('founder-12: caught up · 1 tx · 2026-07-06 · founder-13: current · 0 tx · 2026-07-06')
    expect(html).toContain('Scan anomalies: none')
    expect(html).toContain('aria-label="Founder operator queue filters"')
    expect(html).toContain('Filter: All')
    expect(html).toContain('aria-label="Founder operator queue coverage"')
    expect(html).toContain('<span>Active</span><strong>1</strong>')
    expect(html).toContain('<span>Useful</span><strong>1</strong>')
    expect(html).toContain('<span>Building</span><strong>1</strong>')
    expect(html).toContain('<span>Staffed</span><strong>1</strong>')
    expect(html).toContain('<span>At risk</span><strong>1</strong>')
    expect(html).toContain('<span>Insured</span><strong>1</strong>')
    expect(html).toContain('<span>Approvals</span><strong>1</strong>')
    expect(html).toContain('<span>Drafts</span><strong>1</strong>')
    expect(html).toContain('#0012 · Bucharest Founder Block')
    expect(html).toContain('founder-12 · Manual review · manual review · score 35/100 · $350 debt')
    expect(html).toContain('Updated: 2026-07-06 · 1 tx')
    expect(html).toContain('Queue: Main founder approval · 1 approval · 1 draft')
    expect(html).toContain('Queue detail: Approvals: Send warning · Drafts: Manual review')
    expect(html).toContain('Queue status: Evidence only')
    expect(html).toContain('Queue blockers: approval workflow, Telegram delivery, replacement')
    expect(html).toContain('Next: Manual review')
    expect(html).toContain('Recommended: Send warning')
    expect(html).toContain('Activity: Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes')
    expect(html).toContain('Activity reasons: Active: No recent founder activity is visible. · Useful: Usefulness needs reviewer evidence. · Building: Founder has built or owns local business activity. · Staffed: Founder businesses need staffing attention. · Indebted: Founder has outstanding debt. · Hospitalized: Founder is unavailable in hospital. · At risk: Founder covenant status requires manual attention.')
    expect(html).toContain('Exposure: Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only')
    expect(html).toContain('Stages: Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement')
    expect(html).toContain('Stage reasons: Active: Founder has covenant signals requiring reviewer attention. · Warning: Covenant signals suggest a manual founder warning. · Probation: Founder score and signals do not suggest probation. · Removed: Removal is not suggested by current covenant signals. · Waitlist replacement: Waitlist handoff is disabled until the manual replacement workflow is approved.')
    expect(html).toContain('Readiness: Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue')
    expect(html).toContain('Checklist: Manual: Active, Hospital, At risk · Watch: Useful, Staffed, Debt')
    expect(html).toContain('Checklist reasons: Active: Founder is unavailable and needs manual review. · Useful: Founder needs useful activity serving local demand. · Building: Founder owns at least one local business. · Staffed: Founder businesses need staff before review can clear. · Debt: Founder has unpaid debt to review before profit or succession. · Hospital: Founder is hospitalized; replacement remains manual. · At risk: Covenant signals need weekly/monthly review. · Manual authority: Automatic removal and waitlist handoff are disabled.')
    expect(html).toContain('Evidence: Population growth, External contribution, Ideas and feedback')
    expect(html).toContain('Evidence reasons: Population growth: Invite quality and local population growth need manual proof until invite tracking exists. · External contribution: GitHub, code, design, docs, and testing contributions must be attached by reviewers manually. · Ideas and feedback: Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.')
    expect(html).toContain('Actions: Record review evidence-only, Send warning locked')
    expect(html).toContain('Action reasons: Record review: Reviewer notes are manual evidence only; no automatic enforcement runs. · Send warning: Covenant signals suggest a manual founder warning.')
    expect(html).toContain('Approvals: Send warning locked (2 blockers)')
    expect(html).toContain('Approval reasons: Send warning: Founder covenant signals suggest a warning.')
    expect(html).toContain('Approval status: Send warning: Locked')
    expect(html).toContain('Approval authority: Main founder / Approval required')
    expect(html).toContain('Approval gates: Main founder approval · 2 blockers')
    expect(html).toContain('Approval blockers: approval workflow, Telegram delivery')
    expect(html).toContain('Approval timeline: Send warning: 2026-07-06 04:00 UTC')
    expect(html).toContain('Approval draft link: Send warning -&gt; founder-area-0012:1783310400000:covenant-notification:founder_warning:founder-12')
    expect(html).toContain('Drafts: Manual review locked (Telegram)')
    expect(html).toContain('Draft titles: Founder covenant manual review required')
    expect(html).toContain('Draft body: Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.')
    expect(html).toContain('Draft recipient: Telegram -&gt; founder-12')
    expect(html).toContain('Draft authority: Main founder / Approval required')
    expect(html).toContain('Draft gates: Main founder approval required / Delivery disabled')
    expect(html).toContain('Draft status: Disabled')
    expect(html).toContain('Draft timeline: Manual review: 2026-07-06 04:00 UTC · founder-area-0012:1783310400000:covenant-notification:manual_review_required:founder-12')
    expect(html).toContain('Signal counts: 2 total · 0 info · 1 warning · 1 critical')
    expect(html).toContain('Priority score: 1497')
    expect(html).toContain('Priority: manual review, overdue, hospitalized, at risk, inactive')
    expect(html).toContain('Signals: Founder debt, Review due')
    expect(html).toContain('manual only')
    expect(html).not.toContain('>Approve<')
    expect(html).not.toContain('>Replace<')
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
              authorityGate: areaReviewerEvidenceGate(),
              evidenceOnly: true,
              automationEnabled: false,
            },
          })],
        }}
      />,
    )

    expect(html).toContain('Latest review 2026-07-06 · Record review · Evidence only · telegram-operator:42424242 · Reviewed contribution and ideas evidence.')
    expect(html).toContain('Authority: Area reviewer / Evidence only')
    expect(html).toContain('Queue: Main founder approval · 1 approval · 1 draft')
    expect(html).not.toContain('>Approve<')
    expect(html).not.toContain('>Replace<')
  })

  test('renders evidence recording controls only when an operator handler is provided', () => {
    const html = renderToStaticMarkup(
      <FounderCovenantQueuePanel canRecordReview onRecordReview={() => undefined} queue={founderQueue()} />,
    )

    expect(html).toContain('Record evidence')
    expect(html).not.toContain('>Approve<')
    expect(html).not.toContain('>Replace<')
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
    expect(founderCovenantOperatorQueueActivitySignalText(manual)).toBe(
      'Manual: Active no, Hospitalized yes, At risk yes · Watch: Useful no, Staffed no, Indebted yes · Met: Building yes',
    )
    expect(founderCovenantOperatorQueueActivityReasonText(manual)).toBe(
      'Active: No recent founder activity is visible. · Useful: Usefulness needs reviewer evidence. · Building: Founder has built or owns local business activity. · Staffed: Founder businesses need staffing attention. · Indebted: Founder has outstanding debt. · Hospitalized: Founder is unavailable in hospital. · At risk: Founder covenant status requires manual attention.',
    )
    expect(founderCovenantOperatorQueueEconomicExposureText(manual)).toBe(
      'Founder $199,500 · debt $350 (1) · businesses 2 / $25 · unstaffed 1 · uninsured · hospitalized · game credits only',
    )
    expect(founderCovenantOperatorQueueStageText(manual)).toBe(
      'Suggested: Warning · Locked: Active, Probation, Removed, Waitlist replacement',
    )
    expect(founderCovenantOperatorQueueStageReasonText(manual)).toBe(
      'Active: Founder has covenant signals requiring reviewer attention. · Warning: Covenant signals suggest a manual founder warning. · Probation: Founder score and signals do not suggest probation. · Removed: Removal is not suggested by current covenant signals. · Waitlist replacement: Waitlist handoff is disabled until the manual replacement workflow is approved.',
    )
    expect(founderCovenantOperatorQueueReviewReadinessText(manual)).toBe(
      'Blocked: 3 approval blockers before enforcement. · 3 evidence gaps, 1 approval request, 3 blockers, overdue',
    )
    expect(founderCovenantOperatorQueueChecklistText(manual)).toBe(
      'Manual: Active, Hospital, At risk · Watch: Useful, Staffed, Debt',
    )
    expect(founderCovenantOperatorQueueChecklistReasonText(manual)).toBe(
      'Active: Founder is unavailable and needs manual review. · Useful: Founder needs useful activity serving local demand. · Building: Founder owns at least one local business. · Staffed: Founder businesses need staff before review can clear. · Debt: Founder has unpaid debt to review before profit or succession. · Hospital: Founder is hospitalized; replacement remains manual. · At risk: Covenant signals need weekly/monthly review. · Manual authority: Automatic removal and waitlist handoff are disabled.',
    )
    expect(founderCovenantOperatorQueueEvidenceInputText(manual)).toBe(
      'Population growth, External contribution, Ideas and feedback',
    )
    expect(founderCovenantOperatorQueueEvidenceReasonText(manual)).toBe(
      'Population growth: Invite quality and local population growth need manual proof until invite tracking exists. · External contribution: GitHub, code, design, docs, and testing contributions must be attached by reviewers manually. · Ideas and feedback: Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
    )
    expect(founderCovenantOperatorQueueManualActionText(manual)).toBe(
      'Record review evidence-only, Send warning locked',
    )
    expect(founderCovenantOperatorQueueManualActionReasonText(manual)).toBe(
      'Record review: Reviewer notes are manual evidence only; no automatic enforcement runs. · Send warning: Covenant signals suggest a manual founder warning.',
    )
    expect(founderCovenantOperatorQueueApprovalRequestText(manual)).toBe('Send warning locked (2 blockers)')
    expect(founderCovenantOperatorQueueApprovalReasonText(manual)).toBe(
      'Send warning: Founder covenant signals suggest a warning.',
    )
    expect(founderCovenantOperatorQueueApprovalStatusText(manual)).toBe(
      'Send warning: Locked',
    )
    expect(founderCovenantOperatorQueueApprovalAuthorityText(manual)).toBe(
      'Main founder / Approval required',
    )
    expect(founderCovenantOperatorQueueApprovalGateText(manual)).toBe('Main founder approval · 2 blockers')
    expect(founderCovenantOperatorQueueApprovalBlockerText(manual)).toBe('approval workflow, Telegram delivery')
    expect(founderCovenantOperatorQueueApprovalTimelineText(manual)).toBe(
      'Send warning: 2026-07-06 04:00 UTC',
    )
    expect(founderCovenantOperatorQueueApprovalNotificationLinkText(manual)).toBe(
      'Send warning -> founder-area-0012:1783310400000:covenant-notification:founder_warning:founder-12',
    )
    expect(founderCovenantOperatorQueueNotificationDraftText(manual)).toBe('Manual review locked (Telegram)')
    expect(founderCovenantOperatorQueueNotificationDraftTitleText(manual)).toBe(
      'Founder covenant manual review required',
    )
    expect(founderCovenantOperatorQueueNotificationDraftBodyText(manual)).toBe(
      'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
    )
    expect(founderCovenantOperatorQueueNotificationDraftRecipientText(manual)).toBe(
      'Telegram -> founder-12',
    )
    expect(founderCovenantOperatorQueueNotificationDraftAuthorityText(manual)).toBe(
      'Main founder / Approval required',
    )
    expect(founderCovenantOperatorQueueNotificationDraftGateText(manual)).toBe(
      'Main founder approval required / Delivery disabled',
    )
    expect(founderCovenantOperatorQueueNotificationDraftStatusText(manual)).toBe('Disabled')
    expect(founderCovenantOperatorQueueNotificationDraftTimelineText(manual)).toBe(
      'Manual review: 2026-07-06 04:00 UTC · founder-area-0012:1783310400000:covenant-notification:manual_review_required:founder-12',
    )
    expect(founderCovenantOperatorQueueSignalCountText(manual)).toBe('2 total · 0 info · 1 warning · 1 critical')
    expect(founderCovenantOperatorQueuePriorityScore(manual)).toBe(1497)
    expect(founderCovenantOperatorQueueLatestReviewText({
      latestReview: {
        reviewedAt: '2026-07-06T08:00:00.000Z',
        reviewerId: 'telegram-operator:42424242',
        actionKind: 'record_review',
        summary: 'Reviewed contribution and ideas evidence.',
        authorityGate: areaReviewerEvidenceGate(),
        evidenceOnly: true,
        automationEnabled: false,
      },
    })).toBe('Latest review 2026-07-06 · Record review · Evidence only · telegram-operator:42424242 · Reviewed contribution and ideas evidence.')
    expect(founderCovenantOperatorQueueLatestReviewAuthorityText({
      latestReview: {
        reviewedAt: '2026-07-06T08:00:00.000Z',
        reviewerId: 'telegram-operator:42424242',
        actionKind: 'record_review',
        summary: 'Reviewed contribution and ideas evidence.',
        authorityGate: areaReviewerEvidenceGate(),
        evidenceOnly: true,
        automationEnabled: false,
      },
    })).toBe('Area reviewer / Evidence only')
    expect(founderCovenantOperatorQueueUpdatedAtText(manual)).toBe('2026-07-06 · 1 tx')
    expect(founderCovenantOperatorQueueWindowText(founderQueue())).toBe(
      'Generated 2026-07-06 04:00 UTC · pages 1/1 · cursor review-cursor-1 · next review-cursor-2',
    )
    expect(founderCovenantOperatorQueueResultText(founderQueue())).toBe(
      'founder-12: caught up · 1 tx · 2026-07-06 · founder-13: current · 0 tx · 2026-07-06',
    )
    expect(founderCovenantOperatorQueueResultAnomalyText(founderQueue())).toBe('Scan anomalies: none')
    expect(founderCovenantOperatorQueueReviewQueueBlockerText(manual)).toBe(
      'approval workflow, Telegram delivery, replacement',
    )
    expect(founderCovenantOperatorQueueNextActionText(manual)).toBe('Manual review')
    expect(founderCovenantOperatorQueueRecommendedActionText(manual)).toBe('Send warning')
    expect(founderCovenantOperatorQueueSignalText(manual)).toBe('Founder debt, Review due')
    expect(founderCovenantOperatorQueueReviewRows({ items: [manual] })[0]).toMatchObject({
      updatedAtText: '2026-07-06 · 1 tx',
      reviewQueueBlockerText: 'approval workflow, Telegram delivery, replacement',
      nextActionText: 'Manual review',
      recommendedActionText: 'Send warning',
      activityReasonText: 'Active: No recent founder activity is visible. · Useful: Usefulness needs reviewer evidence. · Building: Founder has built or owns local business activity. · Staffed: Founder businesses need staffing attention. · Indebted: Founder has outstanding debt. · Hospitalized: Founder is unavailable in hospital. · At risk: Founder covenant status requires manual attention.',
      stageReasonText: 'Active: Founder has covenant signals requiring reviewer attention. · Warning: Covenant signals suggest a manual founder warning. · Probation: Founder score and signals do not suggest probation. · Removed: Removal is not suggested by current covenant signals. · Waitlist replacement: Waitlist handoff is disabled until the manual replacement workflow is approved.',
      checklistReasonText: 'Active: Founder is unavailable and needs manual review. · Useful: Founder needs useful activity serving local demand. · Building: Founder owns at least one local business. · Staffed: Founder businesses need staff before review can clear. · Debt: Founder has unpaid debt to review before profit or succession. · Hospital: Founder is hospitalized; replacement remains manual. · At risk: Covenant signals need weekly/monthly review. · Manual authority: Automatic removal and waitlist handoff are disabled.',
      latestReviewAuthorityText: null,
      reviewQueueSummaryText: 'Main founder approval · 1 approval · 1 draft',
      reviewQueueDetailText: 'Approvals: Send warning · Drafts: Manual review',
      reviewQueueStatusText: 'Evidence only',
      evidenceReasonText: 'Population growth: Invite quality and local population growth need manual proof until invite tracking exists. · External contribution: GitHub, code, design, docs, and testing contributions must be attached by reviewers manually. · Ideas and feedback: Useful ideas, bug reports, and economy feedback must be attached by reviewers manually.',
      manualActionReasonText: 'Record review: Reviewer notes are manual evidence only; no automatic enforcement runs. · Send warning: Covenant signals suggest a manual founder warning.',
      approvalReasonText: 'Send warning: Founder covenant signals suggest a warning.',
      approvalStatusText: 'Send warning: Locked',
      approvalAuthorityText: 'Main founder / Approval required',
      approvalGateText: 'Main founder approval · 2 blockers',
      approvalBlockerText: 'approval workflow, Telegram delivery',
      approvalTimelineText: 'Send warning: 2026-07-06 04:00 UTC',
      approvalNotificationLinkText: 'Send warning -> founder-area-0012:1783310400000:covenant-notification:founder_warning:founder-12',
      notificationDraftTitleText: 'Founder covenant manual review required',
      notificationDraftBodyText: 'Founder covenant signals require human review. Replacement and waitlist handoff remain disabled.',
      notificationDraftRecipientText: 'Telegram -> founder-12',
      notificationDraftAuthorityText: 'Main founder / Approval required',
      notificationDraftGateText: 'Main founder approval required / Delivery disabled',
      notificationDraftStatusText: 'Disabled',
      notificationDraftTimelineText: 'Manual review: 2026-07-06 04:00 UTC · founder-area-0012:1783310400000:covenant-notification:manual_review_required:founder-12',
      signalCountText: '2 total · 0 info · 1 warning · 1 critical',
      priorityScore: 1497,
      signalText: 'Founder debt, Review due',
    })
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
        active: 0,
        useful: 0,
        building: 0,
        staffed: 0,
        atRisk: 0,
        manualReviewRequired: 0,
        overdue: 0,
        hospitalized: 0,
        indebted: 0,
        totalOutstandingDebt: 0,
        insuredFounders: 0,
        pendingApprovals: 0,
        pendingNotifications: 0,
        blockers: 0,
      },
    }

    const html = renderToStaticMarkup(<FounderCovenantQueuePanel queue={empty} />)

    expect(html).toContain('0 founders · 0 manual reviews · 0 overdue · 0 hospitalized · 0 indebted · $0 debt')
    expect(html).toContain('Generated 2026-07-06 04:00 UTC · pages 1/1 · cursor review-cursor-1 · next end')
    expect(html).toContain('No scan results')
    expect(html).toContain('Scan anomalies: none')
    expect(html).toContain('<span>Active</span><strong>0</strong>')
    expect(html).toContain('<span>At risk</span><strong>0</strong>')
    expect(html).toContain('No founders in this review page.')
  })

  test('summarizes invalid and unavailable scan anomalies for operators', () => {
    const queue = founderQueue()
    queue.results = [{
      citizenId: 'founder-12',
      areaId: 'founder-area-0012',
      status: 'invalid',
      updatedAt: '2026-07-06T04:00:00.000Z',
      transactionsAdded: 0,
    }, {
      citizenId: 'founder-13',
      areaId: 'founder-area-0013',
      status: 'unavailable',
      updatedAt: null,
      transactionsAdded: 0,
    }]

    expect(founderCovenantOperatorQueueResultAnomalyText(queue)).toBe(
      'Scan anomalies: founder-12 invalid · founder-13 unavailable',
    )
  })

  test('filters queue rows for manual review, hospitalization, and scan anomalies', () => {
    expect(founderCovenantOperatorQueueFilteredReviewRows(founderFilterQueue(), 'all').map(founderId)).toEqual([
      'founder-12',
      'founder-14',
      'founder-13',
    ])
    expect(founderCovenantOperatorQueueFilteredReviewRows(founderFilterQueue(), 'manual_review').map(founderId)).toEqual([
      'founder-12',
    ])
    expect(founderCovenantOperatorQueueFilteredReviewRows(founderFilterQueue(), 'hospitalized').map(founderId)).toEqual([
      'founder-12',
    ])
    expect(founderCovenantOperatorQueueFilteredReviewRows(founderFilterQueue(), 'scan_anomaly').map(founderId)).toEqual([
      'founder-14',
    ])
  })

  test('renders filtered empty-state messaging when no founders match', () => {
    const html = renderToStaticMarkup(<FounderCovenantQueuePanel filter="scan_anomaly" queue={founderQueue()} />)

    expect(html).toContain('Filter: Scan')
    expect(html).toContain('No founders match this filter.')
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

function founderFilterQueue(): RealityFounderCovenantReviewQueueDashboard {
  const manual = founderQueueItem()
  const anomaly = founderQueueItem({
    areaId: 'founder-area-0014',
    areaLabel: 'Timisoara Founder Block',
    founderCitizenId: 'founder-14',
    founderNumber: 14,
    manualReviewRequired: false,
    covenantStatus: 'watch',
    overdue: false,
    activityReview: {
      ...manual.activityReview,
      active: true,
      useful: true,
      building: true,
      staffed: true,
      hospitalized: false,
      atRisk: false,
      score: 79,
    },
    economicExposure: {
      ...manual.economicExposure,
      outstandingDebt: 0,
      debtCount: 0,
      unstaffedBusinessCount: 0,
      hospitalized: false,
      insured: true,
    },
    signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
    signalKinds: [],
    blockerCount: 0,
    scanStatus: 'invalid',
    transactionsAdded: 0,
  })
  const tracked = founderQueueItem({
    areaId: 'founder-area-0013',
    areaLabel: 'Cluj Founder Block',
    founderCitizenId: 'founder-13',
    founderNumber: 13,
    manualReviewRequired: false,
    covenantStatus: 'active',
    overdue: false,
    activityReview: {
      ...manual.activityReview,
      active: true,
      useful: true,
      building: true,
      staffed: true,
      hospitalized: false,
      atRisk: false,
      score: 91,
    },
    economicExposure: {
      ...manual.economicExposure,
      outstandingDebt: 0,
      debtCount: 0,
      unstaffedBusinessCount: 0,
      hospitalized: false,
      insured: true,
    },
    signalCounts: { total: 0, info: 0, warning: 0, critical: 0 },
    signalKinds: [],
    blockerCount: 0,
    scanStatus: 'current',
    transactionsAdded: 0,
  })

  return {
    ...founderQueue(),
    items: [manual, anomaly, tracked],
  }
}

function founderId(row: { founderCitizenId: string }): string {
  return row.founderCitizenId
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

function areaReviewerEvidenceGate() {
  return {
    requiredRole: 'area_reviewer',
    status: 'evidence_only',
    approvedById: null,
    approvedAt: null,
    executionEnabled: false,
  } as const
}
