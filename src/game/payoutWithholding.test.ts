import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PAYOUT_PLATFORM_FEE_RATE,
  DEFAULT_TAX_WITHHOLDING_RATE,
  PLATFORM_FEE_RECEIVER_ID,
  TAX_WITHHOLDING_ACCOUNT_ID,
  assessPayoutWithholdingPolicy,
} from './payoutWithholding'

describe('payout withholding policy', () => {
  test('keeps payout and withdrawal execution disabled by default', () => {
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: 'founder-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      payoutsEnabled: false,
      withdrawalsEnabled: false,
      settlementRail: 'ton',
      sourceOfTruth: 'reality_server_ledger',
      walletConnectionRequiredToPlay: false,
      privateKeyCustody: 'forbidden',
      manualReviewRequired: true,
      ownerCitizenId: 'founder-1',
      receiverAccountId: null,
      grossPayoutEligibleCredits: 0,
      taxWithholdingRate: DEFAULT_TAX_WITHHOLDING_RATE,
      platformFeeRate: DEFAULT_PAYOUT_PLATFORM_FEE_RATE,
      taxProfileVerified: false,
      kycTaxApproved: false,
      complianceApproved: false,
      manualPayoutApproved: false,
      readyForManualReview: false,
      draft: null,
    })
    expect(assessment.blockers).toEqual([
      'payouts_disabled',
      'withdrawals_disabled',
      'server_authority_required',
      'telegram_identity_required',
      'receiver_account_required',
      'payout_eligible_balance_required',
      'tax_profile_required',
      'kyc_tax_required',
      'compliance_review_required',
      'manual_payout_review_required',
    ])
  })

  test('drafts disabled tax and platform withholding when funds are review-ready', () => {
    const requestedAt = 1_783_303_200_000
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: ' founder-1 ',
      receiverAccountId: ' ton:wallet-1 ',
      grossPayoutEligibleCredits: 1_000,
      taxWithholdingRate: 0.12,
      platformFeeRate: 0.03,
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      taxProfileVerified: true,
      kycTaxApproved: true,
      complianceApproved: true,
      manualPayoutApproved: false,
      requestedAt,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.draft).toEqual({
      kind: 'payout_withholding',
      executionEnabled: false,
      payoutsEnabled: false,
      withdrawalsEnabled: false,
      settlementRail: 'ton',
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      payerCitizenId: 'founder-1',
      receiverAccountId: 'ton:wallet-1',
      taxWithholdingAccountId: TAX_WITHHOLDING_ACCOUNT_ID,
      platformFeeReceiverId: PLATFORM_FEE_RECEIVER_ID,
      grossPayoutEligibleCredits: 1_000,
      taxWithholdingRate: 0.12,
      taxWithholdingAmount: 120,
      platformFeeRate: 0.03,
      platformFeeAmount: 26.4,
      netPayoutCredits: 853.6,
      requestedAt,
      blockers: [
        'payouts_disabled',
        'withdrawals_disabled',
        'manual_payout_review_required',
      ],
    })
  })

  test('requires tax profile, KYC tax approval, compliance, and manual review gates', () => {
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: 'founder-1',
      receiverAccountId: 'ton:wallet-1',
      grossPayoutEligibleCredits: 500,
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      taxProfileVerified: false,
      kycTaxApproved: false,
      complianceApproved: false,
      manualPayoutApproved: false,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'payouts_disabled',
      'withdrawals_disabled',
      'tax_profile_required',
      'kyc_tax_required',
      'compliance_review_required',
      'manual_payout_review_required',
    ])
  })

  test('keeps the draft disabled even after manual approval is modeled', () => {
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: 'founder-1',
      receiverAccountId: 'ton:wallet-1',
      grossPayoutEligibleCredits: 100,
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      taxProfileVerified: true,
      kycTaxApproved: true,
      complianceApproved: true,
      manualPayoutApproved: true,
    })

    expect(assessment.blockers).toEqual(['payouts_disabled', 'withdrawals_disabled'])
    expect(assessment.draft).toMatchObject({
      executionEnabled: false,
      payoutsEnabled: false,
      withdrawalsEnabled: false,
      netPayoutCredits: 95,
      blockers: ['payouts_disabled', 'withdrawals_disabled'],
    })
  })

  test('normalizes invalid balances, rates, receiver ids, and request times', () => {
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: ' founder-1 ',
      receiverAccountId: ' ',
      grossPayoutEligibleCredits: Number.POSITIVE_INFINITY,
      taxWithholdingRate: 2,
      platformFeeRate: -0.2,
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      taxProfileVerified: true,
      kycTaxApproved: true,
      complianceApproved: true,
      manualPayoutApproved: true,
      requestedAt: -1,
    })

    expect(assessment.ownerCitizenId).toBe('founder-1')
    expect(assessment.receiverAccountId).toBeNull()
    expect(assessment.grossPayoutEligibleCredits).toBe(0)
    expect(assessment.taxWithholdingRate).toBe(1)
    expect(assessment.platformFeeRate).toBe(0)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'payouts_disabled',
      'withdrawals_disabled',
      'receiver_account_required',
      'payout_eligible_balance_required',
    ])
  })

  test('requires the earning founder identity before any withholding draft exists', () => {
    const assessment = assessPayoutWithholdingPolicy({
      ownerCitizenId: ' ',
      receiverAccountId: 'ton:wallet-1',
      grossPayoutEligibleCredits: 750,
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      taxProfileVerified: true,
      kycTaxApproved: true,
      complianceApproved: true,
      manualPayoutApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'payouts_disabled',
      'withdrawals_disabled',
      'owner_identity_required',
    ])
  })
})
