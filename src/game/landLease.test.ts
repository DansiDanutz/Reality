import { describe, expect, test } from 'vitest'
import {
  DEFAULT_LAND_LEASE_PLATFORM_FEE_RATE,
  DEFAULT_LAND_LEASE_TERM_DAYS,
  PLATFORM_FEE_RECEIVER_ID,
  assessLandLeasePolicy,
} from './landLease'

const DAY = 24 * 60 * 60 * 1000

describe('land lease policy', () => {
  test('keeps land reservations, leases, and rent collection disabled by default', () => {
    const assessment = assessLandLeasePolicy({
      landOwnerCitizenId: 'owner-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      reservationsEnabled: false,
      leasesEnabled: false,
      rentCollectionEnabled: false,
      operatorAcceptanceEnabled: false,
      manualReviewRequired: true,
      publicWording: 'reservation_building_rights',
      rentCurrency: 'game_credits',
      landOwnerCitizenId: 'owner-1',
      fixedMonthlyRent: null,
      termDays: DEFAULT_LAND_LEASE_TERM_DAYS,
      platformFeeRate: DEFAULT_LAND_LEASE_PLATFORM_FEE_RATE,
      operatorBusinessUsesLand: false,
      localDemandServed: 0,
      readyForManualReview: false,
      rentDraft: null,
    })
    expect(assessment.blockers).toEqual([
      'reservations_disabled',
      'leases_disabled',
      'rent_collection_disabled',
      'operator_acceptance_disabled',
      'manual_review_required',
      'compliance_review_required',
      'operator_required',
      'operator_use_required',
      'local_demand_required',
    ])
  })

  test('drafts disabled fixed-rent terms only when an operator uses the land for demand', () => {
    const startsAt = 1_783_303_200_000
    const assessment = assessLandLeasePolicy({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      operatorBusinessId: 'business-water',
      operatorBusinessUsesLand: true,
      localDemandServed: 12,
      fixedMonthlyRent: 1_200,
      termDays: 30,
      platformFeeRate: 0.05,
      startsAt,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.rentDraft).toEqual({
      kind: 'land_lease_rent',
      executionEnabled: false,
      rentCollectionEnabled: false,
      payerCitizenId: 'operator-1',
      receiverCitizenId: 'owner-1',
      platformFeeReceiverId: PLATFORM_FEE_RECEIVER_ID,
      rentCurrency: 'game_credits',
      fixedMonthlyRent: 1_200,
      platformFeeRate: 0.05,
      platformFeeAmount: 60,
      ownerRentAmount: 1_140,
      termDays: 30,
      startsAt,
      endsAt: startsAt + 30 * DAY,
      operatorBusinessId: 'business-water',
      blockers: [
        'reservations_disabled',
        'leases_disabled',
        'rent_collection_disabled',
        'operator_acceptance_disabled',
        'manual_review_required',
        'compliance_review_required',
      ],
    })
  })

  test('does not draft owner income when the owner is also the operator', () => {
    const assessment = assessLandLeasePolicy({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'owner-1',
      operatorBusinessId: 'business-food',
      operatorBusinessUsesLand: true,
      localDemandServed: 7,
      fixedMonthlyRent: 900,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.rentDraft).toBeNull()
    expect(assessment.blockers).toContain('operator_must_be_distinct')
  })

  test('requires an operator business that serves local demand before rent can be reviewed', () => {
    const assessment = assessLandLeasePolicy({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      operatorBusinessId: 'business-empty',
      operatorBusinessUsesLand: false,
      localDemandServed: 0,
      fixedMonthlyRent: 500,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.rentDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'reservations_disabled',
      'leases_disabled',
      'rent_collection_disabled',
      'operator_acceptance_disabled',
      'manual_review_required',
      'compliance_review_required',
      'operator_use_required',
      'local_demand_required',
    ])
  })

  test('normalizes invalid rent, term, fee, demand, and start values', () => {
    const assessment = assessLandLeasePolicy({
      landOwnerCitizenId: ' owner-1 ',
      operatorCitizenId: ' operator-1 ',
      operatorBusinessId: ' business-clinic ',
      operatorBusinessUsesLand: true,
      localDemandServed: Number.POSITIVE_INFINITY,
      fixedMonthlyRent: -20,
      termDays: Number.NaN,
      platformFeeRate: 2,
      startsAt: -1,
    })

    expect(assessment.landOwnerCitizenId).toBe('owner-1')
    expect(assessment.operatorCitizenId).toBe('operator-1')
    expect(assessment.operatorBusinessId).toBe('business-clinic')
    expect(assessment.fixedMonthlyRent).toBeNull()
    expect(assessment.termDays).toBe(DEFAULT_LAND_LEASE_TERM_DAYS)
    expect(assessment.platformFeeRate).toBe(1)
    expect(assessment.localDemandServed).toBe(0)
    expect(assessment.rentDraft).toBeNull()
    expect(assessment.blockers).toContain('local_demand_required')
  })
})
