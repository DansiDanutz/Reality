import { describe, expect, test } from 'vitest'
import { founderCovenantEnforcementPolicy } from './founderCovenantEnforcement'
import type { FounderCovenantActivityReview, FounderCovenantSignal } from './worldSim'

const activity = (over: Partial<FounderCovenantActivityReview> = {}): FounderCovenantActivityReview => ({
  checkedAt: 1783306800000,
  active: true,
  useful: true,
  building: true,
  staffed: true,
  indebted: false,
  hospitalized: false,
  atRisk: false,
  score: 90,
  ...over,
})

const signal = (severity: FounderCovenantSignal['severity']): FounderCovenantSignal => ({
  kind: severity === 'critical' ? 'founder_unavailable' : 'understaffed_businesses',
  severity,
  message: `${severity} signal`,
})

describe('founder covenant enforcement policy', () => {
  test('records clear evidence without enabling enforcement', () => {
    const policy = founderCovenantEnforcementPolicy({
      founderCitizenId: ' founder-1 ',
      currentStage: 'active',
      activityReview: activity(),
      signals: [],
      reviewedAt: 1783306800000,
    })

    expect(policy).toMatchObject({
      founderCitizenId: 'founder-1',
      currentStage: 'active',
      recommendedStage: 'active',
      actionKind: 'record_review',
      status: 'clear',
      manualOnly: true,
      automationEnabled: false,
      executionEnabled: false,
      removalEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      warningExecutionEnabled: false,
      probationExecutionEnabled: false,
      evidenceOnly: true,
      score: 90,
      criticalSignalCount: 0,
      warningSignalCount: 0,
    })
    expect(policy.recommendation).toEqual({
      actionKind: 'record_review',
      recommendedStage: 'active',
      status: 'clear',
      reason: 'Founder covenant evidence can be recorded without enforcement.',
      requiresMainFounderApproval: false,
      authorityGate: {
        requiredRole: 'main_founder',
        approvedById: null,
        approvalRequired: false,
        automationEnabled: false,
        executionEnabled: false,
      },
      approvalBlockers: [],
    })
  })

  test('recommends warning for watch signals while keeping Telegram delivery disabled', () => {
    const policy = founderCovenantEnforcementPolicy({
      founderCitizenId: 'founder-1',
      currentStage: 'active',
      activityReview: activity({ atRisk: true, score: 62 }),
      signals: [signal('warning')],
      reviewedAt: 1783306800000,
      approvedById: ' david ',
    })

    expect(policy).toMatchObject({
      recommendedStage: 'warning',
      actionKind: 'send_warning',
      status: 'watch',
      warningExecutionEnabled: false,
      executionEnabled: false,
      evidenceOnly: false,
    })
    expect(policy.recommendation.authorityGate).toEqual({
      requiredRole: 'main_founder',
      approvedById: 'david',
      approvalRequired: true,
      automationEnabled: false,
      executionEnabled: false,
    })
    expect(policy.recommendation.approvalBlockers).toEqual([
      'approval_workflow_disabled',
      'telegram_delivery_disabled',
    ])
  })

  test('recommends probation for serious risk without enabling probation execution', () => {
    const policy = founderCovenantEnforcementPolicy({
      founderCitizenId: 'founder-1',
      currentStage: 'warning',
      activityReview: activity({ active: false, hospitalized: true, atRisk: true, score: 30 }),
      signals: [signal('critical')],
      reviewedAt: 1783306800000,
    })

    expect(policy).toMatchObject({
      recommendedStage: 'probation',
      actionKind: 'start_probation',
      status: 'manual_review',
      probationExecutionEnabled: false,
      removalEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      criticalSignalCount: 1,
    })
    expect(policy.recommendation.approvalBlockers).toEqual([
      'approval_workflow_disabled',
      'probation_execution_disabled',
    ])
  })

  test('recommends replacement review from probation but keeps removal and waitlist disabled', () => {
    const policy = founderCovenantEnforcementPolicy({
      founderCitizenId: 'founder-1',
      currentStage: 'probation',
      activityReview: activity({ active: false, atRisk: true, score: 18 }),
      signals: [signal('critical')],
      reviewedAt: 1783306800000,
    })

    expect(policy).toMatchObject({
      recommendedStage: 'removed',
      actionKind: 'recommend_replacement',
      status: 'manual_review',
      removalEnabled: false,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      executionEnabled: false,
    })
    expect(policy.recommendation.reason).toContain('removal and waitlist replacement remain disabled')
    expect(policy.recommendation.approvalBlockers).toEqual([
      'approval_workflow_disabled',
      'replacement_disabled',
      'waitlist_handoff_disabled',
    ])
  })
})
