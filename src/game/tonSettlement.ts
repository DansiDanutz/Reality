export type TonSettlementFlow =
  | 'wallet_connection'
  | 'deposit'
  | 'withdrawal'
  | 'land_reservation'
  | 'lease_payment'
  | 'onchain_proof'

export type TonSettlementBlocker =
  | 'settlement_execution_disabled'
  | 'server_authority_required'
  | 'telegram_identity_required'
  | 'ton_connect_review_required'
  | 'compliance_review_required'
  | 'manual_settlement_review_required'
  | 'kyc_tax_required'

export type TonSettlementStatus = 'blocked' | 'ready_for_manual_activation'

export interface TonSettlementReadinessInput {
  serverAuthorityReady?: boolean
  telegramIdentityVerified?: boolean
  tonConnectReviewed?: boolean
  complianceApproved?: boolean
  manualSettlementApproved?: boolean
  kycTaxApproved?: boolean
}

export interface TonSettlementFlowGate {
  flow: TonSettlementFlow
  rail: 'ton'
  enabled: false
  status: TonSettlementStatus
  blockers: readonly TonSettlementBlocker[]
  readyForManualActivation: boolean
  manualApprovalRequired: true
}

export interface TonSettlementPolicy {
  rail: 'ton'
  sourceOfTruth: 'reality_server_ledger'
  walletConnectionRequiredToPlay: false
  privateKeyCustody: 'forbidden'
  highFrequencyGameplayOnChain: false
  flows: Record<TonSettlementFlow, TonSettlementFlowGate>
}

export type TonLedgerPayoutEligibility = 'game_only' | 'payout_eligible'

export interface TonSettlementLedgerEntry {
  kind: string
  amount: number
  payoutEligibility: TonLedgerPayoutEligibility
}

export type TonLedgerSettlementDecisionReason =
  | 'gameplay_transactions_stay_off_chain'
  | 'settlement_execution_disabled'
  | 'unknown_ledger_kind'
  | 'invalid_ledger_amount'

export interface TonLedgerSettlementDecision {
  allowedOnChain: false
  rail: 'ton'
  reason: TonLedgerSettlementDecisionReason
  sourceOfTruth: 'reality_server_ledger'
  manualReviewRequired: true
}

export const TON_SETTLEMENT_FLOWS: readonly TonSettlementFlow[] = [
  'wallet_connection',
  'deposit',
  'withdrawal',
  'land_reservation',
  'lease_payment',
  'onchain_proof',
]

const GAMEPLAY_LEDGER_KINDS = new Set([
  'founder_credit',
  'sim_citizen_credit',
  'business_build',
  'customer_purchase',
  'worker_wage',
  'insurance_premium',
  'insurance_payout',
  'hospital_bill',
  'medical_debt',
  'debt_repayment',
])

const SETTLEMENT_LEDGER_KINDS = new Set([
  'ton_deposit_settlement',
  'ton_withdrawal_settlement',
  'ton_land_reservation_settlement',
  'ton_lease_settlement',
  'ton_onchain_proof',
])

export function createTonSettlementPolicy(input: TonSettlementReadinessInput = {}): TonSettlementPolicy {
  return {
    rail: 'ton',
    sourceOfTruth: 'reality_server_ledger',
    walletConnectionRequiredToPlay: false,
    privateKeyCustody: 'forbidden',
    highFrequencyGameplayOnChain: false,
    flows: Object.fromEntries(
      TON_SETTLEMENT_FLOWS.map((flow) => [flow, tonSettlementFlowGate(flow, input)]),
    ) as Record<TonSettlementFlow, TonSettlementFlowGate>,
  }
}

export function tonSettlementFlowGate(
  flow: TonSettlementFlow,
  input: TonSettlementReadinessInput = {},
): TonSettlementFlowGate {
  const missing = missingTonSettlementPrerequisites(flow, input)
  const readyForManualActivation = missing.length === 0
  return {
    flow,
    rail: 'ton',
    enabled: false,
    status: readyForManualActivation ? 'ready_for_manual_activation' : 'blocked',
    blockers: ['settlement_execution_disabled', ...missing],
    readyForManualActivation,
    manualApprovalRequired: true,
  }
}

export function tonLedgerSettlementDecision(entry: TonSettlementLedgerEntry): TonLedgerSettlementDecision {
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
    return disabledLedgerDecision('invalid_ledger_amount')
  }
  if (isGameplayLedgerKind(entry.kind)) {
    return disabledLedgerDecision('gameplay_transactions_stay_off_chain')
  }
  if (!isTonSettlementLedgerKind(entry.kind)) {
    return disabledLedgerDecision('unknown_ledger_kind')
  }
  return disabledLedgerDecision('settlement_execution_disabled')
}

export function isGameplayLedgerKind(kind: string): boolean {
  return GAMEPLAY_LEDGER_KINDS.has(kind)
}

export function isTonSettlementLedgerKind(kind: string): boolean {
  return SETTLEMENT_LEDGER_KINDS.has(kind)
}

function missingTonSettlementPrerequisites(
  flow: TonSettlementFlow,
  input: TonSettlementReadinessInput,
): TonSettlementBlocker[] {
  const blockers: TonSettlementBlocker[] = []
  if (!isReadinessApproved(input.serverAuthorityReady)) blockers.push('server_authority_required')
  if (!isReadinessApproved(input.telegramIdentityVerified)) blockers.push('telegram_identity_required')

  if (flow === 'wallet_connection') {
    if (!isReadinessApproved(input.tonConnectReviewed)) blockers.push('ton_connect_review_required')
    return blockers
  }

  if (!isReadinessApproved(input.complianceApproved)) blockers.push('compliance_review_required')
  if (!isReadinessApproved(input.manualSettlementApproved)) blockers.push('manual_settlement_review_required')

  if (flow === 'withdrawal' && !isReadinessApproved(input.kycTaxApproved)) {
    blockers.push('kyc_tax_required')
  }

  return blockers
}

function isReadinessApproved(value: unknown): value is true {
  return value === true
}

function disabledLedgerDecision(reason: TonLedgerSettlementDecisionReason): TonLedgerSettlementDecision {
  return {
    allowedOnChain: false,
    rail: 'ton',
    reason,
    sourceOfTruth: 'reality_server_ledger',
    manualReviewRequired: true,
  }
}
