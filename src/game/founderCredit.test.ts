import { describe, expect, test } from 'vitest'
import {
  FOUNDER_STARTING_GAME_CREDIT,
  REALITY_CREDIT_BANK_ACCOUNT_ID,
  REALITY_TREASURY_ACCOUNT_ID,
  founderCreditIncreaseReview,
  founderCreditSettlementWaterfall,
} from './founderCredit'

describe('founderCreditSettlementWaterfall', () => {
  test('keeps the founder starting credit at $200,000 game credit', () => {
    expect(FOUNDER_STARTING_GAME_CREDIT).toBe(200_000)
  })

  test('repays outstanding founder credit before tax and founder net earnings', () => {
    const waterfall = founderCreditSettlementWaterfall({
      grossEarnings: 250_000,
      outstandingCredit: FOUNDER_STARTING_GAME_CREDIT,
      platformTaxRate: 0.1,
    })

    expect(waterfall).toMatchObject({
      grossEarnings: 250_000,
      outstandingCreditBefore: 200_000,
      creditRepaymentDue: 200_000,
      outstandingCreditAfter: 0,
      taxableEarnings: 50_000,
      platformTaxDue: 5_000,
      founderNetEarnings: 45_000,
      settlementEnabled: false,
      executable: false,
      manualReviewRequired: true,
      blockers: ['settlement_disabled', 'compliance_review_required', 'manual_review_required'],
      accounts: {
        creditBank: REALITY_CREDIT_BANK_ACCOUNT_ID,
        treasury: REALITY_TREASURY_ACCOUNT_ID,
      },
    })
  })

  test('uses all earnings for credit repayment when profit is below outstanding credit', () => {
    const waterfall = founderCreditSettlementWaterfall({
      grossEarnings: 50_000,
      outstandingCredit: 200_000,
      platformTaxRate: 0.1,
    })

    expect(waterfall).toMatchObject({
      creditRepaymentDue: 50_000,
      outstandingCreditAfter: 150_000,
      taxableEarnings: 0,
      platformTaxDue: 0,
      founderNetEarnings: 0,
    })
  })

  test('taxes only earnings left after credit is already clear', () => {
    const waterfall = founderCreditSettlementWaterfall({
      grossEarnings: 10_000,
      outstandingCredit: 0,
      platformTaxRate: 0.15,
      settlementEnabled: true,
    })

    expect(waterfall).toMatchObject({
      creditRepaymentDue: 0,
      taxableEarnings: 10_000,
      platformTaxDue: 1_500,
      founderNetEarnings: 8_500,
      settlementEnabled: true,
      executable: false,
      blockers: ['manual_review_required'],
    })
  })

  test('rounds money to cents and flags no-positive-earnings reviews', () => {
    expect(founderCreditSettlementWaterfall({
      grossEarnings: 0,
      outstandingCredit: 123.456,
      platformTaxRate: 0.075,
      settlementEnabled: true,
    })).toMatchObject({
      grossEarnings: 0,
      outstandingCreditBefore: 123.46,
      creditRepaymentDue: 0,
      blockers: ['manual_review_required', 'no_positive_earnings'],
    })
  })

  test('rejects invalid amounts and tax rates', () => {
    expect(() => founderCreditSettlementWaterfall({
      grossEarnings: -1,
      outstandingCredit: 0,
      platformTaxRate: 0,
    })).toThrow(RangeError)

    expect(() => founderCreditSettlementWaterfall({
      grossEarnings: 1,
      outstandingCredit: 0,
      platformTaxRate: 1.1,
    })).toThrow(RangeError)
  })
})

describe('founderCreditIncreaseReview', () => {
  test('never approves more credit automatically, even with strong activity signals', () => {
    const review = founderCreditIncreaseReview({
      requestedCredit: 25_000,
      maxManualCredit: 100_000,
      currentOutstandingCredit: 0,
      active: true,
      usefulActivityScore: 0.95,
      building: true,
      staffed: true,
      hospitalized: false,
      indebted: false,
    })

    expect(review).toMatchObject({
      requestedCredit: 25_000,
      reviewableCredit: 25_000,
      automaticIncreaseAllowed: false,
      manualReviewRequired: true,
      blockers: ['manual_review_required'],
      signals: {
        active: true,
        usefulActivityScore: 0.95,
        minimumUsefulActivityScore: 0.6,
        building: true,
        staffed: true,
        outstandingCredit: 0,
        hospitalized: false,
        indebted: false,
      },
    })
  })

  test('caps reviewable credit to the manual limit', () => {
    expect(founderCreditIncreaseReview({
      requestedCredit: 250_000,
      maxManualCredit: 40_000,
      currentOutstandingCredit: 0,
      active: true,
      usefulActivityScore: 0.8,
      building: true,
      staffed: true,
      hospitalized: false,
      indebted: false,
    }).reviewableCredit).toBe(40_000)
  })

  test('surfaces founder risk signals as manual review blockers', () => {
    const review = founderCreditIncreaseReview({
      requestedCredit: 0,
      maxManualCredit: 50_000,
      currentOutstandingCredit: 10_000,
      active: false,
      usefulActivityScore: 0.2,
      minimumUsefulActivityScore: 0.7,
      building: false,
      staffed: false,
      hospitalized: true,
      indebted: true,
    })

    expect(review.blockers).toEqual([
      'manual_review_required',
      'invalid_request',
      'inactive_founder',
      'low_useful_activity',
      'no_visible_building',
      'understaffed_operations',
      'outstanding_credit',
      'hospitalized',
      'indebted',
    ])
    expect(review.signals).toMatchObject({
      active: false,
      usefulActivityScore: 0.2,
      minimumUsefulActivityScore: 0.7,
      building: false,
      staffed: false,
      outstandingCredit: 10_000,
      hospitalized: true,
      indebted: true,
    })
  })

  test('rejects invalid credit review values', () => {
    expect(() => founderCreditIncreaseReview({
      requestedCredit: 1,
      maxManualCredit: 1,
      currentOutstandingCredit: 0,
      active: true,
      usefulActivityScore: Number.NaN,
      building: true,
      staffed: true,
      hospitalized: false,
      indebted: false,
    })).toThrow(RangeError)
  })
})
