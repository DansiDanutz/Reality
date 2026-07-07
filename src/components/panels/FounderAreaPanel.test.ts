import { describe, expect, test } from 'vitest'
import {
  founderAreaEventDetail,
  founderAreaEventSummaryItems,
  founderAreaEventTitle,
  founderCovenantApprovalBlockerText,
  founderCovenantApprovalRequestStatusLabel,
  founderCovenantApprovalRequestText,
  founderCovenantChecklistStatusLabel,
  founderCovenantLatestReviewStatusLabel,
  founderCovenantManualActionKindLabel,
  founderCovenantManualActionStatusLabel,
  founderCovenantNotificationDraftGateText,
  founderCovenantNotificationDraftStatusLabel,
  founderCovenantNotificationDraftText,
  founderCovenantOperatorQueueItemSummary,
  founderCovenantOperatorQueuePageSummary,
  founderCovenantOperatorQueueSummary,
  founderCovenantReviewActionSummary,
  founderCovenantReviewApprovalSummary,
  founderCovenantReviewCadenceSummary,
  founderCovenantReviewDecisionSummary,
  founderCovenantReviewInputSummary,
  founderCovenantReviewInputStatusClass,
  founderCovenantReviewInputStatusLabel,
  founderCovenantReviewItems,
  founderCovenantReviewQueueDetailText,
  founderCovenantReviewQueueStatusLabel,
  founderCovenantReviewQueueSnapshotSummary,
  founderCovenantReviewQueueSummary,
  founderCovenantReviewScheduleItems,
  founderCovenantReviewSignalSummary,
  founderCovenantReviewSnapshotSummary,
  founderCovenantSignalText,
  founderCovenantStageSnapshotSummary,
  founderCovenantStageStatusLabel,
  founderCovenantStageTone,
  founderCovenantStatusLabel,
  founderCovenantTone,
  founderGrowthBlockerText,
  founderGrowthStatusLabel,
  founderGrowthSummaryItems,
  founderHandoffBlockerText,
  founderHandoffPackageText,
  founderHandoffStatusLabel,
  founderHandoffSummaryItems,
  founderIdentityClaimSourceLabel,
  founderIdentitySeatLabel,
  founderIdentityTelegramStatusLabel,
  founderLandRightsBlockerText,
  founderLandRightsLeaseTemplateText,
  founderLandRightsStatusLabel,
  founderLandRightsSummaryItems,
  founderLegacyRoyaltyBlockerText,
  founderLegacyRoyaltyStatusLabel,
  founderLegacyRoyaltySummaryItems,
  founderLedgerSummaryItems,
  founderLedgerTransactionTitle,
  founderPayoutReadinessBlockerText,
  founderPayoutReadinessPolicyText,
  founderPayoutReadinessStatusLabel,
  founderPayoutReadinessSummaryItems,
  founderSettlementBlockerText,
  founderSettlementStatusLabel,
  founderSettlementSummaryItems,
} from './founderAreaPanelView'

