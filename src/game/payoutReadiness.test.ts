import { describe, expect, test } from 'vitest'
import {
  REALITY_PAYOUT_TREASURY_ACCOUNT_ID,
  assessPayoutReadiness,
  payoutEligibleCreditsFromLedger,
} from './payoutReadiness'

describe('payout readiness policy', () => {
  test('keeps game credits separate from payout eligibility by default', () => {
    const assessment = assessPayoutReadiness({
      gameCredits: 197_500,
    })

    expect(assessment).toEqual({
      enabled: false,
      mode: 'game_credits_only',
      gameplayLedgerSource: 'reality_server_ledger',
      realWithdrawalsEnabled: false,
      manualPayoutApprovalEnabled: false,
      noProfitPromise: true,
      gameCredits: 197_500,
      payoutEligibleCredits: 0,
      kycStatus: 'not_started',
      taxProfileStatus: 'not_started',
      complianceStatus: 'required',
      manualPayoutStatus: 'required',
      tonSettlementStatus: 'disabled',
      readyForManualWithdrawalReview: false,
      withdrawalDraft: null,
      blockers: [
        'game_credits_only',
        'payouts_disabled',
        'withdrawals_disabled',
        'no_payout_eligible_credits',
        'kyc_required',
        'tax_profile_required',
        'manual_payout_review_required',
        'compliance_review_required',
        'ton_settlement_disabled',
      ],
    })
  })

  test('still disables withdrawal execution when every future review gate is ready', () => {
    const assessment = assessPayoutReadiness({
      gameCredits: 12_000,
      payoutEligibleCredits: 1_250,
      kycApproved: true,
      taxProfileApproved: true,
      complianceApproved: true,
      manualPayoutApproved: true,
      tonSettlementReady: true,
      requestedWithdrawalAmount: 900,
      payoutReceiverAccountId: 'ton:receiver-wallet',
    })

    expect(assessment.readyForManualWithdrawalReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'game_credits_only',
      'payouts_disabled',
      'withdrawals_disabled',
    ])
    expect(assessment.withdrawalDraft).toEqual({
      kind: 'manual_payout_withdrawal',
      executionEnabled: false,
      payoutEnabled: false,
      payerAccountId: REALITY_PAYOUT_TREASURY_ACCOUNT_ID,
      receiverAccountId: 'ton:receiver-wallet',
      amount: 900,
      currency: 'game_credits',
      blockers: [
        'game_credits_only',
        'payouts_disabled',
        'withdrawals_disabled',
      ],
    })
  })

  test('caps withdrawal drafts to payout-eligible credits and never game-only credits', () => {
    const assessment = assessPayoutReadiness({
      gameCredits: 200_000,
      payoutEligibleCredits: 300,
      kycApproved: true,
      taxProfileApproved: true,
      complianceApproved: true,
      manualPayoutApproved: true,
      tonSettlementReady: true,
      requestedWithdrawalAmount: 1_000,
      payoutReceiverAccountId: 'ton:receiver-wallet',
    })

    expect(assessment.gameCredits).toBe(200_000)
    expect(assessment.withdrawalDraft?.amount).toBe(300)
  })

  test('requires all manual/compliance gates before a withdrawal draft can exist', () => {
    const assessment = assessPayoutReadiness({
      gameCredits: 10_000,
      payoutEligibleCredits: 500,
      requestedWithdrawalAmount: 250,
      payoutReceiverAccountId: 'ton:receiver-wallet',
      kycApproved: true,
      taxProfileApproved: true,
      complianceApproved: false,
      manualPayoutApproved: true,
      tonSettlementReady: true,
    })

    expect(assessment.readyForManualWithdrawalReview).toBe(false)
    expect(assessment.withdrawalDraft).toBeNull()
    expect(assessment.blockers).toContain('compliance_review_required')
  })

  test('normalizes invalid money without creating payout value', () => {
    const ledger = payoutEligibleCreditsFromLedger({
      gameOnlyCredits: Number.POSITIVE_INFINITY,
      payoutEligibleCredits: -20,
    })

    expect(ledger).toEqual({ gameCredits: 0, payoutEligibleCredits: 0 })
    expect(assessPayoutReadiness({
      gameCredits: Number.NaN,
      payoutEligibleCredits: Number.POSITIVE_INFINITY,
      requestedWithdrawalAmount: -1,
      payoutReceiverAccountId: ' ',
    })).toMatchObject({
      gameCredits: 0,
      payoutEligibleCredits: 0,
      withdrawalDraft: null,
    })
  })
})
