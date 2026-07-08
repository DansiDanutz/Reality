import type { WorldTransaction, WorldTransactionKind } from './worldSim'

export type LedgerConservationViolationKind =
  | 'missing_payer'
  | 'missing_receiver'
  | 'self_payment'
  | 'invalid_amount'
  | 'subcent_amount'
  | 'payout_eligible_gameplay_transaction'
  | 'system_mint_source_mismatch'
  | 'system_payer_not_allowed'
  | 'system_receiver_not_allowed'

export interface LedgerConservationViolation {
  transactionId: string
  transactionKind: WorldTransactionKind
  violation: LedgerConservationViolationKind
  accountId: string | null
  amount: number
}

export interface LedgerConservationTotals {
  movedAmount: number
  systemMintedAmount: number
  systemReceivedAmount: number
  participantTransferredAmount: number
  payoutEligibleAmount: number
}

export interface LedgerConservationAudit {
  sourceOfTruth: 'reality_server_ledger'
  settlementRail: 'none'
  ok: boolean
  transactionCount: number
  validTransactionCount: number
  totals: LedgerConservationTotals
  violations: readonly LedgerConservationViolation[]
}

const SYSTEM_MINT_SOURCES: Partial<Record<WorldTransactionKind, string>> = {
  founder_credit: 'system:founder-credit',
  sim_citizen_credit: 'system:sim-credit',
}

const SYSTEM_RECEIVERS_BY_KIND: Partial<Record<WorldTransactionKind, readonly string[]>> = {
  business_build: ['system:builders'],
  hospital_bill: ['system:hospital'],
  insurance_payout: ['system:hospital'],
  medical_debt: ['system:hospital'],
  debt_repayment: ['system:hospital'],
}

export function auditLedgerConservation(
  transactions: readonly WorldTransaction[],
): LedgerConservationAudit {
  const violations: LedgerConservationViolation[] = []
  const totals: LedgerConservationTotals = {
    movedAmount: 0,
    systemMintedAmount: 0,
    systemReceivedAmount: 0,
    participantTransferredAmount: 0,
    payoutEligibleAmount: 0,
  }
  let validTransactionCount = 0

  for (const transaction of transactions) {
    const violationCountBefore = violations.length
    const fromId = transaction.fromId.trim()
    const toId = transaction.toId.trim()
    const amount = transaction.amount
    const amountIsValid = isPositiveCentAmount(amount)

    if (!fromId) addViolation(violations, transaction, 'missing_payer', null)
    if (!toId) addViolation(violations, transaction, 'missing_receiver', null)
    if (fromId && toId && fromId === toId) {
      addViolation(violations, transaction, 'self_payment', fromId)
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      addViolation(violations, transaction, 'invalid_amount', null)
    } else if (!hasCentPrecision(amount)) {
      addViolation(violations, transaction, 'subcent_amount', null)
    }
    if (transaction.payoutEligibility !== 'game_only') {
      addViolation(violations, transaction, 'payout_eligible_gameplay_transaction', null)
      if (Number.isFinite(amount) && amount > 0) {
        totals.payoutEligibleAmount = roundMoney(totals.payoutEligibleAmount + amount)
      }
    }

    const fromSystem = isSystemAccount(fromId)
    const toSystem = isSystemAccount(toId)
    if (fromSystem) {
      const expectedSource = SYSTEM_MINT_SOURCES[transaction.kind]
      if (expectedSource) {
        if (fromId !== expectedSource) {
          addViolation(violations, transaction, 'system_mint_source_mismatch', fromId)
        }
      } else {
        addViolation(violations, transaction, 'system_payer_not_allowed', fromId)
      }
    }
    if (toSystem && !isAllowedSystemReceiver(transaction.kind, toId)) {
      addViolation(violations, transaction, 'system_receiver_not_allowed', toId)
    }

    if (amountIsValid) {
      totals.movedAmount = roundMoney(totals.movedAmount + amount)
      if (fromSystem && SYSTEM_MINT_SOURCES[transaction.kind] === fromId && !toSystem) {
        totals.systemMintedAmount = roundMoney(totals.systemMintedAmount + amount)
      } else if (!fromSystem && toSystem && isAllowedSystemReceiver(transaction.kind, toId)) {
        totals.systemReceivedAmount = roundMoney(totals.systemReceivedAmount + amount)
      } else if (!fromSystem && !toSystem) {
        totals.participantTransferredAmount = roundMoney(totals.participantTransferredAmount + amount)
      }
    }

    if (violations.length === violationCountBefore) validTransactionCount += 1
  }

  return {
    sourceOfTruth: 'reality_server_ledger',
    settlementRail: 'none',
    ok: violations.length === 0,
    transactionCount: transactions.length,
    validTransactionCount,
    totals,
    violations,
  }
}

function addViolation(
  violations: LedgerConservationViolation[],
  transaction: WorldTransaction,
  violation: LedgerConservationViolationKind,
  accountId: string | null,
): void {
  violations.push({
    transactionId: transaction.id,
    transactionKind: transaction.kind,
    violation,
    accountId,
    amount: transaction.amount,
  })
}

function isAllowedSystemReceiver(kind: WorldTransactionKind, accountId: string): boolean {
  return SYSTEM_RECEIVERS_BY_KIND[kind]?.includes(accountId) ?? false
}

function isSystemAccount(accountId: string): boolean {
  return accountId.startsWith('system:')
}

function isPositiveCentAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0 && hasCentPrecision(value)
}

function hasCentPrecision(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-9
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
