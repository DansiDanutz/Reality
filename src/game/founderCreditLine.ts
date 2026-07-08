export type FounderCreditLineBlocker =
  | 'credit_issuance_disabled'
  | 'automatic_credit_disabled'
  | 'server_authority_required'
  | 'founder_identity_required'
  | 'positive_request_required'
  | 'activity_required'
  | 'usefulness_required'
  | 'debt_review_required'
  | 'hospitalization_review_required'
  | 'credit_limit_exceeded'
  | 'manual_credit_review_required'

export interface FounderCreditLinePolicyInput {
  founderCitizenId: string
  requestedDailyCredit?: number | null
  activityScore?: number | null
  daysActiveInWindow?: number | null
  demandServed?: number | null
  businessesBuilt?: number | null
  staffedBusinessCount?: number | null
  outstandingFounderDebt?: number | null
  hospitalized?: boolean
  serverAuthorityReady?: boolean
  manualCreditApproved?: boolean
  reviewedAt?: number | null
}

export interface FounderCreditLineDraft {
  kind: 'founder_credit_line_draw'
  executionEnabled: false
  automaticCreditEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  payerAccountId: typeof FOUNDER_CREDIT_BANK_ACCOUNT_ID
  receiverCitizenId: string
  amount: number
  dailyCreditLimit: number
  repaymentPriority: 'repay_before_real_payout'
  reviewedAt: number | null
  blockers: readonly FounderCreditLineBlocker[]
}

export interface FounderCreditLinePolicyAssessment {
  enabled: false
  automaticCreditEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  founderCitizenId: string
  requestedDailyCredit: number
  activityScore: number
  daysActiveInWindow: number
  demandServed: number
  businessesBuilt: number
  staffedBusinessCount: number
  outstandingFounderDebt: number
  hospitalized: boolean
  activityCaptured: boolean
  usefulActivityCaptured: boolean
  dailyCreditLimit: number
  readyForManualReview: boolean
  draft: FounderCreditLineDraft | null
  blockers: readonly FounderCreditLineBlocker[]
}

export const FOUNDER_CREDIT_BANK_ACCOUNT_ID = 'system:founder-credit-bank'
export const BASE_FOUNDER_DAILY_CREDIT_LIMIT = 500
export const MAX_FOUNDER_DAILY_CREDIT_LIMIT = 5_000

const BASE_DISABLED_BLOCKERS: readonly FounderCreditLineBlocker[] = [
  'credit_issuance_disabled',
  'automatic_credit_disabled',
]

export function assessFounderCreditLinePolicy(
  input: FounderCreditLinePolicyInput,
): FounderCreditLinePolicyAssessment {
  const founderCitizenId = input.founderCitizenId.trim()
  const requestedDailyCredit = positiveMoney(input.requestedDailyCredit ?? 0)
  const activityScore = normalizedScore(input.activityScore ?? 0)
  const daysActiveInWindow = normalizedCount(input.daysActiveInWindow ?? 0)
  const demandServed = normalizedCount(input.demandServed ?? 0)
  const businessesBuilt = normalizedCount(input.businessesBuilt ?? 0)
  const staffedBusinessCount = normalizedCount(input.staffedBusinessCount ?? 0)
  const outstandingFounderDebt = positiveMoney(input.outstandingFounderDebt ?? 0)
  const hospitalized = input.hospitalized === true
  const manualCreditApproved = input.manualCreditApproved === true

  const activityCaptured = activityScore >= 50 || daysActiveInWindow >= 3 || businessesBuilt > 0
  const usefulActivityCaptured = demandServed > 0 || staffedBusinessCount > 0
  const dailyCreditLimit = calculateDailyCreditLimit({
    activityCaptured,
    usefulActivityCaptured,
    activityScore,
    daysActiveInWindow,
    demandServed,
    businessesBuilt,
    staffedBusinessCount,
  })

  const readinessBlockers: FounderCreditLineBlocker[] = []
  if (!input.serverAuthorityReady) readinessBlockers.push('server_authority_required')
  if (!founderCitizenId) readinessBlockers.push('founder_identity_required')
  if (requestedDailyCredit <= 0) readinessBlockers.push('positive_request_required')
  if (!activityCaptured) readinessBlockers.push('activity_required')
  if (!usefulActivityCaptured) readinessBlockers.push('usefulness_required')
  if (outstandingFounderDebt > 0) readinessBlockers.push('debt_review_required')
  if (hospitalized) readinessBlockers.push('hospitalization_review_required')
  if (requestedDailyCredit > dailyCreditLimit) readinessBlockers.push('credit_limit_exceeded')
  if (!manualCreditApproved) readinessBlockers.push('manual_credit_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_credit_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    automaticCreditEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    founderCitizenId,
    requestedDailyCredit,
    activityScore,
    daysActiveInWindow,
    demandServed,
    businessesBuilt,
    staffedBusinessCount,
    outstandingFounderDebt,
    hospitalized,
    activityCaptured,
    usefulActivityCaptured,
    dailyCreditLimit,
    readyForManualReview,
    draft: readyForManualReview && founderCitizenId
      ? founderCreditLineDraft({
        founderCitizenId,
        requestedDailyCredit,
        dailyCreditLimit,
        reviewedAt: normalizedInstant(input.reviewedAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function founderCreditLineDraft(input: {
  founderCitizenId: string
  requestedDailyCredit: number
  dailyCreditLimit: number
  reviewedAt: number | null
  blockers: readonly FounderCreditLineBlocker[]
}): FounderCreditLineDraft {
  return {
    kind: 'founder_credit_line_draw',
    executionEnabled: false,
    automaticCreditEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    payerAccountId: FOUNDER_CREDIT_BANK_ACCOUNT_ID,
    receiverCitizenId: input.founderCitizenId,
    amount: input.requestedDailyCredit,
    dailyCreditLimit: input.dailyCreditLimit,
    repaymentPriority: 'repay_before_real_payout',
    reviewedAt: input.reviewedAt,
    blockers: input.blockers,
  }
}

function calculateDailyCreditLimit(input: {
  activityCaptured: boolean
  usefulActivityCaptured: boolean
  activityScore: number
  daysActiveInWindow: number
  demandServed: number
  businessesBuilt: number
  staffedBusinessCount: number
}): number {
  if (!input.activityCaptured || !input.usefulActivityCaptured) return 0
  const activityComponent = input.activityScore * 35
  const consistencyComponent = Math.min(input.daysActiveInWindow, 7) * 100
  const demandComponent = Math.min(input.demandServed, 20) * 25
  const buildingComponent = Math.min(input.businessesBuilt, 4) * 75
  const staffingComponent = Math.min(input.staffedBusinessCount, 4) * 75
  return roundMoney(Math.min(
    MAX_FOUNDER_DAILY_CREDIT_LIMIT,
    BASE_FOUNDER_DAILY_CREDIT_LIMIT +
      activityComponent +
      consistencyComponent +
      demandComponent +
      buildingComponent +
      staffingComponent,
  ))
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function normalizedCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly FounderCreditLineBlocker[]): FounderCreditLineBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