describe('FounderAreaPanel covenant presenters', () => {
  test('summarizes server-verified founder Telegram identity', () => {
    const identity = {
      citizenId: 'citizen-1',
      founderNumber: 12,
      claimSource: 'telegram',
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
    } as const

    expect(founderIdentitySeatLabel(identity)).toBe('Founder #0012')
    expect(founderIdentityClaimSourceLabel(identity.claimSource)).toBe('Telegram claim')
    expect(founderIdentityClaimSourceLabel('geolocation')).toBe('Geolocation claim')
    expect(founderIdentityTelegramStatusLabel(identity)).toBe('Telegram linked 42424242')
    expect(founderIdentityTelegramStatusLabel({
      telegramUserId: null,
      telegramAccountId: 'telegram:777',
    })).toBe('Telegram linked 777')
    expect(founderIdentityTelegramStatusLabel({
      telegramUserId: null,
      telegramAccountId: null,
    })).toBe('Telegram pending')
  })

  test('summarizes disabled Telegram growth tracking for founder review', () => {
    const growth: Parameters<typeof founderGrowthSummaryItems>[0] = {
      channel: 'telegram',
      inviteLinkEnabled: false,
      inviteTrackingEnabled: false,
      automaticRewardsEnabled: false,
      manualEvidenceRequired: true,
      realPopulation: 1,
      simPopulation: 3,
      trackedInvites: 0,
      blockers: [
        'telegram_invite_links_disabled',
        'invite_tracking_disabled',
        'automatic_growth_rewards_disabled',
        'manual_review_required',
      ],
    }

    expect(founderGrowthStatusLabel(growth)).toBe('Manual evidence')
    expect(founderGrowthSummaryItems(growth)).toEqual([
      { key: 'channel', label: 'Channel', value: 'Telegram', tone: 'warning' },
      { key: 'real', label: 'Real citizens', value: '1', tone: 'warning' },
      { key: 'sim', label: 'Sim citizens', value: '3', tone: 'stable' },
      { key: 'invites', label: 'Tracked invites', value: '0', tone: 'warning' },
    ])
    expect(founderGrowthBlockerText('telegram_invite_links_disabled')).toBe('Telegram invite links')
    expect(founderGrowthBlockerText('invite_tracking_disabled')).toBe('Invite tracking')
    expect(founderGrowthBlockerText('automatic_growth_rewards_disabled')).toBe('Automatic growth rewards')
    expect(founderGrowthBlockerText('manual_review_required')).toBe('Manual review')
  })

  test('summarizes disabled founder handoff readiness without implying transfer execution', () => {
    const handoff: Parameters<typeof founderHandoffSummaryItems>[0] = {
      enabled: false,
      mode: 'manual_disabled',
      candidateSelectionEnabled: false,
      replacementWorkflowEnabled: false,
      waitlistHandoffEnabled: false,
      seatTransferEnabled: false,
      areaTransferEnabled: false,
      businessTransferEnabled: false,
      debtTransferEnabled: false,
      legacyRulesTransferEnabled: false,
      manualReviewRequired: true,
      successorCandidateSource: 'named_heir',
      successorCandidateCitizenId: 'heir-1',
      successorCandidateName: 'Ada Heir',
      transferPackage: {
        founderNumber: 12,
        founderCitizenId: 'citizen-1',
        areaId: 'founder-area-0012',
        businessCount: 2,
        founderCreatedBusinessCount: 1,
        inheritedBusinessCount: 1,
        outstandingDebt: 300,
        debtObligationCount: 1,
        protectedByInsurance: true,
        legacyRoyaltyRate: 0.1,
        legacyTreasuryAccountId: 'system:founder-legacy-treasury',
      },
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'candidate_selection_disabled',
        'main_founder_approval_required',
        'manual_review_required',
      ],
    }

    expect(founderHandoffStatusLabel(handoff)).toBe('Manual review')
    expect(founderHandoffSummaryItems(handoff)).toEqual([
      { key: 'seat', label: 'Seat', value: '#0012', tone: 'stable' },
      { key: 'businesses', label: 'Businesses', value: '2', tone: 'warning' },
      { key: 'debt', label: 'Debt', value: '$300', tone: 'warning' },
      { key: 'candidate', label: 'Candidate', value: 'Ada Heir', tone: 'warning' },
    ])
    expect(founderHandoffPackageText(handoff)).toBe('founder-area-0012 · 1 founder-created · 1 inherited')
    expect(founderHandoffBlockerText('replacement_workflow_disabled')).toBe('Replacement workflow')
    expect(founderHandoffBlockerText('waitlist_handoff_disabled')).toBe('Waitlist handoff')
    expect(founderHandoffBlockerText('candidate_selection_disabled')).toBe('Candidate selection')
    expect(founderHandoffBlockerText('main_founder_approval_required')).toBe('Main founder approval')
    expect(founderHandoffBlockerText('manual_review_required')).toBe('Manual review')
  })

  test('summarizes disabled land rights without implying sale or rent execution', () => {
    const landRights: Parameters<typeof founderLandRightsSummaryItems>[0] = {
      enabled: false,
      mode: 'disabled_until_survival_business_loop_review',
      publicWording: 'reservation_building_rights',
      landSalesEnabled: false,
      reservationsEnabled: false,
      purchasesEnabled: false,
      leasesEnabled: false,
      rentCollectionEnabled: false,
      platformFeeEnabled: false,
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      ownerCitizenId: 'citizen-1',
      radiusKm: 0.8,
      businessCount: 1,
      operatorCount: 0,
      leaseTemplate: {
        enabled: false,
        termDays: 30,
        fixedMonthlyRent: null,
        rentCurrency: 'game_credits',
        payerCitizenId: null,
        receiverCitizenId: 'citizen-1',
        platformFeeRate: 0.05,
        platformFeeReceiverId: 'system:reality-platform-fees',
        requiresOperator: true,
        requiresDemand: true,
      },
      blockers: [
        'land_reservations_disabled',
        'land_purchases_disabled',
        'leases_disabled',
        'rent_collection_disabled',
        'operator_acceptance_disabled',
        'manual_review_required',
        'compliance_review_required',
      ],
    }

    expect(founderLandRightsStatusLabel(landRights)).toBe('Disabled')
    expect(founderLandRightsSummaryItems(landRights)).toEqual([
      { key: 'wording', label: 'Wording', value: 'Building rights', tone: 'stable' },
      { key: 'area', label: 'Area', value: 'Bucharest Founder Block', tone: 'stable' },
      { key: 'businesses', label: 'Businesses', value: '1', tone: 'stable' },
      { key: 'rent', label: 'Rent', value: 'not quoted', tone: 'warning' },
    ])
    expect(founderLandRightsLeaseTemplateText(landRights)).toBe('30 days · receiver citizen-1 · platform fee 5%')
    expect(founderLandRightsBlockerText('land_reservations_disabled')).toBe('Land reservations')
    expect(founderLandRightsBlockerText('land_purchases_disabled')).toBe('Land purchases')
    expect(founderLandRightsBlockerText('leases_disabled')).toBe('Land leases')
    expect(founderLandRightsBlockerText('rent_collection_disabled')).toBe('Rent collection')
    expect(founderLandRightsBlockerText('operator_acceptance_disabled')).toBe('Operator acceptance')
    expect(founderLandRightsBlockerText('manual_review_required')).toBe('Manual review')
    expect(founderLandRightsBlockerText('compliance_review_required')).toBe('Compliance review')
  })

  test('labels covenant status with operational tones', () => {
    expect(founderCovenantStatusLabel('active')).toBe('Active')
    expect(founderCovenantStatusLabel('watch')).toBe('Watch')
    expect(founderCovenantStatusLabel('manual_review')).toBe('Manual review')
    expect(founderCovenantTone('active')).toBe('stable')
    expect(founderCovenantTone('watch')).toBe('warning')
    expect(founderCovenantTone('manual_review')).toBe('critical')
  })

  test('labels manual covenant checklist status for compact review rows', () => {
    expect(founderCovenantChecklistStatusLabel('met')).toBe('Met')
    expect(founderCovenantChecklistStatusLabel('watch')).toBe('Watch')
    expect(founderCovenantChecklistStatusLabel('manual_review')).toBe('Manual')
  })

  test('labels covenant review inputs with checklist-compatible status classes', () => {
    expect(founderCovenantReviewInputStatusLabel('captured')).toBe('Captured')
    expect(founderCovenantReviewInputStatusLabel('watch')).toBe('Watch')
    expect(founderCovenantReviewInputStatusLabel('manual_needed')).toBe('Manual')
    expect(founderCovenantReviewInputStatusClass('captured')).toBe('met')
    expect(founderCovenantReviewInputStatusClass('watch')).toBe('watch')
    expect(founderCovenantReviewInputStatusClass('manual_needed')).toBe('manual_review')
  })

  test('labels evidence-only covenant stages without implying execution', () => {
    expect(founderCovenantStageStatusLabel('current')).toBe('Current')
    expect(founderCovenantStageStatusLabel('recommended')).toBe('Suggested')
    expect(founderCovenantStageStatusLabel('locked')).toBe('Locked')
    expect(founderCovenantStageTone('current')).toBe('stable')
    expect(founderCovenantStageTone('recommended')).toBe('warning')
    expect(founderCovenantStageTone('locked')).toBe('stable')
  })

  test('labels manual covenant actions without enabling automation', () => {
    expect(founderCovenantManualActionStatusLabel({ recommended: true })).toBe('Suggested')
    expect(founderCovenantManualActionStatusLabel({ recommended: false })).toBe('Manual')
    expect(founderCovenantManualActionKindLabel('record_review')).toBe('Record review')
    expect(founderCovenantManualActionKindLabel('recommend_replacement')).toBe('Recommend replacement')
  })

  test('labels pending covenant approval requests without enabling execution', () => {
    const request = {
      id: 'approval-1',
      at: 1_000,
      kind: 'send_warning',
      label: 'Send warning',
      reason: 'Covenant signals suggest a manual founder warning.',
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
      notificationDraftId: 'draft-1',
      blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
    } as const

    expect(founderCovenantApprovalRequestText(request)).toBe('Main founder approval · 2 blockers')
    expect(founderCovenantApprovalBlockerText(request)).toBe('Blocked by approval workflow, Telegram delivery')
    expect(founderCovenantApprovalRequestStatusLabel(request)).toBe('Locked')
  })

  test('summarizes captured covenant review action snapshots', () => {
    expect(founderCovenantReviewActionSummary({ manualActions: [] })).toBe('No action snapshot')
    expect(founderCovenantReviewActionSummary({
      manualActions: [{
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
      }],
    })).toBe('2 suggested · 0 executable')
  })

  test('summarizes captured covenant approval snapshots', () => {
    expect(founderCovenantReviewApprovalSummary({ approvalRequests: [] })).toBe('No approval snapshot')
    expect(founderCovenantReviewApprovalSummary({
      approvalRequests: [{
        id: 'approval-1',
        at: 1_000,
        kind: 'send_warning',
        label: 'Send warning',
        reason: 'Covenant signals suggest a manual founder warning.',
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
        notificationDraftId: 'draft-1',
        blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
      }],
    })).toBe('1 approval captured · 0 executable · 2 blockers')
  })

  test('labels latest covenant review evidence without enabling automation', () => {
    expect(founderCovenantLatestReviewStatusLabel({
      evidenceOnly: true,
      automationEnabled: false,
      authorityGate: {
        requiredRole: 'area_reviewer',
      },
    })).toBe('Area reviewer / Evidence only')
  })

  test('summarizes captured covenant review signals', () => {
    expect(founderCovenantReviewSignalSummary({ signals: [] })).toBe('No signals captured')
    expect(founderCovenantReviewSignalSummary({
      signals: [{
        kind: 'review_due',
        severity: 'warning',
        message: 'Weekly review was due.',
      }],
    })).toBe('1 signal captured')
    expect(founderCovenantReviewSignalSummary({
      signals: [{
        kind: 'review_due',
        severity: 'warning',
        message: 'Weekly review was due.',
      }, {
        kind: 'founder_debt',
        severity: 'info',
        message: 'Founder has debt.',
        amount: 120,
      }],
    })).toBe('2 signals captured')
  })

  test('summarizes captured covenant activity snapshots', () => {
    expect(founderCovenantReviewSnapshotSummary({
      activityReview: null,
      reviewChecklist: [],
    })).toBe('Snapshot unavailable')
    expect(founderCovenantReviewSnapshotSummary({
      activityReview: {
        checkedAt: 1_000,
        active: true,
        useful: false,
        building: true,
        staffed: false,
        indebted: false,
        hospitalized: false,
        atRisk: true,
        score: 50,
      },
      reviewChecklist: [{
        key: 'staffed',
        label: 'Staffed',
        status: 'watch',
        evidence: 'Founder businesses need staff before review can clear.',
      }, {
        key: 'risk',
        label: 'At risk',
        status: 'manual_review',
        evidence: 'Covenant signals need weekly/monthly review.',
      }],
    })).toBe('Snapshot score 50/100 · 1 manual · 1 watch')
  })

  test('summarizes captured covenant review input snapshots', () => {
    expect(founderCovenantReviewInputSummary({ reviewInputs: [] })).toBe('No input snapshot')
    expect(founderCovenantReviewInputSummary({
      reviewInputs: [{
        kind: 'in_game_activity',
        label: 'In-game activity',
        status: 'captured',
        evidence: 'Founder activity is captured from local businesses, staffing, and purchases.',
        manualEvidenceRequired: false,
      }, {
        kind: 'external_contribution',
        label: 'External contribution',
        status: 'manual_needed',
        evidence: 'GitHub, code, design, docs, and testing contributions must be attached by reviewers manually.',
        manualEvidenceRequired: true,
      }, {
        kind: 'area_health',
        label: 'Area health',
        status: 'watch',
        evidence: 'Area health has service or staffing issues to review.',
        manualEvidenceRequired: false,
      }],
    })).toBe('Inputs snapshot · 1 captured · 1 manual · 1 watch')
  })

  test('summarizes captured covenant stage snapshots', () => {
    expect(founderCovenantStageSnapshotSummary({ stages: [] })).toBe('No stage snapshot')
    expect(founderCovenantStageSnapshotSummary({
      stages: [{
        kind: 'active',
        label: 'Active',
        status: 'current',
        reason: 'Founder currently has no covenant warnings.',
        requiresMainFounderApproval: false,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }],
    })).toBe('Stage snapshot · Active')
    expect(founderCovenantStageSnapshotSummary({
      stages: [{
        kind: 'probation',
        label: 'Probation',
        status: 'recommended',
        reason: 'Reviewer may open probation, but execution remains disabled.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }, {
        kind: 'removed',
        label: 'Removed',
        status: 'recommended',
        reason: 'Founder is unavailable; removal remains a manually approved later workflow.',
        requiresMainFounderApproval: true,
        manualOnly: true,
        automationEnabled: false,
        executionEnabled: false,
      }],
    })).toBe('Stage snapshot · Probation, Removed suggested')
  })

  test('summarizes captured covenant review cadence', () => {
    const baseSchedule = {
      lastReviewAt: null,
      nextWeeklyReviewAt: 8 * 24 * 60 * 60 * 1000,
      nextMonthlyReviewAt: 31 * 24 * 60 * 60 * 1000,
      weeklyReviewDue: false,
      monthlyReviewDue: false,
      overdue: false,
      automationEnabled: false,
    } as const
    expect(founderCovenantReviewCadenceSummary({ reviewSchedule: null })).toBe('Schedule unavailable')
    expect(founderCovenantReviewCadenceSummary({ reviewSchedule: baseSchedule })).toBe('Ad hoc review captured')
    expect(founderCovenantReviewCadenceSummary({
      reviewSchedule: {
        ...baseSchedule,
        weeklyReviewDue: true,
        overdue: true,
      },
    })).toBe('Weekly review captured')
    expect(founderCovenantReviewCadenceSummary({
      reviewSchedule: {
        ...baseSchedule,
        weeklyReviewDue: true,
        monthlyReviewDue: true,
        overdue: true,
      },
    })).toBe('Monthly review captured')
  })

  test('summarizes captured covenant review decisions', () => {
    expect(founderCovenantReviewDecisionSummary({ decision: null })).toBe('Decision unavailable')
    expect(founderCovenantReviewDecisionSummary({
      decision: {
        status: 'watch',
        nextAction: 'warn_founder',
        manualReviewRequired: false,
      },
    })).toBe('Watch / Warn founder')
    expect(founderCovenantReviewDecisionSummary({
      decision: {
        status: 'manual_review',
        nextAction: 'manual_review',
        manualReviewRequired: true,
      },
    })).toBe('Manual review / Manual review')
  })

  test('summarizes the current manual covenant review queue', () => {
    const queue = {
      evidenceOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      nextStep: 'main_founder_approval',
      recordReviewEnabled: true,
      recommendedActionKinds: ['record_review', 'send_warning'],
      pendingApprovalKinds: ['send_warning'],
      pendingApprovalCount: 1,
      pendingNotificationKinds: ['founder_warning'],
      pendingNotificationCount: 1,
      blockerCount: 2,
      blockers: ['approval_workflow_disabled', 'telegram_delivery_disabled'],
    } as const

    expect(founderCovenantReviewQueueSummary(queue)).toBe('Main founder approval · 1 approval · 1 draft')
    expect(founderCovenantReviewQueueDetailText(queue)).toBe('Approvals: Send warning · Drafts: Founder warning')
    expect(founderCovenantReviewQueueStatusLabel(queue)).toBe('Evidence only')
    expect(founderCovenantReviewQueueSnapshotSummary({ reviewQueue: queue })).toBe(
      'Queue snapshot · Main founder approval · 1 approval · 1 draft · 2 blockers',
    )
  })

  test('summarizes the operator founder covenant review queue without enforcement controls', () => {
    const queue = {
      hasMore: true,
      scanned: 2,
      caughtUp: 1,
      current: 0,
      failed: 1,
      totals: {
        founders: 2,
        active: 1,
        useful: 1,
        building: 1,
        staffed: 0,
        indebted: 1,
        hospitalized: 1,
        atRisk: 2,
        manualReviewRequired: 1,
        overdue: 1,
        totalFounderCash: 399_000,
        totalOutstandingDebt: 350,
        totalBusinessCash: 25,
        unstaffedBusinesses: 1,
        insuredFounders: 0,
        pendingApprovals: 2,
        pendingNotifications: 1,
        blockers: 5,
      },
    }
    const item = {
      covenantStatus: 'manual_review',
      manualReviewRequired: true,
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
        founderCash: 199_650,
        outstandingDebt: 350,
        debtCount: 1,
        businessCash: 25,
        businessCount: 1,
        unstaffedBusinessCount: 1,
        insured: false,
        hospitalized: true,
        gameCreditsOnly: true,
        payoutEligibleCredits: 0,
        manualPayoutReviewRequired: true,
      },
      signalCounts: {
        total: 4,
        info: 1,
        warning: 2,
        critical: 1,
      },
      blockerCount: 5,
      transactionsAdded: 1,
    } as const

    expect(founderCovenantOperatorQueueSummary(queue)).toBe(
      '2 founders · 1 manual review · 1 overdue · 1 hospitalized · 1 indebted · $350 debt · more available',
    )
    expect(founderCovenantOperatorQueuePageSummary(queue)).toBe(
      '2 scanned · 1 caught up · 0 current · 1 failed · next page ready',
    )
    expect(founderCovenantOperatorQueueItemSummary(item)).toBe(
      'Manual review · manual review · score 35/100 · $350 debt · 2 warnings · 1 critical · 5 blockers · 1 tx',
    )
  })

  test('summarizes covenant review signals without replacement actions', () => {
    expect(founderCovenantSignalText({
      kind: 'understaffed_businesses',
      severity: 'warning',
      message: 'Founder-owned businesses need workers before the area can run reliably.',
      businessIds: ['water1', 'food1'],
    })).toBe('Understaffed: water1, food1')

    expect(founderCovenantSignalText({
      kind: 'essential_shortage',
      severity: 'warning',
      message: 'The area has unserved water, food, or housing demand.',
      businessKinds: ['water', 'housing'],
    })).toBe('Shortage: water, housing')

    expect(founderCovenantSignalText({
      kind: 'sim_departure',
      severity: 'warning',
      message: '2 Sim Citizens left after the latest review because essential services stayed unserved.',
      amount: 2,
    })).toBe('Sim departures: 2')

    expect(founderCovenantSignalText({
      kind: 'founder_debt',
      severity: 'info',
      message: 'Founder has unpaid debt that should be reviewed before profit or succession decisions.',
      amount: 120,
    })).toBe('Founder debt: $120')

    expect(founderCovenantSignalText({
      kind: 'review_due',
      severity: 'warning',
      message: 'Founder covenant weekly review is due.',
    })).toBe('Review due')
  })

  test('formats manual activity review flags for founder covenant badges', () => {
    expect(founderCovenantReviewItems({
      checkedAt: 1_000,
      active: false,
      useful: true,
      building: true,
      staffed: false,
      indebted: true,
      hospitalized: true,
      atRisk: true,
      score: 45,
    })).toEqual([
      { key: 'active', label: 'Active', value: 'no', tone: 'warning' },
      { key: 'useful', label: 'Useful', value: 'yes', tone: 'stable' },
      { key: 'building', label: 'Building', value: 'yes', tone: 'stable' },
      { key: 'staffed', label: 'Staffed', value: 'no', tone: 'warning' },
      { key: 'indebted', label: 'Debt', value: 'yes', tone: 'critical' },
      { key: 'hospitalized', label: 'Hospital', value: 'yes', tone: 'critical' },
      { key: 'atRisk', label: 'At risk', value: 'yes', tone: 'critical' },
    ])
  })

  test('formats covenant review schedule badges from server timing', () => {
    expect(founderCovenantReviewScheduleItems({
      lastReviewAt: null,
      nextWeeklyReviewAt: 8 * 24 * 60 * 60 * 1000,
      nextMonthlyReviewAt: 31 * 24 * 60 * 60 * 1000,
      weeklyReviewDue: false,
      monthlyReviewDue: false,
      overdue: false,
      automationEnabled: false,
    }, 24 * 60 * 60 * 1000)).toEqual([
      { key: 'last', label: 'Last', value: 'none', tone: 'warning' },
      { key: 'weekly', label: 'Weekly', value: '7d', tone: 'stable' },
      { key: 'monthly', label: 'Monthly', value: '30d', tone: 'stable' },
    ])

    expect(founderCovenantReviewScheduleItems({
      lastReviewAt: 2 * 24 * 60 * 60 * 1000,
      nextWeeklyReviewAt: 9 * 24 * 60 * 60 * 1000,
      nextMonthlyReviewAt: 32 * 24 * 60 * 60 * 1000,
      weeklyReviewDue: true,
      monthlyReviewDue: false,
      overdue: true,
      automationEnabled: false,
    }, 10 * 24 * 60 * 60 * 1000)).toEqual([
      { key: 'last', label: 'Last', value: '8d ago', tone: 'stable' },
      { key: 'weekly', label: 'Weekly', value: 'due', tone: 'warning' },
      { key: 'monthly', label: 'Monthly', value: '22d', tone: 'stable' },
    ])
  })

  test('summarizes passive covenant notification drafts', () => {
    const draft = {
      id: 'draft-1',
      at: 1_000,
      kind: 'manual_review_required',
      channel: 'telegram',
      recipientCitizenId: 'founder-1',
      title: 'Founder covenant manual review required',
      body: 'Founder covenant signals require human review.',
      requiresApproval: true,
      sendEnabled: false,
      authorityGate: {
        requiredRole: 'main_founder',
        status: 'approval_required',
        approvedById: null,
        approvedAt: null,
        executionEnabled: false,
      },
    } as const

    expect(founderCovenantNotificationDraftText(draft)).toBe('Telegram / Main founder approval')
    expect(founderCovenantNotificationDraftGateText(draft)).toBe('Main founder approval required / Delivery disabled')
    expect(founderCovenantNotificationDraftStatusLabel(draft)).toBe('Disabled')
  })

  test('summarizes server-owned ledger totals for the founder panel', () => {
    expect(founderLedgerSummaryItems({
      transactionCount: 4,
      totalsByKind: {
        founder_credit: 200_000,
        sim_citizen_credit: 300,
        customer_purchase: 12,
        business_build: 8_000,
        worker_wage: 14,
        hospital_bill: 0,
        insurance_premium: 45,
        insurance_payout: 0,
        medical_debt: 300,
        debt_repayment: 120,
      },
      payoutClassification: {
        gameOnlyTransactionCount: 4,
        gameOnlyAmount: 208_791,
        payoutEligibleTransactionCount: 0,
        payoutEligibleAmount: 0,
        manualPayoutReviewRequired: true,
        realWithdrawalEligible: false,
      },
      recentTransactions: [],
    })).toEqual([
      { key: 'events', label: 'Events', value: '4', tone: 'stable' },
      { key: 'sales', label: 'Sales', value: '$12', tone: 'stable' },
      { key: 'wages', label: 'Wages', value: '$14', tone: 'warning' },
      { key: 'debt', label: 'Debt issued', value: '$300', tone: 'critical' },
      { key: 'game-only', label: 'Game-only', value: '$208,791', tone: 'stable' },
      { key: 'payout-eligible', label: 'Payout eligible', value: '$0', tone: 'stable' },
    ])
  })

  test('labels ledger transaction kinds for recent events', () => {
    expect(founderLedgerTransactionTitle({ kind: 'customer_purchase' })).toBe('Customer purchase')
    expect(founderLedgerTransactionTitle({ kind: 'medical_debt' })).toBe('Medical debt')
    expect(founderLedgerTransactionTitle({ kind: 'debt_repayment' })).toBe('Debt repayment')
  })

  test('summarizes non-cash area events for the founder panel', () => {
    expect(founderAreaEventSummaryItems({
      eventCount: 2,
      simDepartures: 1,
      warningEvents: 1,
      criticalEvents: 1,
      recentEvents: [],
    })).toEqual([
      { key: 'events', label: 'Events', value: '2', tone: 'warning' },
      { key: 'departures', label: 'Sim departures', value: '1', tone: 'warning' },
      { key: 'warnings', label: 'Warnings', value: '1', tone: 'warning' },
      { key: 'critical', label: 'Critical', value: '1', tone: 'critical' },
    ])

    expect(founderAreaEventSummaryItems({
      eventCount: 0,
      simDepartures: 0,
      warningEvents: 0,
      criticalEvents: 0,
      recentEvents: [],
    })).toEqual([
      { key: 'events', label: 'Events', value: '0', tone: 'stable' },
      { key: 'departures', label: 'Sim departures', value: '0', tone: 'stable' },
      { key: 'warnings', label: 'Warnings', value: '0', tone: 'stable' },
      { key: 'critical', label: 'Critical', value: '0', tone: 'stable' },
    ])
  })

  test('labels recent Sim Citizen departure events without implying money movement', () => {
    const event = {
      kind: 'sim_citizen_departure',
      displayName: 'Demo Food Resident (Sim)',
      reason: 'food_unserved',
      serviceKind: 'food',
    } as const

    expect(founderAreaEventTitle(event)).toBe('Demo Food Resident (Sim) left')
    expect(founderAreaEventDetail(event)).toBe('Food shortage · food unserved')
  })

  test('summarizes disabled TON settlement without enabling value movement', () => {
    const settlement: Parameters<typeof founderSettlementSummaryItems>[0] = {
      rail: 'ton',
      mode: 'ledger_only',
      gameplayLedgerSource: 'reality_server',
      gameCredits: 200_000,
      payoutEligibleCredits: 0,
      walletConnectionRequired: false,
      walletConnectionEnabled: false,
      depositsEnabled: false,
      withdrawalsEnabled: false,
      landReservationsEnabled: false,
      landLeasesEnabled: false,
      highFrequencyOnChainTransactions: false,
      manualReviewRequired: true,
      complianceReviewRequired: true,
      blockers: [
        'ton_connect_disabled',
        'deposits_disabled',
        'withdrawals_disabled',
        'land_reservations_disabled',
        'leases_disabled',
        'manual_payout_review_required',
        'compliance_review_required',
      ],
    }

    expect(founderSettlementStatusLabel(settlement)).toBe('Disabled')
    expect(founderSettlementSummaryItems(settlement)).toEqual([
      { key: 'rail', label: 'Rail', value: 'TON', tone: 'warning' },
      { key: 'mode', label: 'Mode', value: 'ledger only', tone: 'stable' },
      { key: 'credits', label: 'Game credits', value: '$200,000', tone: 'stable' },
      { key: 'eligible', label: 'Payout eligible', value: '$0', tone: 'stable' },
    ])
    expect(founderSettlementBlockerText('ton_connect_disabled')).toBe('TON Connect')
    expect(founderSettlementBlockerText('manual_payout_review_required')).toBe('Manual payout review')
    expect(founderSettlementBlockerText('compliance_review_required')).toBe('Compliance review')
  })

  test('summarizes disabled payout readiness without promising real withdrawals', () => {
    const payout: Parameters<typeof founderPayoutReadinessSummaryItems>[0] = {
      enabled: false,
      mode: 'game_credits_only',
      gameplayLedgerSource: 'reality_server',
      gameCredits: 200_000,
      payoutEligibleCredits: 0,
      realWithdrawalsEnabled: false,
      manualPayoutApprovalEnabled: false,
      kycRequired: true,
      kycStatus: 'not_started',
      taxProfileRequired: true,
      taxProfileStatus: 'not_started',
      complianceReviewRequired: true,
      noProfitPromise: true,
      tonSettlementEnabled: false,
      tonSettlementRailPlanned: true,
      blockers: [
        'game_credits_only',
        'payouts_disabled',
        'withdrawals_disabled',
        'kyc_disabled',
        'tax_profile_disabled',
        'manual_payout_review_required',
        'compliance_review_required',
        'ton_settlement_disabled',
      ],
    }

    expect(founderPayoutReadinessStatusLabel(payout)).toBe('Game credits only')
    expect(founderPayoutReadinessSummaryItems(payout)).toEqual([
      { key: 'credits', label: 'Game credits', value: '$200,000', tone: 'stable' },
      { key: 'eligible', label: 'Payout eligible', value: '$0', tone: 'stable' },
      { key: 'kyc', label: 'KYC', value: 'not started', tone: 'warning' },
      { key: 'tax', label: 'Tax', value: 'not started', tone: 'warning' },
    ])
    expect(founderPayoutReadinessPolicyText(payout)).toBe('no profit promise · TON settlement rail planned later')
    expect(founderPayoutReadinessBlockerText('game_credits_only')).toBe('Game credits only')
    expect(founderPayoutReadinessBlockerText('payouts_disabled')).toBe('Payouts')
    expect(founderPayoutReadinessBlockerText('withdrawals_disabled')).toBe('Withdrawals')
    expect(founderPayoutReadinessBlockerText('kyc_disabled')).toBe('KYC')
    expect(founderPayoutReadinessBlockerText('tax_profile_disabled')).toBe('Tax profile')
    expect(founderPayoutReadinessBlockerText('manual_payout_review_required')).toBe('Manual payout review')
    expect(founderPayoutReadinessBlockerText('compliance_review_required')).toBe('Compliance review')
    expect(founderPayoutReadinessBlockerText('ton_settlement_disabled')).toBe('TON settlement')
  })

  test('summarizes disabled founder legacy royalty without enabling payouts', () => {
    const legacyRoyalty: Parameters<typeof founderLegacyRoyaltySummaryItems>[0] = {
      enabled: false,
      payoutEnabled: false,
      replacementWorkflowEnabled: false,
      manualReviewRequired: true,
      appliesTo: 'inherited_founder_created_businesses_only',
      royaltyRate: 0.1,
      treasuryAccountId: 'system:founder-legacy-treasury',
      royaltyEligibleBusinessIds: ['inherited-water'],
      royaltyExcludedBusinessIds: ['new-food'],
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'treasury_payout_disabled',
        'compliance_review_required',
      ],
    }

    expect(founderLegacyRoyaltyStatusLabel(legacyRoyalty)).toBe('Disabled')
    expect(founderLegacyRoyaltySummaryItems(legacyRoyalty)).toEqual([
      { key: 'scope', label: 'Scope', value: 'Inherited assets', tone: 'stable' },
      { key: 'rate', label: 'Modeled rate', value: '10%', tone: 'warning' },
      { key: 'eligible', label: 'Eligible assets', value: '1', tone: 'warning' },
      { key: 'excluded', label: 'Excluded assets', value: '1', tone: 'stable' },
    ])
    expect(founderLegacyRoyaltyBlockerText('replacement_workflow_disabled')).toBe('Replacement workflow')
    expect(founderLegacyRoyaltyBlockerText('waitlist_handoff_disabled')).toBe('Waitlist handoff')
    expect(founderLegacyRoyaltyBlockerText('treasury_payout_disabled')).toBe('Treasury payout')
    expect(founderLegacyRoyaltyBlockerText('compliance_review_required')).toBe('Compliance review')
  })
})
