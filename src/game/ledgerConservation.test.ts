import { describe, expect, test } from 'vitest'

import { auditLedgerConservation } from './ledgerConservation'
import type { WorldTransaction, WorldTransactionKind } from './worldSim'

describe('ledger conservation audit', () => {
  test('accepts explicit starting-credit mints, participant transfers, and known system sinks', () => {
    const audit = auditLedgerConservation([
      tx('founder_credit', { id: 'tx1', fromId: 'system:founder-credit', toId: 'founder', amount: 200_000 }),
      tx('sim_citizen_credit', { id: 'tx2', fromId: 'system:sim-credit', toId: 'sim1', amount: 500 }),
      tx('customer_purchase', { id: 'tx3', fromId: 'sim1', toId: 'water1', amount: 2 }),
      tx('worker_wage', { id: 'tx4', fromId: 'water1', toId: 'sim1', amount: 10 }),
      tx('business_build', { id: 'tx5', fromId: 'founder', toId: 'system:builders', amount: 8_000 }),
      tx('hospital_bill', { id: 'tx6', fromId: 'founder', toId: 'system:hospital', amount: 90 }),
      tx('insurance_payout', { id: 'tx7', fromId: 'ins1', toId: 'system:hospital', amount: 100 }),
    ])

    expect(audit).toEqual({
      sourceOfTruth: 'reality_server_ledger',
      settlementRail: 'none',
      ok: true,
      transactionCount: 7,
      validTransactionCount: 7,
      totals: {
        movedAmount: 208_702,
        systemMintedAmount: 200_500,
        systemReceivedAmount: 8_190,
        participantTransferredAmount: 12,
        payoutEligibleAmount: 0,
      },
      violations: [],
    })
  })

  test('flags hidden system money and unknown system receivers', () => {
    const audit = auditLedgerConservation([
      tx('customer_purchase', { id: 'tx1', fromId: 'system:bonus', toId: 'food1', amount: 50 }),
      tx('founder_credit', { id: 'tx2', fromId: 'system:bonus', toId: 'founder', amount: 200_000 }),
      tx('customer_purchase', { id: 'tx3', fromId: 'founder', toId: 'system:marketing', amount: 25 }),
    ])

    expect(audit.ok).toBe(false)
    expect(audit.validTransactionCount).toBe(0)
    expect(audit.violations).toEqual([
      {
        transactionId: 'tx1',
        transactionKind: 'customer_purchase',
        violation: 'system_payer_not_allowed',
        accountId: 'system:bonus',
        amount: 50,
      },
      {
        transactionId: 'tx2',
        transactionKind: 'founder_credit',
        violation: 'system_mint_source_mismatch',
        accountId: 'system:bonus',
        amount: 200_000,
      },
      {
        transactionId: 'tx3',
        transactionKind: 'customer_purchase',
        violation: 'system_receiver_not_allowed',
        accountId: 'system:marketing',
        amount: 25,
      },
    ])
  })

  test('flags missing endpoints, self-payments, invalid amounts, and sub-cent rows', () => {
    const audit = auditLedgerConservation([
      tx('customer_purchase', { id: 'tx1', fromId: ' ', toId: 'food1', amount: 14 }),
      tx('worker_wage', { id: 'tx2', fromId: 'food1', toId: '', amount: 10 }),
      tx('insurance_premium', { id: 'tx3', fromId: 'founder', toId: 'founder', amount: 45 }),
      tx('hospital_bill', { id: 'tx4', fromId: 'founder', toId: 'system:hospital', amount: 0 }),
      tx('debt_repayment', { id: 'tx5', fromId: 'founder', toId: 'system:hospital', amount: 12.345 }),
    ])

    expect(audit.ok).toBe(false)
    expect(audit.violations.map((violation) => violation.violation)).toEqual([
      'missing_payer',
      'missing_receiver',
      'self_payment',
      'invalid_amount',
      'subcent_amount',
    ])
    expect(audit.totals.movedAmount).toBe(69)
  })

  test('keeps gameplay ledger settlement-free by rejecting payout eligible rows', () => {
    const audit = auditLedgerConservation([
      tx('customer_purchase', {
        id: 'tx1',
        fromId: 'founder',
        toId: 'food1',
        amount: 14,
        payoutEligibility: 'payout_eligible',
      }),
    ])

    expect(audit).toMatchObject({
      sourceOfTruth: 'reality_server_ledger',
      settlementRail: 'none',
      ok: false,
      transactionCount: 1,
      validTransactionCount: 0,
      totals: {
        movedAmount: 14,
        systemMintedAmount: 0,
        systemReceivedAmount: 0,
        participantTransferredAmount: 14,
        payoutEligibleAmount: 14,
      },
    })
    expect(audit.violations).toEqual([
      {
        transactionId: 'tx1',
        transactionKind: 'customer_purchase',
        violation: 'payout_eligible_gameplay_transaction',
        accountId: null,
        amount: 14,
      },
    ])
  })
})

function tx(kind: WorldTransactionKind, overrides: Partial<WorldTransaction>): WorldTransaction {
  return {
    id: 'tx',
    at: 1,
    kind,
    payoutEligibility: 'game_only',
    fromId: 'founder',
    toId: 'business',
    amount: 1,
    memo: kind,
    ...overrides,
  }
}
