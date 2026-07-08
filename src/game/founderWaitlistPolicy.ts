export type FounderWaitlistStatus = 'queue_entry' | 'invalid_entry'

export type FounderWaitlistBlocker =
  | 'founder_seat_purchase_disabled'
  | 'paid_priority_disabled'
  | 'crypto_waitlist_payment_disabled'
  | 'automatic_promotion_disabled'
  | 'automatic_replacement_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_review_required'
  | 'contact_hash_required'
  | 'valid_joined_at_required'
  | 'valid_queue_position_required'

export interface FounderWaitlistPolicyInput {
  contactHash?: string | null
  joinedAt?: number | null
  queuePosition?: number | null
  telegramUserId?: string | null
}

export interface FounderWaitlistQueueRecord {
  kind: 'founder_waitlist_queue_record'
  queueOnly: true
  contactHash: string
  joinedAt: number
  queuePosition: number | null
  telegramUserId: string | null
  manualReviewReady: boolean
  founderSeatPurchaseEnabled: false
  paidPriorityEnabled: false
  cryptoPaymentEnabled: false
  automaticPromotionEnabled: false
  automaticReplacementEnabled: false
  waitlistHandoffEnabled: false
  blockers: readonly FounderWaitlistBlocker[]
}

export interface FounderWaitlistPolicyAssessment {
  sourceOfTruth: 'server_waitlist'
  publicPurpose: 'founder_launch_and_manual_replacement_interest'
  contactStorage: 'hashed_email_record'
  queueOnly: true
  founderSeatPurchaseEnabled: false
  paidPriorityEnabled: false
  realMoneyPaymentEnabled: false
  cryptoPaymentEnabled: false
  automaticPromotionEnabled: false
  automaticReplacementEnabled: false
  waitlistHandoffEnabled: false
  manualReviewRequired: true
  contactHash: string | null
  joinedAt: number | null
  queuePosition: number | null
  telegramUserId: string | null
  status: FounderWaitlistStatus
  readyForManualReview: boolean
  queueRecord: FounderWaitlistQueueRecord | null
  blockers: readonly FounderWaitlistBlocker[]
}

const WAITLIST_HASH_RE = /^[a-f0-9]{32}$/i

const BASE_BLOCKERS: readonly FounderWaitlistBlocker[] = [
  'founder_seat_purchase_disabled',
  'paid_priority_disabled',
  'crypto_waitlist_payment_disabled',
  'automatic_promotion_disabled',
  'automatic_replacement_disabled',
  'waitlist_handoff_disabled',
  'manual_review_required',
]

export function assessFounderWaitlistPolicy(
  input: FounderWaitlistPolicyInput = {},
): FounderWaitlistPolicyAssessment {
  const contactHash = normalizeContactHash(input.contactHash)
  const joinedAt = normalizeTimestamp(input.joinedAt)
  const queuePosition = normalizeQueuePosition(input.queuePosition)
  const telegramUserId = normalizeText(input.telegramUserId) || null
  const readinessBlockers = founderWaitlistReadinessBlockers({
    contactHash,
    joinedAt,
    queuePosition,
    rawQueuePosition: input.queuePosition,
  })
  const blockers = uniqueBlockers([...BASE_BLOCKERS, ...readinessBlockers])
  const readyForManualReview = readinessBlockers.length === 0

  return {
    sourceOfTruth: 'server_waitlist',
    publicPurpose: 'founder_launch_and_manual_replacement_interest',
    contactStorage: 'hashed_email_record',
    queueOnly: true,
    founderSeatPurchaseEnabled: false,
    paidPriorityEnabled: false,
    realMoneyPaymentEnabled: false,
    cryptoPaymentEnabled: false,
    automaticPromotionEnabled: false,
    automaticReplacementEnabled: false,
    waitlistHandoffEnabled: false,
    manualReviewRequired: true,
    contactHash,
    joinedAt,
    queuePosition,
    telegramUserId,
    status: readyForManualReview ? 'queue_entry' : 'invalid_entry',
    readyForManualReview,
    queueRecord: readyForManualReview
      ? founderWaitlistQueueRecord({
        contactHash: contactHash!,
        joinedAt: joinedAt!,
        queuePosition,
        telegramUserId,
        blockers,
      })
      : null,
    blockers,
  }
}

function founderWaitlistQueueRecord(input: {
  contactHash: string
  joinedAt: number
  queuePosition: number | null
  telegramUserId: string | null
  blockers: readonly FounderWaitlistBlocker[]
}): FounderWaitlistQueueRecord {
  return {
    kind: 'founder_waitlist_queue_record',
    queueOnly: true,
    contactHash: input.contactHash,
    joinedAt: input.joinedAt,
    queuePosition: input.queuePosition,
    telegramUserId: input.telegramUserId,
    manualReviewReady: true,
    founderSeatPurchaseEnabled: false,
    paidPriorityEnabled: false,
    cryptoPaymentEnabled: false,
    automaticPromotionEnabled: false,
    automaticReplacementEnabled: false,
    waitlistHandoffEnabled: false,
    blockers: input.blockers,
  }
}

function founderWaitlistReadinessBlockers(input: {
  contactHash: string | null
  joinedAt: number | null
  queuePosition: number | null
  rawQueuePosition: number | null | undefined
}): FounderWaitlistBlocker[] {
  const blockers: FounderWaitlistBlocker[] = []
  if (!input.contactHash) blockers.push('contact_hash_required')
  if (input.joinedAt === null) blockers.push('valid_joined_at_required')
  if (input.rawQueuePosition !== undefined && input.rawQueuePosition !== null && input.queuePosition === null) {
    blockers.push('valid_queue_position_required')
  }
  return blockers
}

function normalizeContactHash(value: string | null | undefined): string | null {
  const normalized = normalizeText(value).toLowerCase()
  return WAITLIST_HASH_RE.test(normalized) ? normalized : null
}

function normalizeTimestamp(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null
  return value
}

function normalizeQueuePosition(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null
  return value
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueBlockers(blockers: readonly FounderWaitlistBlocker[]): FounderWaitlistBlocker[] {
  return [...new Set(blockers)]
}
