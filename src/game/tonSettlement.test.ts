import { describe, expect, test } from 'vitest'
import {
  TON_SETTLEMENT_FLOWS,
  createTonSettlementPolicy,
  isGameplayLedgerKind,
  isTonSettlementLedgerKind,
  tonLedgerSettlementDecision,
  tonSettlementFlowGate,
} from './tonSettlement'

describe('TON settlement policy', () => {
  test('keeps every TON flow disabled by default', () => {
    const policy = createTonSettlementPolicy()

    expect(policy).toMatchObject({
      rail: 'ton',
      sourceOfTruth: 'reality_server_ledger',
      walletConnectionRequiredToPlay: false,
      privateKeyCustody: 'forbidden',
      highFrequencyGameplayOnChain: false,
    })

    for (const flow of TON_SETTLEMENT_FLOWS) {
      expect(policy.flows[flow]).toMatchObject({
        flow,
        rail: 'ton',
        enabled: false,
        status: 'blocked',
        readyForManualActivation: false,
        manualApprovalRequired: true,
      })
      expect(policy.flows[flow].blockers).toContain('settlement_execution_disabled')
      expect(policy.flows[flow].blockers).toContain('server_authority_required')
      expect(policy.flows[flow].blockers).toContain('telegram_identity_required')
    }
  })

  test('separates wallet readiness from settlement execution', () => {
    const gate = tonSettlementFlowGate('wallet_connection', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      tonConnectReviewed: true,
    })

    expect(gate).toEqual({
      flow: 'wallet_connection',
      rail: 'ton',
      enabled: false,
      status: 'ready_for_manual_activation',
      blockers: ['settlement_execution_disabled'],
      readyForManualActivation: true,
      manualApprovalRequired: true,
    })
  })

  test('requires compliance, manual review, and KYC/tax before withdrawals are even ready', () => {
    expect(tonSettlementFlowGate('withdrawal', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      tonConnectReviewed: false,
      complianceApproved: true,
      manualSettlementApproved: true,
    })).toMatchObject({
      enabled: false,
      status: 'blocked',
      readyForManualActivation: false,
      blockers: ['settlement_execution_disabled', 'ton_connect_review_required', 'kyc_tax_required'],
    })

    expect(tonSettlementFlowGate('withdrawal', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      tonConnectReviewed: true,
      complianceApproved: true,
      manualSettlementApproved: true,
      kycTaxApproved: true,
    })).toMatchObject({
      enabled: false,
      status: 'ready_for_manual_activation',
      readyForManualActivation: true,
      blockers: ['settlement_execution_disabled'],
    })
  })

  test('keeps non-wallet settlement flows blocked until TON Connect review is complete', () => {
    expect(tonSettlementFlowGate('deposit', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      complianceApproved: true,
      manualSettlementApproved: true,
    })).toMatchObject({
      enabled: false,
      status: 'blocked',
      readyForManualActivation: false,
      blockers: ['settlement_execution_disabled', 'ton_connect_review_required'],
    })

    expect(tonSettlementFlowGate('land_reservation', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      complianceApproved: true,
      manualSettlementApproved: true,
    })).toMatchObject({
      enabled: false,
      status: 'blocked',
      readyForManualActivation: false,
      blockers: ['settlement_execution_disabled', 'ton_connect_review_required'],
    })

    expect(tonSettlementFlowGate('onchain_proof', {
      serverAuthorityReady: true,
      telegramIdentityVerified: true,
      complianceApproved: true,
      manualSettlementApproved: true,
      tonConnectReviewed: true,
    })).toMatchObject({
      enabled: false,
      status: 'ready_for_manual_activation',
      readyForManualActivation: true,
      blockers: ['settlement_execution_disabled'],
    })
  })

  test('keeps gameplay ledger entries off-chain even if they were mislabeled payout eligible', () => {
    expect(isGameplayLedgerKind('customer_purchase')).toBe(true)
    expect(tonLedgerSettlementDecision({
      kind: 'customer_purchase',
      amount: 14,
      payoutEligibility: 'payout_eligible',
    })).toEqual({
      allowedOnChain: false,
      rail: 'ton',
      reason: 'gameplay_transactions_stay_off_chain',
      sourceOfTruth: 'reality_server_ledger',
      manualReviewRequired: true,
    })
  })

  test('keeps future settlement ledger entries disabled until a later integration enables them', () => {
    expect(isTonSettlementLedgerKind('ton_withdrawal_settlement')).toBe(true)
    expect(tonLedgerSettlementDecision({
      kind: 'ton_withdrawal_settlement',
      amount: 120,
      payoutEligibility: 'payout_eligible',
    })).toEqual({
      allowedOnChain: false,
      rail: 'ton',
      reason: 'settlement_execution_disabled',
      sourceOfTruth: 'reality_server_ledger',
      manualReviewRequired: true,
    })
  })

  test('rejects unknown ledger kinds before treating entries as settlement candidates', () => {
    expect(isGameplayLedgerKind('mystery_airdrop')).toBe(false)
    expect(isTonSettlementLedgerKind('mystery_airdrop')).toBe(false)
    expect(tonLedgerSettlementDecision({
      kind: 'mystery_airdrop',
      amount: 120,
      payoutEligibility: 'payout_eligible',
    })).toEqual({
      allowedOnChain: false,
      rail: 'ton',
      reason: 'unknown_ledger_kind',
      sourceOfTruth: 'reality_server_ledger',
      manualReviewRequired: true,
    })
  })

  test('rejects invalid ledger amounts before settlement review', () => {
    expect(tonLedgerSettlementDecision({
      kind: 'ton_deposit_settlement',
      amount: 0,
      payoutEligibility: 'payout_eligible',
    })).toMatchObject({
      allowedOnChain: false,
      reason: 'invalid_ledger_amount',
    })

    expect(tonLedgerSettlementDecision({
      kind: 'mystery_airdrop',
      amount: Number.NaN,
      payoutEligibility: 'payout_eligible',
    })).toMatchObject({
      allowedOnChain: false,
      reason: 'invalid_ledger_amount',
    })
  })
})
