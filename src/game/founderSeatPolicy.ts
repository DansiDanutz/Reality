export type FounderSeatPolicyStatus = 'available' | 'full' | 'invalid_registry_state'

export type FounderSeatPolicyBlocker =
  | 'founder_seat_purchase_disabled'
  | 'crypto_founder_seat_payment_disabled'
  | 'founder_seat_resale_disabled'
  | 'automatic_replacement_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_review_required'
  | 'founder_identity_required'
  | 'valid_claimed_count_required'
  | 'capacity_available_required'

export interface FounderSeatPolicyInput {
  founderCitizenId?: string | null
  claimedSeats?: number | null
  waitlistSize?: number | null
}

export interface FounderSeatClaimDraft {
  kind: 'founder_seat_claim'
  executionEnabled: false
  registryWriteRequired: true
  seatPrice: 0
  realMoneyPaymentEnabled: false
  cryptoPaymentEnabled: false
  founderCitizenId: string
  founderNumber: number
  starterCreditAmount: 200_000
  starterCreditCurrency: 'game_credits'
  starterCreditLedgerExecutionEnabled: false
  covenantReviewRequired: true
  blockers: readonly FounderSeatPolicyBlocker[]
}

export interface FounderSeatPolicyAssessment {
  sourceOfTruth: 'server_founder_registry'
  seatTotal: 2_000
  founderStarterCreditAmount: 200_000
  regularCitizenStarterCreditAmount: 2_500
  starterCreditCurrency: 'game_credits'
  founderSeatsFree: true
  founderSeatPurchaseEnabled: false
  realMoneyFounderSeatPaymentEnabled: false
  cryptoFounderSeatPaymentEnabled: false
  founderSeatResaleEnabled: false
  automaticRemovalEnabled: false
  automaticReplacementEnabled: false
  waitlistHandoffEnabled: false
  manualReviewRequired: true
  founderCitizenId: string
  claimedSeats: number | null
  slotsRemaining: number
  nextFounderNumber: number | null
  waitlistSize: number
  status: FounderSeatPolicyStatus
  readyForFreeSeatClaim: boolean
  claimDraft: FounderSeatClaimDraft | null
  blockers: readonly FounderSeatPolicyBlocker[]
}

export const FOUNDER_SEAT_CAPACITY = 2_000
export const FOUNDER_STARTER_CREDIT_AMOUNT = 200_000
export const REGULAR_CITIZEN_STARTER_CREDIT_AMOUNT = 2_500

const BASE_BLOCKERS: readonly FounderSeatPolicyBlocker[] = [
  'founder_seat_purchase_disabled',
  'crypto_founder_seat_payment_disabled',
  'founder_seat_resale_disabled',
  'automatic_replacement_disabled',
  'waitlist_handoff_disabled',
  'manual_review_required',
]

export function assessFounderSeatPolicy(input: FounderSeatPolicyInput = {}): FounderSeatPolicyAssessment {
  const founderCitizenId = input.founderCitizenId?.trim() ?? ''
  const claimedSeats = normalizeClaimedSeats(input.claimedSeats)
  const waitlistSize = normalizeCount(input.waitlistSize)
  const validRegistryState = claimedSeats !== null
  const slotsRemaining = validRegistryState ? Math.max(0, FOUNDER_SEAT_CAPACITY - claimedSeats) : 0
  const nextFounderNumber = validRegistryState && slotsRemaining > 0 ? claimedSeats + 1 : null
  const status = founderSeatStatus({ validRegistryState, slotsRemaining })
  const readinessBlockers = founderSeatReadinessBlockers({
    founderCitizenId,
    validRegistryState,
    slotsRemaining,
  })
  const blockers = uniqueBlockers([...BASE_BLOCKERS, ...readinessBlockers])
  const readyForFreeSeatClaim = readinessBlockers.length === 0

  return {
    sourceOfTruth: 'server_founder_registry',
    seatTotal: FOUNDER_SEAT_CAPACITY,
    founderStarterCreditAmount: FOUNDER_STARTER_CREDIT_AMOUNT,
    regularCitizenStarterCreditAmount: REGULAR_CITIZEN_STARTER_CREDIT_AMOUNT,
    starterCreditCurrency: 'game_credits',
    founderSeatsFree: true,
    founderSeatPurchaseEnabled: false,
    realMoneyFounderSeatPaymentEnabled: false,
    cryptoFounderSeatPaymentEnabled: false,
    founderSeatResaleEnabled: false,
    automaticRemovalEnabled: false,
    automaticReplacementEnabled: false,
    waitlistHandoffEnabled: false,
    manualReviewRequired: true,
    founderCitizenId,
    claimedSeats,
    slotsRemaining,
    nextFounderNumber,
    waitlistSize,
    status,
    readyForFreeSeatClaim,
    claimDraft: readyForFreeSeatClaim
      ? founderSeatClaimDraft({
        founderCitizenId,
        founderNumber: nextFounderNumber!,
        blockers,
      })
      : null,
    blockers,
  }
}

function founderSeatClaimDraft(input: {
  founderCitizenId: string
  founderNumber: number
  blockers: readonly FounderSeatPolicyBlocker[]
}): FounderSeatClaimDraft {
  return {
    kind: 'founder_seat_claim',
    executionEnabled: false,
    registryWriteRequired: true,
    seatPrice: 0,
    realMoneyPaymentEnabled: false,
    cryptoPaymentEnabled: false,
    founderCitizenId: input.founderCitizenId,
    founderNumber: input.founderNumber,
    starterCreditAmount: FOUNDER_STARTER_CREDIT_AMOUNT,
    starterCreditCurrency: 'game_credits',
    starterCreditLedgerExecutionEnabled: false,
    covenantReviewRequired: true,
    blockers: input.blockers,
  }
}

function founderSeatStatus(input: {
  validRegistryState: boolean
  slotsRemaining: number
}): FounderSeatPolicyStatus {
  if (!input.validRegistryState) return 'invalid_registry_state'
  return input.slotsRemaining > 0 ? 'available' : 'full'
}

function founderSeatReadinessBlockers(input: {
  founderCitizenId: string
  validRegistryState: boolean
  slotsRemaining: number
}): FounderSeatPolicyBlocker[] {
  const blockers: FounderSeatPolicyBlocker[] = []
  if (!input.founderCitizenId) blockers.push('founder_identity_required')
  if (!input.validRegistryState) blockers.push('valid_claimed_count_required')
  if (input.validRegistryState && input.slotsRemaining <= 0) blockers.push('capacity_available_required')
  return blockers
}

function normalizeClaimedSeats(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > FOUNDER_SEAT_CAPACITY) {
    return null
  }
  return value
}

function normalizeCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 0
  return value
}

function uniqueBlockers(blockers: readonly FounderSeatPolicyBlocker[]): FounderSeatPolicyBlocker[] {
  return [...new Set(blockers)]
}
