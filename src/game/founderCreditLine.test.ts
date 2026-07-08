import { describe, expect, test } from 'vitest'
import {
  BASE_FOUNDER_DAILY_CREDIT_LIMIT,
  FOUNDER_CREDIT_BANK_ACCOUNT_ID,
  MAX_FOUNDER_DAILY_CREDIT_LIMIT,
  assessFounderCreditLinePolicy,
} from './founderCreditLine'

describe('founder credit line policy', () => {
  test('keeps daily founder credit issuance disabled by default', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: 'founder-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      automaticCreditEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      founderCitizenId: 'founder-1',
      requestedDailyCredit: 0,
      activityScore: 0,
      daysActiveInWindow: 0,
      demandServed: 0,
      businessesBuilt: 0,
      staffedBusinessCount: 0,
      outstandingFounderDebt: 0,
      hospitalized: false,
      activityCaptured: false,
      usefulActivityCaptured: false,
      dailyCreditLimit: 0,
      readyForManualReview: false,
      draft: null,
    })
    expect(assessment.blockers).toEqual([
      'credit_issuance_disabled',
      'automatic_credit_disabled',
      'server_authority_required',
      'positive_request_required',
      'activity_required',
      'usefulness_required',
      'manual_credit_review_required',
    ])
  })

  test('drafts a disabled bank credit movement for active useful founders', () => {
    const reviewedAt = 1_783_303_200_000
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: ' founder-1 ',
      requestedDailyCredit: 2_000,
      activityScore: 82,
      daysActiveInWindow: 5,
      demandServed: 12,
      businessesBuilt: 2,
      staffedBusinessCount: 1,
      serverAuthorityReady: true,
      manualCreditApproved: false,
      reviewedAt,
    })

    expect(assessment.dailyCreditLimit).toBe(4_395)
    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.draft).toEqual({
      kind: 'founder_credit_line_draw',
      executionEnabled: false,
      automaticCreditEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      payerAccountId: FOUNDER_CREDIT_BANK_ACCOUNT_ID,
      receiverCitizenId: 'founder-1',
      amount: 2_000,
      dailyCreditLimit: 4_395,
      repaymentPriority: 'repay_before_real_payout',
      reviewedAt,
      blockers: [
        'credit_issuance_disabled',
        'automatic_credit_disabled',
        'manual_credit_review_required',
      ],
    })
  })

  test('keeps credit execution disabled even after manual approval is modeled', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: 'founder-1',
      requestedDailyCredit: 1_000,
      activityScore: 70,
      daysActiveInWindow: 4,
      demandServed: 4,
      serverAuthorityReady: true,
      manualCreditApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'credit_issuance_disabled',
      'automatic_credit_disabled',
    ])
    expect(assessment.draft).toMatchObject({
      executionEnabled: false,
      automaticCreditEnabled: false,
      payerAccountId: FOUNDER_CREDIT_BANK_ACCOUNT_ID,
      receiverCitizenId: 'founder-1',
      amount: 1_000,
      repaymentPriority: 'repay_before_real_payout',
      blockers: [
        'credit_issuance_disabled',
        'automatic_credit_disabled',
      ],
    })
  })

  test('blocks credit expansion for debt, hospitalization, or weak activity', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: 'founder-1',
      requestedDailyCredit: 500,
      activityScore: 10,
      daysActiveInWindow: 1,
      demandServed: 0,
      staffedBusinessCount: 0,
      outstandingFounderDebt: 300,
      hospitalized: true,
      serverAuthorityReady: true,
      manualCreditApproved: true,
    })

    expect(assessment.dailyCreditLimit).toBe(0)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'credit_issuance_disabled',
      'automatic_credit_disabled',
      'activity_required',
      'usefulness_required',
      'debt_review_required',
      'hospitalization_review_required',
      'credit_limit_exceeded',
    ])
  })

  test('rejects requests above the activity-based credit limit', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: 'founder-1',
      requestedDailyCredit: 10_000,
      activityScore: 100,
      daysActiveInWindow: 20,
      demandServed: 100,
      businessesBuilt: 20,
      staffedBusinessCount: 20,
      serverAuthorityReady: true,
      manualCreditApproved: true,
    })

    expect(assessment.dailyCreditLimit).toBe(MAX_FOUNDER_DAILY_CREDIT_LIMIT)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'credit_issuance_disabled',
      'automatic_credit_disabled',
      'credit_limit_exceeded',
    ])
  })

  test('normalizes malformed numbers without creating anonymous bank credit', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: ' ',
      requestedDailyCredit: Number.POSITIVE_INFINITY,
      activityScore: 150,
      daysActiveInWindow: 2.8,
      demandServed: Number.NaN,
      businessesBuilt: 1.9,
      staffedBusinessCount: -2,
      outstandingFounderDebt: Number.NEGATIVE_INFINITY,
      serverAuthorityReady: true,
      manualCreditApproved: true,
      reviewedAt: -1,
    })

    expect(assessment.founderCitizenId).toBe('')
    expect(assessment.requestedDailyCredit).toBe(0)
    expect(assessment.activityScore).toBe(100)
    expect(assessment.daysActiveInWindow).toBe(2)
    expect(assessment.demandServed).toBe(0)
    expect(assessment.businessesBuilt).toBe(1)
    expect(assessment.staffedBusinessCount).toBe(0)
    expect(assessment.outstandingFounderDebt).toBe(0)
    expect(assessment.dailyCreditLimit).toBe(0)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'credit_issuance_disabled',
      'automatic_credit_disabled',
      'founder_identity_required',
      'positive_request_required',
      'usefulness_required',
    ])
  })

  test('uses the base daily limit when a founder barely qualifies as useful', () => {
    const assessment = assessFounderCreditLinePolicy({
      founderCitizenId: 'founder-1',
      requestedDailyCredit: 500,
      activityScore: 50,
      demandServed: 1,
      serverAuthorityReady: true,
      manualCreditApproved: true,
    })

    expect(assessment.dailyCreditLimit).toBe(BASE_FOUNDER_DAILY_CREDIT_LIMIT + 50 * 35 + 25)
    expect(assessment.draft).toMatchObject({ amount: 500 })
  })
})
