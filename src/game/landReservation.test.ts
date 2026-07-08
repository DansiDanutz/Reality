import { describe, expect, test } from 'vitest'
import { landReservationPolicy } from './landReservation'

describe('land reservation policy', () => {
  test('keeps reservations, sales, TON settlement, and profit promises disabled', () => {
    const policy = landReservationPolicy({
      areaId: ' founder-area-0012 ',
      areaLabel: ' Bucharest Founder Block ',
      founderCitizenId: ' citizen-1 ',
      radiusKm: 0.8,
      businessKinds: ['water'],
      realPopulation: 1,
      simPopulation: 2,
    })

    expect(policy).toMatchObject({
      enabled: false,
      mode: 'disabled_until_survival_business_loop_review',
      publicWording: 'reservation_building_rights',
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      founderCitizenId: 'citizen-1',
      realPopulation: 1,
      simPopulation: 2,
      businessCount: 1,
      survivalBusinessLoopReady: false,
      readyForManualReview: false,
      landSalesEnabled: false,
      reservationsEnabled: false,
      purchasesEnabled: false,
      depositsEnabled: false,
      withdrawalsEnabled: false,
      tonSettlementEnabled: false,
      highFrequencyOnChainTransactions: false,
      profitPromiseAllowed: false,
      investmentLanguageAllowed: false,
      manualReviewRequired: true,
      complianceReviewRequired: true,
    })
    expect(policy.reservationQuote).toEqual({
      enabled: false,
      price: null,
      currency: 'game_credits',
      payerCitizenId: null,
      receiverAccountId: 'system:reality-land-reservations',
      settlementRail: 'internal_ledger',
      tonSettlementEnabled: false,
    })
    expect(policy.blockers).toEqual([
      'survival_business_loop_review_required',
      'server_authority_required',
      'compliance_review_required',
      'manual_review_required',
      'land_reservations_disabled',
      'land_purchases_disabled',
      'ton_settlement_disabled',
      'profit_promises_forbidden',
    ])
  })

  test('requires survival businesses and local population before review readiness', () => {
    const policy = landReservationPolicy({
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      founderCitizenId: 'citizen-1',
      radiusKm: 0.8,
      businessKinds: ['water', 'food', 'housing'],
      realPopulation: 1,
      simPopulation: 3,
      serverAuthorityReady: false,
      complianceApproved: false,
    })

    expect(policy.essentialBusinessKinds).toEqual(['water', 'food', 'housing'])
    expect(policy.survivalBusinessLoopReady).toBe(true)
    expect(policy.readyForManualReview).toBe(false)
    expect(policy.readinessSignals.map((signal) => [signal.key, signal.ready])).toEqual([
      ['essential_services', true],
      ['local_population', true],
      ['business_activity', true],
      ['server_authority', false],
      ['compliance_review', false],
    ])
  })

  test('can become review-ready without enabling land execution', () => {
    const policy = landReservationPolicy({
      areaId: 'founder-area-0012',
      areaLabel: 'Bucharest Founder Block',
      founderCitizenId: 'citizen-1',
      radiusKm: 0.8,
      businessKinds: ['water', 'food', 'housing', 'clinic'],
      realPopulation: 2,
      simPopulation: 8,
      serverAuthorityReady: true,
      complianceApproved: true,
    })

    expect(policy.readyForManualReview).toBe(true)
    expect(policy.enabled).toBe(false)
    expect(policy.reservationsEnabled).toBe(false)
    expect(policy.purchasesEnabled).toBe(false)
    expect(policy.tonSettlementEnabled).toBe(false)
    expect(policy.reservationQuote.price).toBeNull()
    expect(policy.allowedPublicCopy).toContain('Reservation/building rights')
    expect(policy.prohibitedClaims).toEqual([
      'guaranteed_profit',
      'passive_income_promise',
      'investment_return',
      'token_appreciation',
      'real_estate_ownership',
    ])
  })
})
