import { describe, expect, test } from 'vitest'

import { assessFounderAreaExpansion, nextExpansionScope } from './founderAreaExpansion'

describe('founder area expansion policy', () => {
  test('keeps area expansion disabled by default', () => {
    expect(assessFounderAreaExpansion()).toEqual({
      enabled: false,
      expansionExecutionEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      publicWording: 'earned_operating_area_not_land_sale',
      founderCitizenId: '',
      currentScope: 'starter_area',
      nextScope: 'neighborhood',
      localAreaConfirmed: false,
      population: 0,
      realPopulation: 0,
      simPopulation: 0,
      businessCount: 0,
      localDemandServed: 0,
      essentialServiceCoverage: 0,
      staffedBusinessRatio: 0,
      unservedEssentialDemand: 0,
      activeDaysInWindow: 0,
      activityScore: 0,
      outstandingDebt: 0,
      hospitalized: false,
      requirement: {
        nextScope: 'neighborhood',
        minPopulation: 10,
        minBusinesses: 3,
        minLocalDemandServed: 10,
        minEssentialServiceCoverage: 0.75,
        minStaffedBusinessRatio: 0.6,
        maxUnservedEssentialDemand: 2,
        minActiveDaysInWindow: 3,
        minActivityScore: 50,
        licenseSlotMultiplier: 1.25,
      },
      readyForManualReview: false,
      reviewDraft: null,
      blockers: [
        'area_expansion_disabled',
        'server_authority_required',
        'founder_identity_required',
        'local_area_confirmation_required',
        'population_required',
        'business_activity_required',
        'essential_service_stability_required',
        'staffing_required',
        'activity_required',
        'manual_expansion_review_required',
      ],
    })
  })

  test('drafts a disabled manual review when the local economy is stable enough to grow', () => {
    const assessment = assessFounderAreaExpansion({
      founderCitizenId: ' founder-1 ',
      localAreaConfirmed: true,
      realPopulation: 4,
      simPopulation: 12,
      businessCount: 4,
      localDemandServed: 24,
      essentialServiceCoverage: 0.82,
      staffedBusinessRatio: 0.75,
      unservedEssentialDemand: 1,
      activeDaysInWindow: 5,
      activityScore: 64,
      serverAuthorityReady: true,
      reviewedAt: 1783308600000,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.currentScope).toBe('starter_area')
    expect(assessment.nextScope).toBe('neighborhood')
    expect(assessment.population).toBe(16)
    expect(assessment.blockers).toEqual([
      'area_expansion_disabled',
      'manual_expansion_review_required',
    ])
    expect(assessment.reviewDraft).toEqual({
      kind: 'founder_area_expansion_review',
      executionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      publicWording: 'earned_operating_area_not_land_sale',
      founderCitizenId: 'founder-1',
      currentScope: 'starter_area',
      nextScope: 'neighborhood',
      licenseSlotMultiplier: 1.25,
      reviewedAt: 1783308600000,
      blockers: ['area_expansion_disabled', 'manual_expansion_review_required'],
    })
  })

  test('keeps execution disabled even after manual expansion approval evidence is present', () => {
    const assessment = assessFounderAreaExpansion({
      founderCitizenId: 'founder-1',
      currentScope: 'neighborhood',
      localAreaConfirmed: true,
      population: 80,
      businessCount: 10,
      localDemandServed: 90,
      essentialServiceCoverage: 0.9,
      staffedBusinessRatio: 0.8,
      activeDaysInWindow: 20,
      activityScore: 74,
      serverAuthorityReady: true,
      manualExpansionApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual(['area_expansion_disabled'])
    expect(assessment.reviewDraft).toMatchObject({
      executionEnabled: false,
      currentScope: 'neighborhood',
      nextScope: 'city',
      licenseSlotMultiplier: 1.5,
      blockers: ['area_expansion_disabled'],
    })
  })

  test('blocks growth when service quality, staffing, activity, debt, or health make expansion unsafe', () => {
    const assessment = assessFounderAreaExpansion({
      founderCitizenId: 'founder-1',
      localAreaConfirmed: true,
      population: 100,
      businessCount: 8,
      localDemandServed: 60,
      essentialServiceCoverage: 0.7,
      staffedBusinessRatio: 0.5,
      unservedEssentialDemand: 7,
      activeDaysInWindow: 1,
      activityScore: 80,
      outstandingDebt: 250,
      hospitalized: true,
      serverAuthorityReady: true,
      manualExpansionApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'area_expansion_disabled',
      'essential_service_stability_required',
      'staffing_required',
      'activity_required',
      'debt_review_required',
      'hospitalization_review_required',
    ])
  })

  test('stops at country scope instead of inventing a wider claim', () => {
    const assessment = assessFounderAreaExpansion({
      founderCitizenId: 'founder-1',
      currentScope: 'country',
      localAreaConfirmed: true,
      population: 100_000,
      businessCount: 500,
      localDemandServed: 50_000,
      essentialServiceCoverage: 1,
      staffedBusinessRatio: 1,
      activeDaysInWindow: 365,
      activityScore: 100,
      serverAuthorityReady: true,
      manualExpansionApproved: true,
    })

    expect(nextExpansionScope('country')).toBeNull()
    expect(assessment.nextScope).toBeNull()
    expect(assessment.requirement).toBeNull()
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual(['area_expansion_disabled', 'next_scope_unavailable'])
  })

  test('normalizes invalid evidence without creating expansion readiness', () => {
    const assessment = assessFounderAreaExpansion({
      founderCitizenId: 'founder-1',
      localAreaConfirmed: true,
      population: Number.POSITIVE_INFINITY,
      realPopulation: 2.9,
      simPopulation: Number.NaN,
      businessCount: 2.8,
      localDemandServed: -4,
      essentialServiceCoverage: 1.7,
      staffedBusinessRatio: Number.NEGATIVE_INFINITY,
      unservedEssentialDemand: 0,
      activeDaysInWindow: 3.9,
      activityScore: 101.4,
      outstandingDebt: Number.NaN,
      serverAuthorityReady: true,
      manualExpansionApproved: true,
    })

    expect(assessment.population).toBe(2)
    expect(assessment.businessCount).toBe(2)
    expect(assessment.localDemandServed).toBe(0)
    expect(assessment.essentialServiceCoverage).toBe(1)
    expect(assessment.staffedBusinessRatio).toBe(0)
    expect(assessment.activeDaysInWindow).toBe(3)
    expect(assessment.activityScore).toBe(100)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'area_expansion_disabled',
      'population_required',
      'business_activity_required',
      'staffing_required',
    ])
  })
})
