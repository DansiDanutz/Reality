import { FOUNDER_BALANCE } from './catalog'

export type FounderStarterCreditBlocker =
  | 'starter_credit_obligation_recording_disabled'
  | 'starter_credit_repayment_disabled'
  | 'server_authority_required'
  | 'founder_identity_required'
  | 'area_claim_required'
  | 'positive_credit_required'
  | 'founder_covenant_required'
  | 'manual_credit_terms_review_required'

export interface FounderStarterCreditPolicyInput {
  founderCitizenId?: string | null
  founderCreditTransactionId?: string | null
  starterCreditAmount?: number | null
  areaClaimConfirmed?: boolean
  founderCovenantAccepted?: boolean
  serverAuthorityReady?: boolean
  manualCreditTermsApproved?: boolean
  issuedAt?: number | null
}

export interface FounderStarterCreditObligationDraft {
  kind: 'founder_starter_credit_obligation'
  executionEnabled: false
  obligationRecordingEnabled: false
  repaymentExecutionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  payerCitizenId: string
  receiverAccountId: typeof FOUNDER_STARTER_CREDIT_BANK_ACCOUNT_ID
  sourceTransactionId: string | null
  principalAmount: number
  outstandingPrincipal: number
  interestRate: 0
  dueAt: null
  issuedAt: number | null
  repaymentPriority: 'repay_before_real_payout'
  blockers: readonly FounderStarterCreditBlocker[]
}

export interface FounderStarterCreditPolicyAssessment {
  enabled: false
  obligationRecordingEnabled: false
  repaymentExecutionEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  founderCitizenId: string
  founderCreditTransactionId: string | null
  starterCreditAmount: number
  areaClaimConfirmed: boolean
  founderCovenantAccepted: boolean
  interestRate: 0
  repaymentPriority: 'repay_before_real_payout'
  readyForManualReview: boolean
  obligationDraft: FounderStarterCreditObligationDraft | null
  blockers: readonly FounderStarterCreditBlocker[]
}

export const FOUNDER_STARTER_CREDIT_BANK_ACCOUNT_ID = 'system:founder-credit'
// Single source of truth: catalog.ts's FOUNDER_BALANCE (see ECONOMY.md's
// founder-economy section for why this used to be a third independent literal).
export const DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT = FOUNDER_BALANCE

const BASE_DISABLED_BLOCKERS: readonly FounderStarterCreditBlocker[] = [
  'starter_credit_obligation_recording_disabled',
  'starter_credit_repayment_disabled',
]

export function assessFounderStarterCreditPolicy(
  input: FounderStarterCreditPolicyInput = {},
): FounderStarterCreditPolicyAssessment {
  const founderCitizenId = normalizedText(input.founderCitizenId) ?? ''
  const founderCreditTransactionId = normalizedText(input.founderCreditTransactionId)
  const starterCreditAmount = positiveMoney(input.starterCreditAmount ?? DEFAULT_FOUNDER_STARTER_CREDIT_AMOUNT)
  const areaClaimConfirmed = input.areaClaimConfirmed === true
  const founderCovenantAccepted = input.founderCovenantAccepted === true

  const readinessBlockers: FounderStarterCreditBlocker[] = []
  if (!input.serverAuthorityReady) readinessBlockers.push('server_authority_required')
  if (!founderCitizenId) readinessBlockers.push('founder_identity_required')
  if (!areaClaimConfirmed) readinessBlockers.push('area_claim_required')
  if (starterCreditAmount <= 0) readinessBlockers.push('positive_credit_required')
  if (!founderCovenantAccepted) readinessBlockers.push('founder_covenant_required')
  if (!input.manualCreditTermsApproved) readinessBlockers.push('manual_credit_terms_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) =>
    blocker === 'manual_credit_terms_review_required'
  )
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    obligationRecordingEnabled: false,
    repaymentExecutionEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    founderCitizenId,
    founderCreditTransactionId,
    starterCreditAmount,
    areaClaimConfirmed,
    founderCovenantAccepted,
    interestRate: 0,
    repaymentPriority: 'repay_before_real_payout',
    readyForManualReview,
    obligationDraft: readyForManualReview && founderCitizenId && starterCreditAmount > 0
      ? {
        kind: 'founder_starter_credit_obligation',
        executionEnabled: false,
        obligationRecordingEnabled: false,
        repaymentExecutionEnabled: false,
        sourceOfTruth: 'reality_server_ledger',
        currency: 'game_credits',
        payerCitizenId: founderCitizenId,
        receiverAccountId: FOUNDER_STARTER_CREDIT_BANK_ACCOUNT_ID,
        sourceTransactionId: founderCreditTransactionId,
        principalAmount: starterCreditAmount,
        outstandingPrincipal: starterCreditAmount,
        interestRate: 0,
        dueAt: null,
        issuedAt: normalizedInstant(input.issuedAt ?? null),
        repaymentPriority: 'repay_before_real_payout',
        blockers,
      }
      : null,
    blockers,
  }
}

function normalizedText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function uniqueBlockers(blockers: readonly FounderStarterCreditBlocker[]): FounderStarterCreditBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
