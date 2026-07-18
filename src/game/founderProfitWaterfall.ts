export type FounderProfitWaterfallObligationKind =
  | 'founder_credit'
  | 'medical_debt'
  | 'lease_debt'
  | 'platform_fee'

export type FounderProfitWaterfallBlocker =
  | 'profit_waterfall_execution_disabled'
  | 'payout_review_disabled'
  | 'server_authority_required'
  | 'founder_identity_required'
  | 'positive_profit_required'
  | 'manual_profit_review_required'
  | 'obligation_creditor_required'

export interface FounderProfitWaterfallObligationInput {
  id: string
  kind: FounderProfitWaterfallObligationKind
  creditorAccountId: string
  outstandingAmount: number
}

export interface FounderProfitRepaymentDraft {
  kind: 'founder_profit_repayment'
  executionEnabled: false
  payoutReviewEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  payerCitizenId: string
  receiverAccountId: string
  obligationId: string
  obligationKind: FounderProfitWaterfallObligationKind
  amount: number
  reviewedAt: number | null
  blockers: readonly FounderProfitWaterfallBlocker[]
}

export interface FounderProfitWaterfallObligation {
  id: string
  kind: FounderProfitWaterfallObligationKind
  creditorAccountId: string
  outstandingAmount: number
  priority: number
}

export interface FounderProfitWaterfallAssessment {
  enabled: false
  executionEnabled: false
  payoutReviewEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  founderCitizenId: string
  periodBusinessProfit: number
  taxRate: number
  outstandingObligations: readonly FounderProfitWaterfallObligation[]
  repaymentDrafts: readonly FounderProfitRepaymentDraft[]
  totals: {
    profitAvailable: number
    repaymentDrafted: number
    remainingObligations: number
    surplusGameCredits: number
    taxableSurplus: number
    taxAmount: number
    netGameCredits: number
    payoutEligibleSurplus: 0
  }
  readyForManualReview: boolean
  blockers: readonly FounderProfitWaterfallBlocker[]
}

const BASE_DISABLED_BLOCKERS: readonly FounderProfitWaterfallBlocker[] = [
  'profit_waterfall_execution_disabled',
  'payout_review_disabled',
]

const OBLIGATION_PRIORITY: Record<FounderProfitWaterfallObligationKind, number> = {
  founder_credit: 10,
  medical_debt: 20,
  lease_debt: 30,
  platform_fee: 40,
}

export function assessFounderProfitWaterfall(input: {
  founderCitizenId?: string | null
  periodBusinessProfit?: number | null
  obligations?: readonly FounderProfitWaterfallObligationInput[]
  serverAuthorityReady?: boolean
  manualProfitReviewApproved?: boolean
  taxRate?: number | null
  reviewedAt?: number | null
}): FounderProfitWaterfallAssessment {
  const founderCitizenId = normalizedText(input.founderCitizenId)
  const periodBusinessProfit = positiveMoney(input.periodBusinessProfit ?? 0)
  const taxRate = normalizedRate(input.taxRate ?? 0)
  const obligations = normalizedObligations(input.obligations ?? [])
  const hasInvalidCreditor = (input.obligations ?? []).some((obligation) =>
    positiveMoney(obligation.outstandingAmount) > 0 && !normalizedText(obligation.creditorAccountId)
  )

  const readinessBlockers: FounderProfitWaterfallBlocker[] = []
  if (!input.serverAuthorityReady) readinessBlockers.push('server_authority_required')
  if (!founderCitizenId) readinessBlockers.push('founder_identity_required')
  if (periodBusinessProfit <= 0) readinessBlockers.push('positive_profit_required')
  if (hasInvalidCreditor) readinessBlockers.push('obligation_creditor_required')
  if (!input.manualProfitReviewApproved) readinessBlockers.push('manual_profit_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_profit_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])
  const repaymentDrafts = readyForManualReview && founderCitizenId && periodBusinessProfit > 0 && !hasInvalidCreditor
    ? draftRepayments({
      founderCitizenId,
      obligations,
      profitAvailable: periodBusinessProfit,
      reviewedAt: normalizedInstant(input.reviewedAt ?? null),
      blockers,
    })
    : []
  const repaymentDrafted = sumMoney(repaymentDrafts.map((draft) => draft.amount))
  const totalOutstanding = sumMoney(obligations.map((obligation) => obligation.outstandingAmount))
  const surplusGameCredits = roundMoney(Math.max(0, periodBusinessProfit - repaymentDrafted))
  const taxAmount = roundMoney(surplusGameCredits * taxRate)

  return {
    enabled: false,
    executionEnabled: false,
    payoutReviewEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    founderCitizenId: founderCitizenId ?? '',
    periodBusinessProfit,
    taxRate,
    outstandingObligations: obligations,
    repaymentDrafts,
    totals: {
      profitAvailable: periodBusinessProfit,
      repaymentDrafted,
      remainingObligations: roundMoney(Math.max(0, totalOutstanding - repaymentDrafted)),
      surplusGameCredits,
      taxableSurplus: surplusGameCredits,
      taxAmount,
      netGameCredits: roundMoney(surplusGameCredits - taxAmount),
      payoutEligibleSurplus: 0,
    },
    readyForManualReview,
    blockers,
  }
}

function draftRepayments(input: {
  founderCitizenId: string
  obligations: readonly FounderProfitWaterfallObligation[]
  profitAvailable: number
  reviewedAt: number | null
  blockers: readonly FounderProfitWaterfallBlocker[]
}): FounderProfitRepaymentDraft[] {
  const drafts: FounderProfitRepaymentDraft[] = []
  let remainingProfit = input.profitAvailable
  for (const obligation of input.obligations) {
    if (remainingProfit <= 0) break
    const amount = roundMoney(Math.min(remainingProfit, obligation.outstandingAmount))
    if (amount <= 0) continue
    drafts.push({
      kind: 'founder_profit_repayment',
      executionEnabled: false,
      payoutReviewEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      payerCitizenId: input.founderCitizenId,
      receiverAccountId: obligation.creditorAccountId,
      obligationId: obligation.id,
      obligationKind: obligation.kind,
      amount,
      reviewedAt: input.reviewedAt,
      blockers: input.blockers,
    })
    remainingProfit = roundMoney(remainingProfit - amount)
  }
  return drafts
}

function normalizedObligations(
  obligations: readonly FounderProfitWaterfallObligationInput[],
): FounderProfitWaterfallObligation[] {
  return obligations
    .map((obligation) => {
      const id = normalizedText(obligation.id)
      const creditorAccountId = normalizedText(obligation.creditorAccountId)
      const outstandingAmount = positiveMoney(obligation.outstandingAmount)
      if (!id || !creditorAccountId || outstandingAmount <= 0) return null
      return {
        id,
        kind: obligation.kind,
        creditorAccountId,
        outstandingAmount,
        priority: OBLIGATION_PRIORITY[obligation.kind],
      }
    })
    .filter((obligation): obligation is FounderProfitWaterfallObligation => obligation !== null)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
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

function normalizedRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(1, roundMoney(value))
}

function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

function uniqueBlockers(blockers: readonly FounderProfitWaterfallBlocker[]): FounderProfitWaterfallBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
