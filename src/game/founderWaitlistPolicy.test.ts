import { describe, expect, test } from 'vitest'
import { assessFounderWaitlistPolicy } from './founderWaitlistPolicy'

const CONTACT_HASH = 'abcdef0123456789abcdef0123456789'

describe('founder waitlist policy', () => {
  test('keeps the waitlist queue-only and disabled by default', () => {
    const assessment = assessFounderWaitlistPolicy()

    expect(assessment).toMatchObject({
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
      contactHash: null,
      joinedAt: null,
      queuePosition: null,
      telegramUserId: null,
      status: 'invalid_entry',
      readyForManualReview: false,
      queueRecord: null,
    })
    expect(assessment.blockers).toEqual([
      'founder_seat_purchase_disabled',
      'paid_priority_disabled',
      'crypto_waitlist_payment_disabled',
      'automatic_promotion_disabled',
      'automatic_replacement_disabled',
      'waitlist_handoff_disabled',
      'manual_review_required',
      'contact_hash_required',
      'valid_joined_at_required',
    ])
  })

  test('models a valid waitlist entry without enabling paid priority or promotion', () => {
    const assessment = assessFounderWaitlistPolicy({
      contactHash: ` ${CONTACT_HASH.toUpperCase()} `,
      joinedAt: 1_783_307_000_000,
      queuePosition: 42,
      telegramUserId: ' 42424242 ',
    })

    expect(assessment.status).toBe('queue_entry')
    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.contactHash).toBe(CONTACT_HASH)
    expect(assessment.joinedAt).toBe(1_783_307_000_000)
    expect(assessment.queuePosition).toBe(42)
    expect(assessment.telegramUserId).toBe('42424242')
    expect(assessment.blockers).toEqual([
      'founder_seat_purchase_disabled',
      'paid_priority_disabled',
      'crypto_waitlist_payment_disabled',
      'automatic_promotion_disabled',
      'automatic_replacement_disabled',
      'waitlist_handoff_disabled',
      'manual_review_required',
    ])
    expect(assessment.queueRecord).toEqual({
      kind: 'founder_waitlist_queue_record',
      queueOnly: true,
      contactHash: CONTACT_HASH,
      joinedAt: 1_783_307_000_000,
      queuePosition: 42,
      telegramUserId: '42424242',
      manualReviewReady: true,
      founderSeatPurchaseEnabled: false,
      paidPriorityEnabled: false,
      cryptoPaymentEnabled: false,
      automaticPromotionEnabled: false,
      automaticReplacementEnabled: false,
      waitlistHandoffEnabled: false,
      blockers: [
        'founder_seat_purchase_disabled',
        'paid_priority_disabled',
        'crypto_waitlist_payment_disabled',
        'automatic_promotion_disabled',
        'automatic_replacement_disabled',
        'waitlist_handoff_disabled',
        'manual_review_required',
      ],
    })
  })

  test('rejects raw email, malformed hashes, and unsafe join times before review', () => {
    const rawEmail = assessFounderWaitlistPolicy({
      contactHash: 'david@example.com',
      joinedAt: 1,
    })
    expect(rawEmail.readyForManualReview).toBe(false)
    expect(rawEmail.contactHash).toBeNull()
    expect(rawEmail.blockers).toContain('contact_hash_required')

    const malformedHash = assessFounderWaitlistPolicy({
      contactHash: 'abc123',
      joinedAt: 1,
    })
    expect(malformedHash.readyForManualReview).toBe(false)
    expect(malformedHash.contactHash).toBeNull()
    expect(malformedHash.blockers).toContain('contact_hash_required')

    for (const joinedAt of [-1, 1.5, Number.NaN]) {
      const assessment = assessFounderWaitlistPolicy({
        contactHash: CONTACT_HASH,
        joinedAt,
      })

      expect(assessment.readyForManualReview).toBe(false)
      expect(assessment.joinedAt).toBeNull()
      expect(assessment.blockers).toContain('valid_joined_at_required')
    }
  })

  test('normalizes optional queue position without enabling automatic handoff', () => {
    const noPosition = assessFounderWaitlistPolicy({
      contactHash: CONTACT_HASH,
      joinedAt: 10,
    })

    expect(noPosition.readyForManualReview).toBe(true)
    expect(noPosition.queuePosition).toBeNull()
    expect(noPosition.queueRecord).toMatchObject({
      queuePosition: null,
      automaticPromotionEnabled: false,
      automaticReplacementEnabled: false,
      waitlistHandoffEnabled: false,
    })

    for (const queuePosition of [0, -3, 1.25, Number.NaN]) {
      const assessment = assessFounderWaitlistPolicy({
        contactHash: CONTACT_HASH,
        joinedAt: 10,
        queuePosition,
      })

      expect(assessment.readyForManualReview).toBe(false)
      expect(assessment.queuePosition).toBeNull()
      expect(assessment.queueRecord).toBeNull()
      expect(assessment.blockers).toContain('valid_queue_position_required')
    }
  })
})
