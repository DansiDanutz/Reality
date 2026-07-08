import { describe, expect, test } from 'vitest'
import {
  FOUNDER_SEAT_CAPACITY,
  FOUNDER_STARTER_CREDIT_AMOUNT,
  REGULAR_CITIZEN_STARTER_CREDIT_AMOUNT,
  assessFounderSeatPolicy,
} from './founderSeatPolicy'

describe('founder seat policy', () => {
  test('keeps founder seats free but blocked without identity and registry state', () => {
    const assessment = assessFounderSeatPolicy()

    expect(assessment).toMatchObject({
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
      founderCitizenId: '',
      claimedSeats: null,
      slotsRemaining: 0,
      nextFounderNumber: null,
      waitlistSize: 0,
      status: 'invalid_registry_state',
      readyForFreeSeatClaim: false,
      claimDraft: null,
    })
    expect(assessment.blockers).toEqual([
      'founder_seat_purchase_disabled',
      'crypto_founder_seat_payment_disabled',
      'founder_seat_resale_disabled',
      'automatic_replacement_disabled',
      'waitlist_handoff_disabled',
      'manual_review_required',
      'founder_identity_required',
      'valid_claimed_count_required',
    ])
  })

  test('drafts a free founder seat claim only when capacity and identity are valid', () => {
    const assessment = assessFounderSeatPolicy({
      founderCitizenId: ' citizen-13 ',
      claimedSeats: 12,
      waitlistSize: 7,
    })

    expect(assessment.status).toBe('available')
    expect(assessment.claimedSeats).toBe(12)
    expect(assessment.slotsRemaining).toBe(1_988)
    expect(assessment.nextFounderNumber).toBe(13)
    expect(assessment.waitlistSize).toBe(7)
    expect(assessment.readyForFreeSeatClaim).toBe(true)
    expect(assessment.blockers).toEqual([
      'founder_seat_purchase_disabled',
      'crypto_founder_seat_payment_disabled',
      'founder_seat_resale_disabled',
      'automatic_replacement_disabled',
      'waitlist_handoff_disabled',
      'manual_review_required',
    ])
    expect(assessment.claimDraft).toEqual({
      kind: 'founder_seat_claim',
      executionEnabled: false,
      registryWriteRequired: true,
      seatPrice: 0,
      realMoneyPaymentEnabled: false,
      cryptoPaymentEnabled: false,
      founderCitizenId: 'citizen-13',
      founderNumber: 13,
      starterCreditAmount: FOUNDER_STARTER_CREDIT_AMOUNT,
      starterCreditCurrency: 'game_credits',
      starterCreditLedgerExecutionEnabled: false,
      covenantReviewRequired: true,
      blockers: [
        'founder_seat_purchase_disabled',
        'crypto_founder_seat_payment_disabled',
        'founder_seat_resale_disabled',
        'automatic_replacement_disabled',
        'waitlist_handoff_disabled',
        'manual_review_required',
      ],
    })
  })

  test('does not draft a founder claim after the 2,000 seats are full', () => {
    const assessment = assessFounderSeatPolicy({
      founderCitizenId: 'citizen-waiting',
      claimedSeats: FOUNDER_SEAT_CAPACITY,
      waitlistSize: 25,
    })

    expect(assessment.status).toBe('full')
    expect(assessment.slotsRemaining).toBe(0)
    expect(assessment.nextFounderNumber).toBeNull()
    expect(assessment.waitlistSize).toBe(25)
    expect(assessment.readyForFreeSeatClaim).toBe(false)
    expect(assessment.claimDraft).toBeNull()
    expect(assessment.blockers).toContain('capacity_available_required')
    expect(assessment.founderSeatPurchaseEnabled).toBe(false)
    expect(assessment.cryptoFounderSeatPaymentEnabled).toBe(false)
    expect(assessment.waitlistHandoffEnabled).toBe(false)
  })

  test('rejects impossible registry counts before calculating the next founder number', () => {
    for (const claimedSeats of [-1, 1.5, Number.NaN, FOUNDER_SEAT_CAPACITY + 1]) {
      const assessment = assessFounderSeatPolicy({
        founderCitizenId: 'citizen-1',
        claimedSeats,
      })

      expect(assessment.status).toBe('invalid_registry_state')
      expect(assessment.claimedSeats).toBeNull()
      expect(assessment.slotsRemaining).toBe(0)
      expect(assessment.nextFounderNumber).toBeNull()
      expect(assessment.readyForFreeSeatClaim).toBe(false)
      expect(assessment.claimDraft).toBeNull()
      expect(assessment.blockers).toContain('valid_claimed_count_required')
    }
  })

  test('normalizes waitlist size without enabling replacement or resale', () => {
    const assessment = assessFounderSeatPolicy({
      founderCitizenId: 'citizen-1',
      claimedSeats: 0,
      waitlistSize: -10,
    })

    expect(assessment.waitlistSize).toBe(0)
    expect(assessment.readyForFreeSeatClaim).toBe(true)
    expect(assessment.claimDraft).toMatchObject({
      founderNumber: 1,
      seatPrice: 0,
      realMoneyPaymentEnabled: false,
      cryptoPaymentEnabled: false,
      starterCreditLedgerExecutionEnabled: false,
    })
    expect(assessment.founderSeatResaleEnabled).toBe(false)
    expect(assessment.automaticRemovalEnabled).toBe(false)
    expect(assessment.automaticReplacementEnabled).toBe(false)
    expect(assessment.waitlistHandoffEnabled).toBe(false)
  })
})
