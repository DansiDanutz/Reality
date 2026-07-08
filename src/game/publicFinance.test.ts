import { describe, expect, test } from 'vitest'
import {
  DEFAULT_MONTHLY_PROPERTY_TAX_RATE,
  DEFAULT_SALES_TAX_RATE,
  assessPublicFinancePolicy,
} from './publicFinance'

describe('public finance policy', () => {
  test('keeps city tax collection, treasury spending, and governance disabled by default', () => {
    const assessment = assessPublicFinancePolicy({
      areaId: 'area-1',
      payerCitizenId: 'founder-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      taxCollectionEnabled: false,
      treasurySpendingEnabled: false,
      governanceEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      areaId: 'area-1',
      payerCitizenId: 'founder-1',
      cityTreasuryAccountId: 'system:city-treasury:area-1',
      taxableSalesVolume: 0,
      taxablePropertyValue: 0,
      salesTaxRate: DEFAULT_SALES_TAX_RATE,
      monthlyPropertyTaxRate: DEFAULT_MONTHLY_PROPERTY_TAX_RATE,
      salesTaxAmount: 0,
      propertyTaxAmount: 0,
      totalTaxAmount: 0,
      p2pEconomyReady: false,
      complianceApproved: false,
      manualFinanceApproved: false,
      readyForManualReview: false,
      draft: null,
    })
    expect(assessment.blockers).toEqual([
      'tax_collection_disabled',
      'treasury_spending_disabled',
      'governance_disabled',
      'p2p_economy_required',
      'taxable_base_required',
      'compliance_review_required',
      'manual_finance_review_required',
    ])
  })

  test('drafts disabled city treasury tax movement when local finance is review-ready', () => {
    const assessedAt = 1_783_303_200_000
    const assessment = assessPublicFinancePolicy({
      areaId: ' bucharest-sector-1 ',
      payerCitizenId: ' founder-1 ',
      taxableSalesVolume: 2_500,
      taxablePropertyValue: 120_000,
      salesTaxRate: 0.02,
      monthlyPropertyTaxRate: 0.005,
      p2pEconomyReady: true,
      complianceApproved: true,
      manualFinanceApproved: false,
      assessedAt,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.draft).toEqual({
      kind: 'city_treasury_tax',
      executionEnabled: false,
      taxCollectionEnabled: false,
      treasurySpendingEnabled: false,
      governanceEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      areaId: 'bucharest-sector-1',
      payerCitizenId: 'founder-1',
      receiverAccountId: 'system:city-treasury:bucharest-sector-1',
      taxableSalesVolume: 2_500,
      taxablePropertyValue: 120_000,
      salesTaxRate: 0.02,
      monthlyPropertyTaxRate: 0.005,
      salesTaxAmount: 50,
      propertyTaxAmount: 600,
      totalTaxAmount: 650,
      assessedAt,
      blockers: [
        'tax_collection_disabled',
        'treasury_spending_disabled',
        'governance_disabled',
        'manual_finance_review_required',
      ],
    })
  })

  test('keeps tax execution disabled even after manual finance approval is modeled', () => {
    const assessment = assessPublicFinancePolicy({
      areaId: 'area-1',
      payerCitizenId: 'founder-1',
      taxableSalesVolume: 1_000,
      p2pEconomyReady: true,
      complianceApproved: true,
      manualFinanceApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'tax_collection_disabled',
      'treasury_spending_disabled',
      'governance_disabled',
    ])
    expect(assessment.draft).toMatchObject({
      executionEnabled: false,
      taxCollectionEnabled: false,
      treasurySpendingEnabled: false,
      governanceEnabled: false,
      payerCitizenId: 'founder-1',
      receiverAccountId: 'system:city-treasury:area-1',
      salesTaxAmount: 20,
      totalTaxAmount: 20,
      blockers: [
        'tax_collection_disabled',
        'treasury_spending_disabled',
        'governance_disabled',
      ],
    })
  })

  test('requires area, payer, treasury, taxable base, P2P economy, and compliance gates', () => {
    const assessment = assessPublicFinancePolicy({
      areaId: ' ',
      payerCitizenId: ' ',
      cityTreasuryAccountId: ' ',
      taxableSalesVolume: 100,
      p2pEconomyReady: false,
      complianceApproved: false,
      manualFinanceApproved: true,
    })

    expect(assessment.cityTreasuryAccountId).toBeNull()
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'tax_collection_disabled',
      'treasury_spending_disabled',
      'governance_disabled',
      'p2p_economy_required',
      'area_required',
      'payer_required',
      'city_treasury_required',
      'compliance_review_required',
    ])
  })

  test('uses an explicit city treasury account when one is provided', () => {
    const assessment = assessPublicFinancePolicy({
      areaId: 'area-1',
      payerCitizenId: 'founder-1',
      cityTreasuryAccountId: ' treasury:bucharest ',
      taxableSalesVolume: 500,
      p2pEconomyReady: true,
      complianceApproved: true,
      manualFinanceApproved: true,
    })

    expect(assessment.cityTreasuryAccountId).toBe('treasury:bucharest')
    expect(assessment.draft).toMatchObject({
      receiverAccountId: 'treasury:bucharest',
      totalTaxAmount: 10,
    })
  })

  test('normalizes invalid tax bases, rates, and assessment times', () => {
    const assessment = assessPublicFinancePolicy({
      areaId: 'area-1',
      payerCitizenId: 'founder-1',
      taxableSalesVolume: Number.POSITIVE_INFINITY,
      taxablePropertyValue: -20,
      salesTaxRate: 2,
      monthlyPropertyTaxRate: -0.2,
      p2pEconomyReady: true,
      complianceApproved: true,
      manualFinanceApproved: true,
      assessedAt: -1,
    })

    expect(assessment.taxableSalesVolume).toBe(0)
    expect(assessment.taxablePropertyValue).toBe(0)
    expect(assessment.salesTaxRate).toBe(1)
    expect(assessment.monthlyPropertyTaxRate).toBe(0)
    expect(assessment.totalTaxAmount).toBe(0)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'tax_collection_disabled',
      'treasury_spending_disabled',
      'governance_disabled',
      'taxable_base_required',
    ])
  })
})
