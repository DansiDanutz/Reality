export const FOUNDER_STARTING_GAME_CREDIT = 200_000
export const REALITY_CREDIT_BANK_ACCOUNT_ID = 'system:founder-credit'
export const REALITY_TREASURY_ACCOUNT_ID = 'system:reality-treasury'

export type FounderCreditSettlementBlocker =
  | 'settlement_disabled'
  | 'compliance_review_required'
  | 'manual_review_required'
  | 'no_positive_earnings'

export interface FounderCreditSettlementInput {
  /** Game earnings being reviewed for founder upside. */
  grossEarnings: number
  /** Outstanding founder credit before this review. */
  outstandingCredit: number
  /** Platform/tax fee applied only after founder credit is repaid. */
  platformTaxRate: number
  /** Future gate; false keeps the result preview-only. */
  settlementEnabled?: boolean
}

export interface FounderCreditSettlementWaterfall {
  grossEarnings: number
  outstandingCreditBefore: number
  creditRepaymentDue: number
  outstandingCreditAfter: number
  taxableEarnings: number
  platformTaxDue: number
  founderNetEarnings: number
  settlementEnabled: boolean
  executable: false
  manualReviewRequired: true
  blockers: FounderCreditSettlementBlocker[]
  accounts: {
    creditBank: typeof REALITY_CREDIT_BANK_ACCOUNT_ID
    treasury: typeof REALITY_TREASURY_ACCOUNT_ID
  }
}

export type FounderCreditIncreaseBlocker =
  | 'manual_review_required'
  | 'invalid_request'
  | 'inactive_founder'
  | 'low_useful_activity'
  | 'no_visible_building'
  | 'understaffed_operations'
  | 'outstanding_credit'
  | 'hospitalized'
  | 'indebted'

export interface FounderCreditIncreaseReviewInput {
  requestedCredit: number
  maxManualCredit: number
  currentOutstandingCredit: number
  active: boolean
  usefulActivityScore: number
  minimumUsefulActivityScore?: number
  building: boolean
  staffed: boolean
  hospitalized: boolean
  indebted: boolean
}

export interface FounderCreditIncreaseReview {
  requestedCredit: number
  reviewableCredit: number
  maxManualCredit: number
  automaticIncreaseAllowed: false
  manualReviewRequired: true
  blockers: FounderCreditIncreaseBlocker[]
  signals: {
    active: boolean
    usefulActivityScore: number
    minimumUsefulActivityScore: number
    building: boolean
    staffed: boolean
    outstandingCredit: number
    hospitalized: boolean
    indebted: boolean
  }
}

/**
 * Founder earnings waterfall. Founder credit is repaid first; only the
 * remainder can become taxable/net founder upside. This never executes money
 * movement because real settlement and payouts remain disabled.
 */
export function founderCreditSettlementWaterfall(
  input: FounderCreditSettlementInput,
): FounderCreditSettlementWaterfall {
  const grossEarnings = nonNegativeMoney(input.grossEarnings, 'grossEarnings')
  const outstandingCredit = nonNegativeMoney(input.outstandingCredit, 'outstandingCredit')
  const platformTaxRate = taxRate(input.platformTaxRate)
  const creditRepaymentDue = roundMoney(Math.min(grossEarnings, outstandingCredit))
  const outstandingCreditAfter = roundMoney(outstandingCredit - creditRepaymentDue)
  const taxableEarnings = roundMoney(grossEarnings - creditRepaymentDue)
  const platformTaxDue = roundMoney(taxableEarnings * platformTaxRate)
  const founderNetEarnings = roundMoney(taxableEarnings - platformTaxDue)
  const settlementEnabled = input.settlementEnabled === true
  const blockers: FounderCreditSettlementBlocker[] = ['manual_review_required']

  if (!settlementEnabled) {
    blockers.unshift('settlement_disabled', 'compliance_review_required')
  }
  if (grossEarnings <= 0) blockers.push('no_positive_earnings')

  return {
    grossEarnings,
    outstandingCreditBefore: outstandingCredit,
    creditRepaymentDue,
    outstandingCreditAfter,
    taxableEarnings,
    platformTaxDue,
    founderNetEarnings,
    settlementEnabled,
    executable: false,
    manualReviewRequired: true,
    blockers,
    accounts: {
      creditBank: REALITY_CREDIT_BANK_ACCOUNT_ID,
      treasury: REALITY_TREASURY_ACCOUNT_ID,
    },
  }
}

/**
 * Manual-only credit increase review. Strong activity can make a request
 * reviewable, but the function never approves more credit automatically.
 */
export function founderCreditIncreaseReview(
  input: FounderCreditIncreaseReviewInput,
): FounderCreditIncreaseReview {
  const requestedCredit = nonNegativeMoney(input.requestedCredit, 'requestedCredit')
  const maxManualCredit = nonNegativeMoney(input.maxManualCredit, 'maxManualCredit')
  const currentOutstandingCredit = nonNegativeMoney(input.currentOutstandingCredit, 'currentOutstandingCredit')
  const usefulActivityScore = boundedRatio(input.usefulActivityScore, 'usefulActivityScore')
  const minimumUsefulActivityScore = boundedRatio(input.minimumUsefulActivityScore ?? 0.6, 'minimumUsefulActivityScore')
  const blockers: FounderCreditIncreaseBlocker[] = ['manual_review_required']

  if (requestedCredit <= 0) blockers.push('invalid_request')
  if (!input.active) blockers.push('inactive_founder')
  if (usefulActivityScore < minimumUsefulActivityScore) blockers.push('low_useful_activity')
  if (!input.building) blockers.push('no_visible_building')
  if (!input.staffed) blockers.push('understaffed_operations')
  if (currentOutstandingCredit > 0) blockers.push('outstanding_credit')
  if (input.hospitalized) blockers.push('hospitalized')
  if (input.indebted) blockers.push('indebted')

  return {
    requestedCredit,
    reviewableCredit: roundMoney(Math.min(requestedCredit, maxManualCredit)),
    maxManualCredit,
    automaticIncreaseAllowed: false,
    manualReviewRequired: true,
    blockers,
    signals: {
      active: input.active,
      usefulActivityScore,
      minimumUsefulActivityScore,
      building: input.building,
      staffed: input.staffed,
      outstandingCredit: currentOutstandingCredit,
      hospitalized: input.hospitalized,
      indebted: input.indebted,
    },
  }
}

function nonNegativeMoney(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a finite non-negative amount`)
  }
  return roundMoney(value)
}

function taxRate(value: number): number {
  return boundedRatio(value, 'platformTaxRate')
}

function boundedRatio(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`)
  }
  return value
}

function roundMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}
