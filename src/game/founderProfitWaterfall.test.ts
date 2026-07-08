import { describe, expect, test } from 'vitest'

import { assessFounderProfitWaterfall } from './founderProfitWaterfall'

describe('founder profit waterfall', () => {
  test('keeps profit repayment and payout review disabled by default', () => {
    const assessment = assessFounderProfitWaterfall({})

    expect(assessment).toEqual({
      enabled: false,
      executionEnabled: false,
      payoutReviewEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      founderCitizenId: '',
      periodBusinessProfit: 0,
      outstandingObligations: [],
      repaymentDrafts: [],
      totals: {
        profitAvailable: 0,
        repaymentDrafted: 0,
        remainingObligations: 0,
        surplusGameCredits: 0,
        payoutEligibleSurplus: 0,
      },
      readyForManualReview: false,
      blockers: [
        'profit_waterfall_execution_disabled',
        'payout_review_disabled',
        'server_authority_required',
        'founder_identity_required',
        'positive_profit_required',
        'manual_profit_review_required',
      ],
    })
  })

  test('drafts disabled repayments from business profit before founder surplus', () => {
    const assessment = assessFounderProfitWaterfall({
      founderCitizenId: ' founder-1 ',
      periodBusinessProfit: 900,
      serverAuthorityReady: true,
      manualProfitReviewApproved: true,
      reviewedAt: 1783308600000,
      obligations: [
        {
          id: 'medical-1',
          kind: 'medical_debt',
          creditorAccountId: 'clinic-1',
          outstandingAmount: 500,
        },
        {
          id: 'credit-1',
          kind: 'founder_credit',
          creditorAccountId: 'system:founder-credit-bank',
          outstandingAmount: 700,
        },
      ],
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'profit_waterfall_execution_disabled',
      'payout_review_disabled',
    ])
    expect(assessment.repaymentDrafts).toEqual([
      {
        kind: 'founder_profit_repayment',
        executionEnabled: false,
        payoutReviewEnabled: false,
        sourceOfTruth: 'reality_server_ledger',
        currency: 'game_credits',
        payerCitizenId: 'founder-1',
        receiverAccountId: 'system:founder-credit-bank',
        obligationId: 'credit-1',
        obligationKind: 'founder_credit',
        amount: 700,
        reviewedAt: 1783308600000,
        blockers: ['profit_waterfall_execution_disabled', 'payout_review_disabled'],
      },
      {
        kind: 'founder_profit_repayment',
        executionEnabled: false,
        payoutReviewEnabled: false,
        sourceOfTruth: 'reality_server_ledger',
        currency: 'game_credits',
        payerCitizenId: 'founder-1',
        receiverAccountId: 'clinic-1',
        obligationId: 'medical-1',
        obligationKind: 'medical_debt',
        amount: 200,
        reviewedAt: 1783308600000,
        blockers: ['profit_waterfall_execution_disabled', 'payout_review_disabled'],
      },
    ])
    expect(assessment.totals).toEqual({
      profitAvailable: 900,
      repaymentDrafted: 900,
      remainingObligations: 300,
      surplusGameCredits: 0,
      payoutEligibleSurplus: 0,
    })
  })

  test('keeps surplus game-only after obligations are covered', () => {
    const assessment = assessFounderProfitWaterfall({
      founderCitizenId: 'founder-1',
      periodBusinessProfit: 1250,
      serverAuthorityReady: true,
      obligations: [{
        id: 'credit-1',
        kind: 'founder_credit',
        creditorAccountId: 'system:founder-credit-bank',
        outstandingAmount: 300,
      }],
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'profit_waterfall_execution_disabled',
      'payout_review_disabled',
      'manual_profit_review_required',
    ])
    expect(assessment.repaymentDrafts).toMatchObject([{
      payerCitizenId: 'founder-1',
      receiverAccountId: 'system:founder-credit-bank',
      obligationKind: 'founder_credit',
      amount: 300,
      executionEnabled: false,
      payoutReviewEnabled: false,
    }])
    expect(assessment.totals).toEqual({
      profitAvailable: 1250,
      repaymentDrafted: 300,
      remainingObligations: 0,
      surplusGameCredits: 950,
      payoutEligibleSurplus: 0,
    })
  })

  test('does not draft repayments without server authority', () => {
    const assessment = assessFounderProfitWaterfall({
      founderCitizenId: 'founder-1',
      periodBusinessProfit: 500,
      obligations: [{
        id: 'credit-1',
        kind: 'founder_credit',
        creditorAccountId: 'system:founder-credit-bank',
        outstandingAmount: 300,
      }],
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.repaymentDrafts).toEqual([])
    expect(assessment.blockers).toEqual([
      'profit_waterfall_execution_disabled',
      'payout_review_disabled',
      'server_authority_required',
      'manual_profit_review_required',
    ])
  })

  test('rejects malformed profit and creditor data without minting movement', () => {
    const assessment = assessFounderProfitWaterfall({
      founderCitizenId: 'founder-1',
      periodBusinessProfit: Number.POSITIVE_INFINITY,
      serverAuthorityReady: true,
      manualProfitReviewApproved: true,
      obligations: [
        {
          id: 'credit-1',
          kind: 'founder_credit',
          creditorAccountId: ' ',
          outstandingAmount: 300,
        },
        {
          id: 'medical-1',
          kind: 'medical_debt',
          creditorAccountId: 'clinic-1',
          outstandingAmount: Number.NaN,
        },
      ],
    })

    expect(assessment.periodBusinessProfit).toBe(0)
    expect(assessment.outstandingObligations).toEqual([])
    expect(assessment.repaymentDrafts).toEqual([])
    expect(assessment.totals).toEqual({
      profitAvailable: 0,
      repaymentDrafted: 0,
      remainingObligations: 0,
      surplusGameCredits: 0,
      payoutEligibleSurplus: 0,
    })
    expect(assessment.blockers).toEqual([
      'profit_waterfall_execution_disabled',
      'payout_review_disabled',
      'positive_profit_required',
      'obligation_creditor_required',
    ])
  })
})
