import { FOUNDER_BALANCE, FOUNDER_SLOTS } from './catalog'

export const FOUNDER_SEAT_LIMIT = FOUNDER_SLOTS
export const FOUNDER_SEAT_STARTER_CREDIT = FOUNDER_BALANCE
export const FOUNDER_SEAT_BANK_ACCOUNT_ID = 'reality-founder-bank'

export type FounderSeatStatus = 'active' | 'warning' | 'probation' | 'removed' | 'replacement_pending'
export type FounderSeatGrantBlocker =
  | 'manual_approval_required'
  | 'seat_cap_reached'
  | 'duplicate_founder'
  | 'duplicate_telegram_user'
  | 'duplicate_area'
  | 'invalid_founder'
  | 'invalid_grant_time'
export type FounderSeatReplacementBlocker =
  | 'replacement_disabled'
  | 'waitlist_handoff_disabled'
  | 'manual_approval_required'

export interface FounderSeatRecord {
  seatNumber: number
  founderId: string
  telegramUserId?: string
  areaId?: string
  status: FounderSeatStatus
  grantedAt: number
  approvedById: string
}

export interface FounderSeatRegistrySummary {
  seatLimit: number
  issuedSeatCount: number
  occupiedSeatCount: number
  availableNewSeatCount: number
  activeSeatCount: number
  warningSeatCount: number
  probationSeatCount: number
  removedSeatCount: number
  replacementPendingSeatCount: number
  nextSeatNumber: number | null
  atCapacity: boolean
  replacementEnabled: false
  waitlistHandoffEnabled: false
  automaticRemovalEnabled: false
}

export interface FounderSeatGrantInput {
  existingSeats: readonly FounderSeatRecord[]
  founderId: string
  telegramUserId?: string
  areaId?: string
  requestedAt: number
  approvedById?: string | null
}

export interface FounderSeatStarterCredit {
  id: string
  at: number
  kind: 'founder_starter_credit'
  currency: 'game_usd'
  payoutEligibility: 'game_only'
  realWithdrawalEligible: false
  settlementRail: 'internal_ledger'
  settlementEnabled: false
  fromId: typeof FOUNDER_SEAT_BANK_ACCOUNT_ID
  toFounderId: string
  amount: typeof FOUNDER_SEAT_STARTER_CREDIT
  memo: string
}

export interface FounderSeatManualGate {
  requiredRole: 'main_founder'
  approvedById: string | null
  approvalRequired: boolean
  automationEnabled: false
  executionEnabled: boolean
}

export type FounderSeatGrantResult =
  | {
    ok: true
    seat: FounderSeatRecord
    starterCredit: FounderSeatStarterCredit
    registry: FounderSeatRegistrySummary
    manualGate: FounderSeatManualGate
    blockers: readonly []
    waitlistRecommended: false
  }
  | {
    ok: false
    seat: null
    starterCredit: null
    registry: FounderSeatRegistrySummary
    manualGate: FounderSeatManualGate
    blockers: readonly FounderSeatGrantBlocker[]
    waitlistRecommended: boolean
  }

export interface FounderSeatReplacementPolicyInput {
  seatNumber: number
  removedFounderId: string
  successorFounderId: string
  approvedById?: string | null
}

export interface FounderSeatReplacementPolicy {
  seatNumber: number
  removedFounderId: string
  successorFounderId: string
  manualOnly: true
  replacementEnabled: false
  waitlistHandoffEnabled: false
  automaticRemovalEnabled: false
  requiresMainFounderApproval: true
  approvedById: string | null
  executionEnabled: false
  blockers: readonly FounderSeatReplacementBlocker[]
}

const OCCUPIED_STATUSES = new Set<FounderSeatStatus>(['active', 'warning', 'probation', 'replacement_pending'])

export function summarizeFounderSeatRegistry(
  seats: readonly FounderSeatRecord[],
  seatLimit = FOUNDER_SEAT_LIMIT,
): FounderSeatRegistrySummary {
  const issuedSeatNumbers = new Set<number>()
  let occupiedSeatCount = 0
  let activeSeatCount = 0
  let warningSeatCount = 0
  let probationSeatCount = 0
  let removedSeatCount = 0
  let replacementPendingSeatCount = 0

  for (const seat of seats) {
    if (isValidSeatNumber(seat.seatNumber, seatLimit)) issuedSeatNumbers.add(seat.seatNumber)
    if (OCCUPIED_STATUSES.has(seat.status)) occupiedSeatCount += 1
    if (seat.status === 'active') activeSeatCount += 1
    if (seat.status === 'warning') warningSeatCount += 1
    if (seat.status === 'probation') probationSeatCount += 1
    if (seat.status === 'removed') removedSeatCount += 1
    if (seat.status === 'replacement_pending') replacementPendingSeatCount += 1
  }

  const issuedSeatCount = issuedSeatNumbers.size
  const nextSeatNumber = nextAvailableSeatNumber(issuedSeatNumbers, seatLimit)
  const availableNewSeatCount = Math.max(0, seatLimit - issuedSeatCount)

  return {
    seatLimit,
    issuedSeatCount,
    occupiedSeatCount,
    availableNewSeatCount,
    activeSeatCount,
    warningSeatCount,
    probationSeatCount,
    removedSeatCount,
    replacementPendingSeatCount,
    nextSeatNumber,
    atCapacity: issuedSeatCount >= seatLimit,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    automaticRemovalEnabled: false,
  }
}

