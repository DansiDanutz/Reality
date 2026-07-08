import { describe, expect, test } from 'vitest'

import { assessOperatorBusinessEligibility } from './operatorBusiness'

describe('operator business eligibility', () => {
  test('keeps operator acceptance, leases, and rent collection disabled by default', () => {
    const assessment = assessOperatorBusinessEligibility()

    expect(assessment).toEqual({
      enabled: false,
      operatorAcceptanceEnabled: false,
      leaseExecutionEnabled: false,
      rentCollectionEnabled: false,
      manualReviewRequired: true,
      landOwnerCitizenId: null,
      operatorCitizenId: null,
      businessId: null,
      businessOwnerCitizenId: null,
      businessKind: null,
      businessLicensed: false,
      businessUsesRentedLand: false,
      localDemandServed: 0,
      activeStaffCount: 0,
      requiredStaffCount: 0,
      staffedForReview: true,
      readyForManualReview: false,
      reviewDraft: null,
      blockers: [
        'leases_disabled',
        'operator_acceptance_disabled',
        'rent_collection_disabled',
        'land_owner_required',
        'operator_required',
        'business_required',
        'operator_must_control_business',
        'business_license_required',
        'local_demand_required',
      ],
    })
  })

  test('drafts a disabled manual review only for a distinct operator business serving demand', () => {
    const assessment = assessOperatorBusinessEligibility({
      landOwnerCitizenId: ' owner-1 ',
      operatorCitizenId: ' operator-1 ',
      businessId: ' business-water ',
      businessOwnerCitizenId: 'operator-1',
      businessKind: 'water',
      businessLicensed: true,
      businessUsesRentedLand: true,
      localDemandServed: 14.9,
      activeStaffCount: 2,
      requiredStaffCount: 1,
    })

    expect(assessment).toMatchObject({
      readyForManualReview: true,
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      businessId: 'business-water',
      businessOwnerCitizenId: 'operator-1',
      businessKind: 'water',
      localDemandServed: 14,
      activeStaffCount: 2,
      requiredStaffCount: 1,
      staffedForReview: true,
      blockers: ['leases_disabled', 'operator_acceptance_disabled', 'rent_collection_disabled'],
    })
    expect(assessment.reviewDraft).toEqual({
      kind: 'operator_business_review',
      executionEnabled: false,
      operatorAcceptanceEnabled: false,
      rentCollectionEnabled: false,
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      businessId: 'business-water',
      businessKind: 'water',
      localDemandServed: 14,
      activeStaffCount: 2,
      requiredStaffCount: 1,
      blockers: ['leases_disabled', 'operator_acceptance_disabled', 'rent_collection_disabled'],
    })
  })

  test('blocks self-operated land from pretending to be operator rent', () => {
    const assessment = assessOperatorBusinessEligibility({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'owner-1',
      businessId: 'business-food',
      businessOwnerCitizenId: 'owner-1',
      businessKind: 'food',
      businessLicensed: true,
      businessUsesRentedLand: true,
      localDemandServed: 6,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'leases_disabled',
      'operator_acceptance_disabled',
      'rent_collection_disabled',
      'operator_must_be_distinct',
    ])
  })

  test('requires operator control, business license, local demand, and staffing evidence', () => {
    const assessment = assessOperatorBusinessEligibility({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      businessId: 'business-clinic',
      businessOwnerCitizenId: 'other-operator',
      businessKind: 'clinic',
      businessLicensed: false,
      businessUsesRentedLand: false,
      localDemandServed: 0,
      activeStaffCount: 1,
      requiredStaffCount: 3,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'leases_disabled',
      'operator_acceptance_disabled',
      'rent_collection_disabled',
      'operator_must_control_business',
      'business_license_required',
      'local_demand_required',
      'staffing_review_required',
    ])
  })

  test('normalizes invalid counts without inventing demand or staffing', () => {
    const assessment = assessOperatorBusinessEligibility({
      landOwnerCitizenId: 'owner-1',
      operatorCitizenId: 'operator-1',
      businessId: 'business-insurance',
      businessOwnerCitizenId: 'operator-1',
      businessKind: 'insurance',
      businessLicensed: true,
      businessUsesRentedLand: true,
      localDemandServed: Number.NaN,
      activeStaffCount: Number.POSITIVE_INFINITY,
      requiredStaffCount: 1.8,
    })

    expect(assessment.localDemandServed).toBe(0)
    expect(assessment.activeStaffCount).toBe(0)
    expect(assessment.requiredStaffCount).toBe(1)
    expect(assessment.staffedForReview).toBe(false)
    expect(assessment.blockers).toEqual([
      'leases_disabled',
      'operator_acceptance_disabled',
      'rent_collection_disabled',
      'local_demand_required',
      'staffing_review_required',
    ])
  })
})
