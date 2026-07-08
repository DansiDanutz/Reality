export type PayoutWithholdingBlocker =
  | 'payouts_disabled'
  | 'withdrawals_disabled'
  | 'server_authority_required'
  | 'telegram_identity_required'
  | 'owner_identity_required'
  | 'receiver_account_required'
  | 'payout_eligible_balance_required'
  | 'tax_profile_required'
  | 'kyc_tax_required'
  | 'compliance_review_required'
  | 'manual_payout_review_required'

export interface PayoutWithholdingPolicyInput {
  ownerCitizenId: string
  receiverAccountId?: string | null
  grossPayoutEligibleCredits?: number | null
  taxWithholdingRate?: number | null
  platformFeeRate?: number | null
  serverAuthorityReady?: boolean
  telegramIdentityVerified?: boolean
  taxProfileVerified?: boolean
  kycTaxApproved?: boolean
  complianceApproved?: boolean
  manualPayoutApproved?: boolean
  requestedAt?: number | null
}

export interface PayoutWithholdingDraft {
  kind: 'payout_withholding'
  executionEnabled: false
  payoutsEnabled: false
  withdrawalsEnabled: false
  settlementRail: 'ton'
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  payerCitizenId: string
  receiverAccountId: string
  taxWithholdingAccountId: typeof TAX_WITHHOLDING_ACCOUNT_ID
  platformFeeReceiverId: typeof PLATFORM_FEE_RECEIVER_ID
  grossPayoutEligibleCredits: number
  taxWithholdingRate: number
  taxWithholdingAmount: number
  platformFeeRate: number
  platformFeeAmount: number
  netPayoutCredits: number
  requestedAt: number | null
  blockers: readonly PayoutWithholdingBlocker[]
}

export interface PayoutWithholdingPolicyAssessment {
  enabled: false
  payoutsEnabled: false
  withdrawalsEnabled: false
  settlementRail: 'ton'
  sourceOfTruth: 'reality_server_ledger'
  walletConnectionRequiredToPlay: false
  privateKeyCustody: 'forbidden'
  manualReviewRequired: true
  ownerCitizenId: string
  receiverAccountId: string | null
  grossPayoutEligibleCredits: number
  taxWithholdingRate: number
  platformFeeRate: number
  taxProfileVerified: boolean
  kycTaxApproved: boolean
  complianceApproved: boolean
  manualPayoutApproved: boolean
  readyForManualReview: boolean
  draft: PayoutWithholdingDraft | null
  blockers: readonly PayoutWithholdingBlocker[]
}

export const DEFAULT_TAX_WITHHOLDING_RATE = 0
export const DEFAULT_PAYOUT_PLATFORM_FEE_RATE = 0.05
export const TAX_WITHHOLDING_ACCOUNT_ID = 'system:tax-withholding-review'
export const PLATFORM_FEE_RECEIVER_ID = 'system:reality-platform-fees'

const BASE_DISABLED_BLOCKERS: readonly PayoutWithholdingBlocker[] = [
  'payouts_disabled',
  'withdrawals_disabled',
]

export function assessPayoutWithholdingPolicy(
  input: PayoutWithholdingPolicyInput,
): PayoutWithholdingPolicyAssessment {
  const ownerCitizenId = input.ownerCitizenId.trim()
  const receiverAccountId = input.receiverAccountId?.trim() || null
  const grossPayoutEligibleCredits = positiveMoney(input.grossPayoutEligibleCredits ?? 0)
  const taxWithholdingRate = normalizedRate(input.taxWithholdingRate, DEFAULT_TAX_WITHHOLDING_RATE)
  const platformFeeRate = normalizedRate(input.platformFeeRate, DEFAULT_PAYOUT_PLATFORM_FEE_RATE)
  const taxProfileVerified = input.taxProfileVerified === true
  const kycTaxApproved = input.kycTaxApproved === true
  const complianceApproved = input.complianceApproved === true
  const manualPayoutApproved = input.manualPayoutApproved === true

  const readinessBlockers: PayoutWithholdingBlocker[] = []
  if (!input.serverAuthorityReady) readinessBlockers.push('server_authority_required')
  if (!input.telegramIdentityVerified) readinessBlockers.push('telegram_identity_required')
  if (!ownerCitizenId) readinessBlockers.push('owner_identity_required')
  if (!receiverAccountId) readinessBlockers.push('receiver_account_required')
  if (grossPayoutEligibleCredits <= 0) readinessBlockers.push('payout_eligible_balance_required')
  if (!taxProfileVerified) readinessBlockers.push('tax_profile_required')
  if (!kycTaxApproved) readinessBlockers.push('kyc_tax_required')
  if (!complianceApproved) readinessBlockers.push('compliance_review_required')
  if (!manualPayoutApproved) readinessBlockers.push('manual_payout_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_payout_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    payoutsEnabled: false,
    withdrawalsEnabled: false,
    settlementRail: 'ton',
    sourceOfTruth: 'reality_server_ledger',
    walletConnectionRequiredToPlay: false,
    privateKeyCustody: 'forbidden',
    manualReviewRequired: true,
    ownerCitizenId,
    receiverAccountId,
    grossPayoutEligibleCredits,
    taxWithholdingRate,
    platformFeeRate,
    taxProfileVerified,
    kycTaxApproved,
    complianceApproved,
    manualPayoutApproved,
    readyForManualReview,
    draft: readyForManualReview && ownerCitizenId && receiverAccountId
      ? payoutWithholdingDraft({
        ownerCitizenId,
        receiverAccountId,
        grossPayoutEligibleCredits,
        taxWithholdingRate,
        platformFeeRate,
        requestedAt: normalizedInstant(input.requestedAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function payoutWithholdingDraft(input: {
  ownerCitizenId: string
  receiverAccountId: string
  grossPayoutEligibleCredits: number
  taxWithholdingRate: number
  platformFeeRate: number
  requestedAt: number | null
  blockers: readonly PayoutWithholdingBlocker[]
}): PayoutWithholdingDraft {
  const taxWithholdingAmount = roundMoney(input.grossPayoutEligibleCredits * input.taxWithholdingRate)
  const afterTax = roundMoney(input.grossPayoutEligibleCredits - taxWithholdingAmount)
  const platformFeeAmount = roundMoney(afterTax * input.platformFeeRate)
  return {
    kind: 'payout_withholding',
    executionEnabled: false,
    payoutsEnabled: false,
    withdrawalsEnabled: false,
    settlementRail: 'ton',
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    payerCitizenId: input.ownerCitizenId,
    receiverAccountId: input.receiverAccountId,
    taxWithholdingAccountId: TAX_WITHHOLDING_ACCOUNT_ID,
    platformFeeReceiverId: PLATFORM_FEE_RECEIVER_ID,
    grossPayoutEligibleCredits: input.grossPayoutEligibleCredits,
    taxWithholdingRate: input.taxWithholdingRate,
    taxWithholdingAmount,
    platformFeeRate: input.platformFeeRate,
    platformFeeAmount,
    netPayoutCredits: roundMoney(afterTax - platformFeeAmount),
    requestedAt: input.requestedAt,
    blockers: input.blockers,
  }
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedRate(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return roundMoney(Math.min(1, Math.max(0, value)))
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly PayoutWithholdingBlocker[]): PayoutWithholdingBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
