import { describe, expect, test } from 'vitest'
import {
  founderCovenantChecklistStatusLabel,
  founderCovenantLatestReviewStatusLabel,
  founderCovenantManualActionKindLabel,
  founderCovenantManualActionStatusLabel,
  founderCovenantNotificationDraftStatusLabel,
  founderCovenantNotificationDraftText,
  founderCovenantReviewItems,
  founderCovenantReviewScheduleItems,
  founderCovenantReviewSignalSummary,
  founderCovenantReviewSnapshotSummary,
  founderCovenantSignalText,
  founderCovenantStatusLabel,
  founderCovenantTone,
  founderLedgerSummaryItems,
  founderLedgerTransactionTitle,
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

  test('labels manual covenant actions without enabling automation', () => {
    expect(founderCovenantManualActionStatusLabel({ recommended: true })).toBe('Suggested')
    expect(founderCovenantManualActionStatusLabel({ recommended: false })).toBe('Manual')
    expect(founderCovenantManualActionKindLabel('record_review')).toBe('Record review')
    expect(founderCovenantManualActionKindLabel('recommend_replacement')).toBe('Recommend replacement')
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
})
