import { describe, expect, test } from 'vitest'

import { assessBusinessLicensePolicy } from './businessLicense'

describe('business license policy', () => {
  test('marks a demand-backed first essential business ready for manual review only', () => {
    const assessment = assessBusinessLicensePolicy({
      kind: 'food',
      population: 12,
      localDemand: 4,
      existingBusinesses: 0,
    })

    expect(assessment).toMatchObject({
      approvalMode: 'manual_review',
      autoIssueEnabled: false,
      licenseSlots: 1,
      licensesRemaining: 1,
      saturationStatus: 'open',
      readyForManualReview: true,
      recommendedDecision: 'approve',
      nextAction: 'issue_license',
      blockers: [],
    })
    expect(assessment.reviewDraft).toMatchObject({
      kind: 'business_license_review',
      executionEnabled: false,
      autoIssueEnabled: false,
      businessKind: 'food',
      licenseNumber: 1,
      requiredLocalDemand: 1,
      projectedDemandPerBusiness: 4,
      blockers: [],
    })
  })

  test('requires enough local demand before reviewing a second same-kind business', () => {
    const assessment = assessBusinessLicensePolicy({
      kind: 'food',
      population: 60,
      localDemand: 1,
      existingBusinesses: 1,
    })

    expect(assessment).toMatchObject({
      licenseSlots: 2,
      licensesRemaining: 1,
      demandPerExistingBusiness: 1,
      projectedDemandPerBusiness: 0.5,
      requiredLocalDemand: 2,
      readyForManualReview: false,
      recommendedDecision: 'deny',
      nextAction: 'grow_demand',
      reviewDraft: null,
      blockers: ['local_demand_required'],
    })
  })

  test('blocks saturated areas even when demand exists until population unlocks another slot', () => {
    const assessment = assessBusinessLicensePolicy({
      kind: 'food',
      population: 60,
      localDemand: 12,
      existingBusinesses: 2,
    })

    expect(assessment).toMatchObject({
      licenseSlots: 2,
      licensesRemaining: 0,
      nextUnlockPopulation: 90,
      citizensUntilNextLicense: 30,
      saturation: 1,
      saturationStatus: 'at_limit',
      readyForManualReview: false,
      recommendedDecision: 'deny',
      nextAction: 'grow_population',
      reviewDraft: null,
      blockers: ['license_slot_unavailable', 'saturation_review_required'],
    })
  })

  test('requires population before clinic and insurance licenses can be reviewed', () => {
    const clinic = assessBusinessLicensePolicy({
      kind: 'clinic',
      population: 79,
      localDemand: 10,
      existingBusinesses: 0,
    })
    const insurance = assessBusinessLicensePolicy({
      kind: 'insurance',
      population: 89,
      localDemand: 10,
      existingBusinesses: 0,
    })

    expect(clinic).toMatchObject({
      licenseSlots: 0,
      nextUnlockPopulation: 80,
      citizensUntilNextLicense: 1,
      nextAction: 'grow_population',
      blockers: ['population_required', 'license_slot_unavailable'],
      reviewDraft: null,
    })
    expect(insurance).toMatchObject({
      licenseSlots: 0,
      nextUnlockPopulation: 90,
      citizensUntilNextLicense: 1,
      nextAction: 'grow_population',
      blockers: ['population_required', 'license_slot_unavailable'],
      reviewDraft: null,
    })
  })

  test('normalizes invalid counts and reports overbuilt saturation', () => {
    const assessment = assessBusinessLicensePolicy({
      kind: 'water',
      population: 12.9,
      localDemand: Number.NaN,
      existingBusinesses: 3.8,
      minimumDemandPerBusiness: -1,
    })

    expect(assessment).toMatchObject({
      population: 12,
      localDemand: 0,
      existingBusinesses: 3,
      minimumDemandPerBusiness: 1,
      licenseSlots: 1,
      licensesRemaining: 0,
      saturation: 3,
      saturationStatus: 'overbuilt',
      nextAction: 'grow_population',
      blockers: [
        'license_slot_unavailable',
        'saturation_review_required',
        'local_demand_required',
      ],
    })
  })
})