export function grantFounderSeat(input: FounderSeatGrantInput): FounderSeatGrantResult {
  const registry = summarizeFounderSeatRegistry(input.existingSeats)
  const manualGate = founderSeatManualGate(input.approvedById)
  const founderId = input.founderId.trim()
  const telegramUserId = cleanOptionalId(input.telegramUserId) ?? undefined
  const areaId = cleanOptionalId(input.areaId) ?? undefined
  const blockers: FounderSeatGrantBlocker[] = []

  if (!founderId) blockers.push('invalid_founder')
  if (!Number.isFinite(input.requestedAt) || input.requestedAt < 0) blockers.push('invalid_grant_time')
  if (!manualGate.executionEnabled) blockers.push('manual_approval_required')
  if (registry.nextSeatNumber === null) blockers.push('seat_cap_reached')
  if (input.existingSeats.some((seat) => seat.founderId === founderId)) blockers.push('duplicate_founder')
  if (telegramUserId && input.existingSeats.some((seat) => cleanOptionalId(seat.telegramUserId) === telegramUserId)) {
    blockers.push('duplicate_telegram_user')
  }
  if (areaId && input.existingSeats.some((seat) => cleanOptionalId(seat.areaId) === areaId)) {
    blockers.push('duplicate_area')
  }
  const approvedById = manualGate.approvedById

  if (blockers.length > 0 || registry.nextSeatNumber === null || approvedById === null) {
    return {
      ok: false,
      seat: null,
      starterCredit: null,
      registry,
      manualGate,
      blockers: uniqueBlockers(blockers),
      waitlistRecommended: blockers.includes('seat_cap_reached'),
    }
  }

  const seat: FounderSeatRecord = {
    seatNumber: registry.nextSeatNumber,
    founderId,
    telegramUserId,
    areaId,
    status: 'active',
    grantedAt: input.requestedAt,
    approvedById,
  }
  const starterCredit = founderSeatStarterCredit(seat)
  return {
    ok: true,
    seat,
    starterCredit,
    registry: summarizeFounderSeatRegistry([...input.existingSeats, seat]),
    manualGate,
    blockers: [],
    waitlistRecommended: false,
  }
}

export function founderSeatReplacementPolicy(
  input: FounderSeatReplacementPolicyInput,
): FounderSeatReplacementPolicy {
  return {
    seatNumber: input.seatNumber,
    removedFounderId: input.removedFounderId.trim(),
    successorFounderId: input.successorFounderId.trim(),
    manualOnly: true,
    replacementEnabled: false,
    waitlistHandoffEnabled: false,
    automaticRemovalEnabled: false,
    requiresMainFounderApproval: true,
    approvedById: cleanOptionalId(input.approvedById),
    executionEnabled: false,
    blockers: ['replacement_disabled', 'waitlist_handoff_disabled', 'manual_approval_required'],
  }
}

function founderSeatStarterCredit(seat: FounderSeatRecord): FounderSeatStarterCredit {
  const paddedSeat = String(seat.seatNumber).padStart(4, '0')
  return {
    id: `founder-seat-${paddedSeat}:${seat.grantedAt}:starter-credit`,
    at: seat.grantedAt,
    kind: 'founder_starter_credit',
    currency: 'game_usd',
    payoutEligibility: 'game_only',
    realWithdrawalEligible: false,
    settlementRail: 'internal_ledger',
    settlementEnabled: false,
    fromId: FOUNDER_SEAT_BANK_ACCOUNT_ID,
    toFounderId: seat.founderId,
    amount: FOUNDER_SEAT_STARTER_CREDIT,
    memo: `Founder #${paddedSeat} starter operating credit.`,
  }
}

function founderSeatManualGate(approvedById: string | null | undefined): FounderSeatManualGate {
  const approved = cleanOptionalId(approvedById)
  return {
    requiredRole: 'main_founder',
    approvedById: approved,
    approvalRequired: approved === null,
    automationEnabled: false,
    executionEnabled: approved !== null,
  }
}

function nextAvailableSeatNumber(issuedSeatNumbers: ReadonlySet<number>, seatLimit: number): number | null {
  for (let seatNumber = 1; seatNumber <= seatLimit; seatNumber += 1) {
    if (!issuedSeatNumbers.has(seatNumber)) return seatNumber
  }
  return null
}

function isValidSeatNumber(seatNumber: number, seatLimit: number): boolean {
  return Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= seatLimit
}

function cleanOptionalId(value: string | null | undefined): string | null {
  const clean = value?.trim()
  return clean ? clean : null
}

function uniqueBlockers(blockers: readonly FounderSeatGrantBlocker[]): readonly FounderSeatGrantBlocker[] {
  return [...new Set(blockers)]
}
