import { describe, expect, test } from 'vitest'
import {
  areaClaimEvidenceBlockers,
  assessAreaClaimEvidence,
  type AreaClaimEvidenceInput,
} from './areaClaimEvidence'

const baseInput = (overrides: Partial<AreaClaimEvidenceInput> = {}): AreaClaimEvidenceInput => ({
  claim: {
    source: 'geolocation',
    radiusKm: 1,
  },
  founderConfirmed: true,
  serverSuggested: true,
  geolocationAccuracyMeters: 25,
  geolocationDistanceFromClaimCenterMeters: 320,
  ...overrides,
})

describe('area claim evidence policy', () => {
  test('marks confirmed server-suggested geolocation evidence ready when it is inside the claimed area', () => {
    expect(assessAreaClaimEvidence(baseInput())).toEqual({
      source: 'geolocation',
      status: 'ready',
      ready: true,
      evidenceOnly: true,
      serverOwned: true,
      founderConfirmed: true,
      rawIpStored: false,
      ipHash: null,
      geolocationInsideClaim: true,
      telegramAccountId: null,
      manualReviewRequired: false,
      blockers: [],
    })
  })

  test('requires one-time founder confirmation even for strong server evidence', () => {
    const assessment = assessAreaClaimEvidence(baseInput({
      founderConfirmed: false,
    }))

    expect(assessment).toMatchObject({
      status: 'blocked',
      ready: false,
      manualReviewRequired: true,
      blockers: ['founder_confirmation_required'],
    })
  })

  test('keeps manual claims evidence-only and routes them to manual review', () => {
    const assessment = assessAreaClaimEvidence(baseInput({
      claim: { source: 'manual', radiusKm: 0.8 },
      serverSuggested: false,
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))

    expect(assessment).toMatchObject({
      source: 'manual',
      status: 'needs_manual_review',
      ready: false,
      manualReviewRequired: true,
      blockers: ['manual_review_required'],
    })
  })

  test('accepts only privacy-safe IP hash evidence and rejects raw IP storage', () => {
    expect(assessAreaClaimEvidence(baseInput({
      claim: { source: 'ip', radiusKm: 1 },
      ipHash: 'iphash:abcdef1234567890',
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toMatchObject({
      source: 'ip',
      status: 'ready',
      ready: true,
      rawIpStored: false,
      ipHash: 'iphash:abcdef1234567890',
      blockers: [],
    })

    expect(areaClaimEvidenceBlockers(baseInput({
      claim: { source: 'ip', radiusKm: 1 },
      ipHash: '203.0.113.42',
      rawIpAddress: '203.0.113.42',
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toEqual([
      'raw_ip_rejected',
      'ip_hash_required',
    ])
  })

  test('blocks geolocation evidence outside the confirmed area radius', () => {
    const assessment = assessAreaClaimEvidence(baseInput({
      geolocationAccuracyMeters: 40,
      geolocationDistanceFromClaimCenterMeters: 1_200,
    }))

    expect(assessment).toMatchObject({
      status: 'blocked',
      geolocationInsideClaim: false,
      blockers: ['geolocation_outside_area'],
    })
  })

  test('requires verified Telegram identity for Telegram-sourced claims', () => {
    expect(assessAreaClaimEvidence(baseInput({
      claim: { source: 'telegram', radiusKm: 1 },
      telegramAccountId: 'telegram:42424242',
      telegramVerified: true,
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toMatchObject({
      source: 'telegram',
      status: 'ready',
      ready: true,
      telegramAccountId: 'telegram:42424242',
      blockers: [],
    })

    expect(areaClaimEvidenceBlockers(baseInput({
      claim: { source: 'telegram', radiusKm: 1 },
      telegramAccountId: 'telegram:42424242',
      telegramVerified: false,
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toEqual(['telegram_identity_required'])
  })

  test('requires server-owned suggestions for IP, geolocation, and Telegram claims', () => {
    expect(areaClaimEvidenceBlockers(baseInput({
      serverSuggested: false,
    }))).toEqual(['server_suggestion_required'])
    expect(areaClaimEvidenceBlockers(baseInput({
      claim: { source: 'ip', radiusKm: 1 },
      serverSuggested: false,
      ipHash: 'iphash:abcdef1234567890',
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toEqual(['server_suggestion_required'])
    expect(areaClaimEvidenceBlockers(baseInput({
      claim: { source: 'telegram', radiusKm: 1 },
      serverSuggested: false,
      telegramAccountId: 'telegram:42424242',
      telegramVerified: true,
      geolocationAccuracyMeters: null,
      geolocationDistanceFromClaimCenterMeters: null,
    }))).toEqual(['server_suggestion_required'])
  })
})
