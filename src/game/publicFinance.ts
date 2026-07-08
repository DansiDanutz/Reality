export type PublicFinanceBlocker =
  | 'tax_collection_disabled'
  | 'treasury_spending_disabled'
  | 'governance_disabled'
  | 'p2p_economy_required'
  | 'area_required'
  | 'payer_required'
  | 'city_treasury_required'
  | 'taxable_base_required'
  | 'compliance_review_required'
  | 'manual_finance_review_required'

export interface PublicFinancePolicyInput {
  areaId: string
  payerCitizenId: string
  cityTreasuryAccountId?: string | null
  taxableSalesVolume?: number | null
  taxablePropertyValue?: number | null
  salesTaxRate?: number | null
  monthlyPropertyTaxRate?: number | null
  p2pEconomyReady?: boolean
  complianceApproved?: boolean
  manualFinanceApproved?: boolean
  assessedAt?: number | null
}

export interface PublicFinanceTaxDraft {
  kind: 'city_treasury_tax'
  executionEnabled: false
  taxCollectionEnabled: false
  treasurySpendingEnabled: false
  governanceEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  areaId: string
  payerCitizenId: string
  receiverAccountId: string
  taxableSalesVolume: number
  taxablePropertyValue: number
  salesTaxRate: number
  monthlyPropertyTaxRate: number
  salesTaxAmount: number
  propertyTaxAmount: number
  totalTaxAmount: number
  assessedAt: number | null
  blockers: readonly PublicFinanceBlocker[]
}

export interface PublicFinancePolicyAssessment {
  enabled: false
  taxCollectionEnabled: false
  treasurySpendingEnabled: false
  governanceEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  areaId: string
  payerCitizenId: string
  cityTreasuryAccountId: string | null
  taxableSalesVolume: number
  taxablePropertyValue: number
  salesTaxRate: number
  monthlyPropertyTaxRate: number
  salesTaxAmount: number
  propertyTaxAmount: number
  totalTaxAmount: number
  p2pEconomyReady: boolean
  complianceApproved: boolean
  manualFinanceApproved: boolean
  readyForManualReview: boolean
  draft: PublicFinanceTaxDraft | null
  blockers: readonly PublicFinanceBlocker[]
}

export const DEFAULT_SALES_TAX_RATE = 0.02
export const DEFAULT_MONTHLY_PROPERTY_TAX_RATE = 0.005

const BASE_DISABLED_BLOCKERS: readonly PublicFinanceBlocker[] = [
  'tax_collection_disabled',
  'treasury_spending_disabled',
  'governance_disabled',
]

export function assessPublicFinancePolicy(
  input: PublicFinancePolicyInput,
): PublicFinancePolicyAssessment {
  const areaId = input.areaId.trim()
  const payerCitizenId = input.payerCitizenId.trim()
  const cityTreasuryAccountId = normalizedCityTreasuryAccountId(areaId, input.cityTreasuryAccountId ?? null)
  const taxableSalesVolume = positiveMoney(input.taxableSalesVolume ?? 0)
  const taxablePropertyValue = positiveMoney(input.taxablePropertyValue ?? 0)
  const salesTaxRate = normalizedRate(input.salesTaxRate, DEFAULT_SALES_TAX_RATE)
  const monthlyPropertyTaxRate = normalizedRate(input.monthlyPropertyTaxRate, DEFAULT_MONTHLY_PROPERTY_TAX_RATE)
  const salesTaxAmount = roundMoney(taxableSalesVolume * salesTaxRate)
  const propertyTaxAmount = roundMoney(taxablePropertyValue * monthlyPropertyTaxRate)
  const totalTaxAmount = roundMoney(salesTaxAmount + propertyTaxAmount)
  const p2pEconomyReady = input.p2pEconomyReady === true
  const complianceApproved = input.complianceApproved === true
  const manualFinanceApproved = input.manualFinanceApproved === true

  const readinessBlockers: PublicFinanceBlocker[] = []
  if (!p2pEconomyReady) readinessBlockers.push('p2p_economy_required')
  if (!areaId) readinessBlockers.push('area_required')
  if (!payerCitizenId) readinessBlockers.push('payer_required')
  if (!cityTreasuryAccountId) readinessBlockers.push('city_treasury_required')
  if (totalTaxAmount <= 0) readinessBlockers.push('taxable_base_required')
  if (!complianceApproved) readinessBlockers.push('compliance_review_required')
  if (!manualFinanceApproved) readinessBlockers.push('manual_finance_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_finance_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    taxCollectionEnabled: false,
    treasurySpendingEnabled: false,
    governanceEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    areaId,
    payerCitizenId,
    cityTreasuryAccountId,
    taxableSalesVolume,
    taxablePropertyValue,
    salesTaxRate,
    monthlyPropertyTaxRate,
    salesTaxAmount,
    propertyTaxAmount,
    totalTaxAmount,
    p2pEconomyReady,
    complianceApproved,
    manualFinanceApproved,
    readyForManualReview,
    draft: readyForManualReview && areaId && payerCitizenId && cityTreasuryAccountId
      ? publicFinanceTaxDraft({
        areaId,
        payerCitizenId,
        cityTreasuryAccountId,
        taxableSalesVolume,
        taxablePropertyValue,
        salesTaxRate,
        monthlyPropertyTaxRate,
        salesTaxAmount,
        propertyTaxAmount,
        totalTaxAmount,
        assessedAt: normalizedInstant(input.assessedAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function publicFinanceTaxDraft(input: {
  areaId: string
  payerCitizenId: string
  cityTreasuryAccountId: string
  taxableSalesVolume: number
  taxablePropertyValue: number
  salesTaxRate: number
  monthlyPropertyTaxRate: number
  salesTaxAmount: number
  propertyTaxAmount: number
  totalTaxAmount: number
  assessedAt: number | null
  blockers: readonly PublicFinanceBlocker[]
}): PublicFinanceTaxDraft {
  return {
    kind: 'city_treasury_tax',
    executionEnabled: false,
    taxCollectionEnabled: false,
    treasurySpendingEnabled: false,
    governanceEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    areaId: input.areaId,
    payerCitizenId: input.payerCitizenId,
    receiverAccountId: input.cityTreasuryAccountId,
    taxableSalesVolume: input.taxableSalesVolume,
    taxablePropertyValue: input.taxablePropertyValue,
    salesTaxRate: input.salesTaxRate,
    monthlyPropertyTaxRate: input.monthlyPropertyTaxRate,
    salesTaxAmount: input.salesTaxAmount,
    propertyTaxAmount: input.propertyTaxAmount,
    totalTaxAmount: input.totalTaxAmount,
    assessedAt: input.assessedAt,
    blockers: input.blockers,
  }
}

function normalizedCityTreasuryAccountId(areaId: string, explicitAccountId: string | null): string | null {
  const trimmed = explicitAccountId?.trim() || null
  if (trimmed) return trimmed
  if (!areaId) return null
  return `system:city-treasury:${areaId}`
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedRate(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return roundRate(Math.min(1, Math.max(0, value)))
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly PublicFinanceBlocker[]): PublicFinanceBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}
