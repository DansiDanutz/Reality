export type PayoutReadinessBlocker =
  | 'game_credits_only'
  | 'payouts_disabled'
  | 'withdrawals_disabled'
  | 'kyc_required'
  | 'tax_profile_required'
  | 'manual_payout_review_required'
  | 'compliance_review_required'
  | 'no_payout_eligible_credits'
  | 'ton_settlement_disabled'

export interface PayoutReadinessInput {
  gameCredits: number
  payoutEligibleCredits?: number
  kycApproved?: boolean
  taxProfileApproved?: boolean
  complianceApproved?: boolean
  manualPayoutApproved?: boolean
  tonSettlementReady?: boolean
  requestedWithdrawalAmount?: number | null
  payoutReceiverAccountId?: string | null
}

export interface WithdrawalDraft {
  kind: 'manual_payout_withdrawal'
  executionEnabled: false
  payoutEnabled: false
  payerAccountId: 'system:reality-payout-treasury'
  receiverAccountId: string
  amount: number
  currency: 'game_credits'
  blockers: readonly PayoutReadinessBlocker[]
}

export interface PayoutReadinessAssessment {
  enabled: false
  mode: 'game_credits_only'
  gameplayLedgerSource: 'reality_server_ledger'
  realWithdrawalsEnabled: false
  manualPayoutApprovalEnabled: false
  noProfitPromise: true
  gameCredits: number
  payoutEligibleCredits: number
  kycStatus: 'approved' | 'not_started'
  taxProfileStatus: 'approved' | 'not_started'
  complianceStatus: 'approved' | 'required'
  manualPayoutStatus: 'approved' | 'required'
  tonSettlementStatus: 'ready' | 'disabled'
  readyForManualWithdrawalReview: boolean
  withdrawalDraft: WithdrawalDraft | null
  blockers: readonly PayoutReadinessBlocker[]
}

export const REALITY_PAYOUT_TREASURY_ACCOUNT_ID = 'system:reality-payout-treasury'

const BASE_DISABLED_BLOCKERS: readonly PayoutReadinessBlocker[] = [
  'game_credits_only',
  'payouts_disabled',
  'withdrawals_disabled',
]

export function assessPayoutReadiness(input: PayoutReadinessInput): PayoutReadinessAssessment {
  const gameCredits = positiveMoney(input.gameCredits)
  const payoutEligibleCredits = positiveMoney(input.payoutEligibleCredits ?? 0)
  const requestedWithdrawalAmount = normalizedRequestedWithdrawal(
    input.requestedWithdrawalAmount ?? null,
    payoutEligibleCredits,
  )
  const receiverAccountId = input.payoutReceiverAccountId?.trim() || null
  const blockers = payoutReadinessBlockers(input, payoutEligibleCredits)
  const readyForManualWithdrawalReview = blockers.every((blocker) =>
    BASE_DISABLED_BLOCKERS.includes(blocker)
  )

  return {
    enabled: false,
    mode: 'game_credits_only',
    gameplayLedgerSource: 'reality_server_ledger',
    realWithdrawalsEnabled: false,
    manualPayoutApprovalEnabled: false,
    noProfitPromise: true,
    gameCredits,
    payoutEligibleCredits,
    kycStatus: input.kycApproved ? 'approved' : 'not_started',
    taxProfileStatus: input.taxProfileApproved ? 'approved' : 'not_started',
    complianceStatus: input.complianceApproved ? 'approved' : 'required',
    manualPayoutStatus: input.manualPayoutApproved ? 'approved' : 'required',
    tonSettlementStatus: input.tonSettlementReady ? 'ready' : 'disabled',
    readyForManualWithdrawalReview,
    withdrawalDraft: readyForManualWithdrawalReview && requestedWithdrawalAmount > 0 && receiverAccountId
      ? {
        kind: 'manual_payout_withdrawal',
        executionEnabled: false,
        payoutEnabled: false,
        payerAccountId: REALITY_PAYOUT_TREASURY_ACCOUNT_ID,
        receiverAccountId,
        amount: requestedWithdrawalAmount,
        currency: 'game_credits',
        blockers,
      }
      : null,
    blockers,
  }
}

export function payoutEligibleCreditsFromLedger(input: {
  gameOnlyCredits: number
  payoutEligibleCredits?: number
}): { gameCredits: number; payoutEligibleCredits: number } {
  return {
    gameCredits: positiveMoney(input.gameOnlyCredits),
    payoutEligibleCredits: positiveMoney(input.payoutEligibleCredits ?? 0),
  }
}

function payoutReadinessBlockers(
  input: PayoutReadinessInput,
  payoutEligibleCredits: number,
): PayoutReadinessBlocker[] {
  const blockers: PayoutReadinessBlocker[] = [...BASE_DISABLED_BLOCKERS]
  if (payoutEligibleCredits <= 0) blockers.push('no_payout_eligible_credits')
  if (!input.kycApproved) blockers.push('kyc_required')
  if (!input.taxProfileApproved) blockers.push('tax_profile_required')
  if (!input.manualPayoutApproved) blockers.push('manual_payout_review_required')
  if (!input.complianceApproved) blockers.push('compliance_review_required')
  if (!input.tonSettlementReady) blockers.push('ton_settlement_disabled')
  return blockers
}

function normalizedRequestedWithdrawal(value: number | null, payoutEligibleCredits: number): number {
  if (value === null || !Number.isFinite(value) || value <= 0) return 0
  return roundMoney(Math.min(value, payoutEligibleCredits))
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
