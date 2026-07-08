import { describe, expect, test } from 'vitest'

import {
  DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT,
  FOUNDER_STARTER_CREDIT_BANK_ACCOUNT_ID,
  assessFounderStarterCreditPolicy,
} from './founderStarterCredit'

describe('founder starter credit policy', () => {
  test('keeps starter credit obligations and repayments disabled by default', () => {
    expect(assessFounderStarterCreditPolicy()).toEqual({
      enabled: false,
      obligationRecordingEnabled: false,
      repaymentExecutionEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      founderCitizenId: '',
      founderCreditTransactionId: null,
      starterCreditAmount: DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT,
      areaClaimConfirmed: false,
      founderCovenantAccepted: false,
      interestRate: 0,
      repaymentPriority: 'repay_before_real_payout',
      readyForManualReview: false,
      obligationDraft: null,
      blockers: [
        'starter_credit_obligation_recording_disabled',
        'starter_credit_repayment_disabled',
        'server_authority_required',
        'founder_identity_required',
        'area_claim_required',
        'founder_covenant_required',
        'manual_credit_terms_review_required',
      ],
    })
  })

  test('drafts a disabled repayable obligation for reviewed founder starter credit', () => {
    const assessment = assessFounderStarterCreditPolicy({
      founderCitizenId: ' founder-1 ',
      founderCreditTransactionId: ' area-1:0:1:founder_credit ',
      areaClaimConfirmed: true,
      founderCovenantAccepted: true,
      serverAuthorityReady: true,
      issuedAt: 1783308600000,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'starter_credit_obligation_recording_disabled',
      'starter_credit_repayment_disabled',
      'manual_credit_terms_review_required',
    ])
    expect(assessment.obligationDraft).toEqual({
      kind: 'founder_starter_credit_obligation',
      executionEnabled: false,
      obligationRecordingEnabled: false,
      repaymentExecutionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      payerCitizenId: 'founder-1',
      receiverAccountId: FOUNDER_STARTER_CREDIT_BANK_ACCOUNT_ID,
      sourceTransactionId: 'area-1:0:1:founder_credit',
      principalAmount: DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT,
      outstandingPrincipal: DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT,
      interestRate: 0,
      dueAt: null,
      issuedAt: 1783308600000,
      repaymentPriority: 'repay_before_real_payout',
      blockers: [
        'starter_credit_obligation_recording_disabled',
        'starter_credit_repayment_disabled',
        'manual_credit_terms_review_required',
      ],
    })
  })

  test('manual terms approval does not enable repayment execution', () => {
    const assessment = assessFounderStarterCreditPolicy({
      founderCitizenId: 'founder-1',
      founderCreditTransactionId: 'credit-tx',
      starterCreditAmount: 125_000.129,
      areaClaimConfirmed: true,
      founderCovenantAccepted: true,
      serverAuthorityReady: true,
      manualCreditTermsApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'starter_credit_obligation_recording_disabled',
      'starter_credit_repayment_disabled',
    ])
    expect(assessment.obligationDraft).toMatchObject({
      executionEnabled: false,
      obligationRecordingEnabled: false,
      repaymentExecutionEnabled: false,
      principalAmount: 125_000.13,
      outstandingPrincipal: 125_000.13,
      blockers: [
        'starter_credit_obligation_recording_disabled',
        'starter_credit_repayment_disabled',
      ],
    })
  })

  test('requires claim confirmation and founder covenant before manual review readiness', () => {
    const assessment = assessFounderStarterCreditPolicy({
      founderCitizenId: 'founder-1',
      starterCreditAmount: 200_000,
      serverAuthorityReady: true,
      manualCreditTermsApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.obligationDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'starter_credit_obligation_recording_disabled',
      'starter_credit_repayment_disabled',
      'area_claim_required',
      'founder_covenant_required',
    ])
  })

  test('rejects invalid starter credit amounts without creating an obligation', () => {
    const assessment = assessFounderStarterCreditPolicy({
      founderCitizenId: 'founder-1',
      founderCreditTransactionId: 'credit-tx',
      starterCreditAmount: Number.POSITIVE_INFINITY,
      areaClaimConfirmed: true,
      founderCovenantAccepted: true,
      serverAuthorityReady: true,
      manualCreditTermsApproved: true,
      issuedAt: -1,
    })

    expect(assessment.starterCreditAmount).toBe(0)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.obligationDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'starter_credit_obligation_recording_disabled',
      'starter_credit_repayment_disabled',
      'positive_credit_required',
    ])
  })
})
