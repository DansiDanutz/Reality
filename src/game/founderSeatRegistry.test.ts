import { describe, expect, test } from 'vitest'
import {
  FOUNDER_SEAT_BANK_ACCOUNT_ID,
  FOUNDER_SEAT_LIMIT,
  FOUNDER_SEAT_STARTER_CREDIT,
  founderSeatReplacementPolicy,
  grantFounderSeat,
  summarizeFounderSeatRegistry,
  type FounderSeatRecord,
} from './founderSeatRegistry'

const seat = (seatNumber: number, over: Partial<FounderSeatRecord> = {}): FounderSeatRecord => ({
  seatNumber,
  founderId: `founder-${seatNumber}`,
  telegramUserId: `telegram-${seatNumber}`,
  areaId: `area-${seatNumber}`,
  status: 'active',
  grantedAt: 1000 + seatNumber,
  approvedById: 'david',
  ...over,
})

describe('founder seat registry', () => {
  test('summarizes issued seats without reopening removed seats automatically', () => {
    const registry = summarizeFounderSeatRegistry([
      seat(1),
      seat(2, { status: 'warning' }),
      seat(3, { status: 'probation' }),
      seat(4, { status: 'removed' }),
      seat(5, { status: 'replacement_pending' }),
    ])

    expect(registry).toMatchObject({
      seatLimit: FOUNDER_SEAT_LIMIT,
      issuedSeatCount: 5,
      occupiedSeatCount: 4,
      activeSeatCount: 1,
      warningSeatCount: 1,
      probationSeatCount: 1,
      removedSeatCount: 1,
      replacementPendingSeatCount: 1,
      nextSeatNumber: 6,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      automaticRemovalEnabled: false,
    })
  })

  test('grants an approved founder seat with game-only starter operating credit', () => {
    const result = grantFounderSeat({
      existingSeats: [],
      founderId: ' founder-a ',
      telegramUserId: ' 123456 ',
      areaId: ' bucharest-sector-1 ',
      requestedAt: 1783306800000,
      approvedById: 'david',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected approved founder seat grant')
    expect(result.seat).toEqual({
      seatNumber: 1,
      founderId: 'founder-a',
      telegramUserId: '123456',
      areaId: 'bucharest-sector-1',
      status: 'active',
      grantedAt: 1783306800000,
      approvedById: 'david',
    })
    expect(result.starterCredit).toEqual({
      id: 'founder-seat-0001:1783306800000:starter-credit',
      at: 1783306800000,
      kind: 'founder_starter_credit',
      currency: 'game_usd',
      payoutEligibility: 'game_only',
      realWithdrawalEligible: false,
      settlementRail: 'internal_ledger',
      settlementEnabled: false,
      fromId: FOUNDER_SEAT_BANK_ACCOUNT_ID,
      toFounderId: 'founder-a',
      amount: FOUNDER_SEAT_STARTER_CREDIT,
      memo: 'Founder #0001 starter operating credit.',
    })
    expect(result.registry).toMatchObject({
      issuedSeatCount: 1,
      occupiedSeatCount: 1,
      availableNewSeatCount: FOUNDER_SEAT_LIMIT - 1,
      nextSeatNumber: 2,
    })
  })

  test('requires manual main-founder approval before issuing a free founder seat', () => {
    const result = grantFounderSeat({
      existingSeats: [],
      founderId: 'founder-a',
      requestedAt: 1783306800000,
      approvedById: null,
    })

    expect(result).toMatchObject({
      ok: false,
      seat: null,
      starterCredit: null,
      manualGate: {
        requiredRole: 'main_founder',
        approvedById: null,
        approvalRequired: true,
        automationEnabled: false,
        executionEnabled: false,
      },
      blockers: ['manual_approval_required'],
      waitlistRecommended: false,
    })
  })

  test('blocks duplicate founder identities, Telegram accounts, and claimed areas', () => {
    const existingSeats = [seat(1, {
      founderId: 'founder-a',
      telegramUserId: 'telegram-a',
      areaId: 'area-a',
    })]

    expect(grantFounderSeat({
      existingSeats,
      founderId: 'founder-a',
      requestedAt: 2,
      approvedById: 'david',
    })).toMatchObject({ ok: false, blockers: ['duplicate_founder'] })

    expect(grantFounderSeat({
      existingSeats,
      founderId: 'founder-b',
      telegramUserId: ' telegram-a ',
      requestedAt: 2,
      approvedById: 'david',
    })).toMatchObject({ ok: false, blockers: ['duplicate_telegram_user'] })

    expect(grantFounderSeat({
      existingSeats,
      founderId: 'founder-c',
      areaId: ' area-a ',
      requestedAt: 2,
      approvedById: 'david',
    })).toMatchObject({ ok: false, blockers: ['duplicate_area'] })
  })

  test('routes a full registry to the waitlist instead of minting seat 2001', () => {
    const existingSeats = Array.from({ length: FOUNDER_SEAT_LIMIT }, (_, index) => seat(index + 1))
    const result = grantFounderSeat({
      existingSeats,
      founderId: 'founder-2001',
      telegramUserId: 'telegram-2001',
      requestedAt: 3,
      approvedById: 'david',
    })

    expect(result).toMatchObject({
      ok: false,
      seat: null,
      starterCredit: null,
      blockers: ['seat_cap_reached'],
      waitlistRecommended: true,
      registry: {
        issuedSeatCount: FOUNDER_SEAT_LIMIT,
        availableNewSeatCount: 0,
        nextSeatNumber: null,
        atCapacity: true,
      },
    })
  })

  test('keeps replacement and waitlist handoff manual and disabled', () => {
    expect(founderSeatReplacementPolicy({
      seatNumber: 12,
      removedFounderId: 'founder-old',
      successorFounderId: 'founder-new',
      approvedById: 'david',
    })).toEqual({
      seatNumber: 12,
      removedFounderId: 'founder-old',
      successorFounderId: 'founder-new',
      manualOnly: true,
      replacementEnabled: false,
      waitlistHandoffEnabled: false,
      automaticRemovalEnabled: false,
      requiresMainFounderApproval: true,
      approvedById: 'david',
      executionEnabled: false,
      blockers: ['replacement_disabled', 'waitlist_handoff_disabled', 'manual_approval_required'],
    })
  })
})
