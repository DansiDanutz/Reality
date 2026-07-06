import { describe, expect, test } from 'vitest'
import {
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
  founderLegacyRoyaltyBlockerText,
  founderLegacyRoyaltyStatusLabel,
  founderLegacyRoyaltySummaryItems,
  founderLedgerSummaryItems,
  founderLedgerTransactionTitle,
  founderSettlementBlockerText,
  founderSettlementStatusLabel,
  founderSettlementSummaryItems,
} from './founderAreaPanelView'

describe('FounderAreaPanel covenant presenters', () => {
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
      recentTransactions: [],
    })).toEqual([
      { key: 'events', label: 'Events', value: '4', tone: 'stable' },
      { key: 'sales', label: 'Sales', value: '$12', tone: 'stable' },
      { key: 'wages', label: 'Wages', value: '$14', tone: 'warning' },
      { key: 'debt', label: 'Debt issued', value: '$300', tone: 'critical' },
    ])
  })

  test('labels ledger transaction kinds for recent events', () => {
    expect(founderLedgerTransactionTitle({ kind: 'customer_purchase' })).toBe('Customer purchase')
    expect(founderLedgerTransactionTitle({ kind: 'medical_debt' })).toBe('Medical debt')
    expect(founderLedgerTransactionTitle({ kind: 'debt_repayment' })).toBe('Debt repayment')
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
