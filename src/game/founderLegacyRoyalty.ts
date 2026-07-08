export type FounderLegacyRoyaltyBlocker =
  | 'replacement_workflow_disabled'
  | 'waitlist_handoff_disabled'
  | 'treasury_payout_disabled'
  | 'manual_review_required'
  | 'compliance_review_required'

export type FounderLegacyRoyaltyExclusionReason =
  | 'successor_created_asset'
  | 'not_owned_by_successor'
  | 'not_created_by_previous_founder'
  | 'no_base_revenue'

export interface FounderLegacyRoyaltyAssetInput {
  id: string
  currentOwnerCitizenId: string
  createdByCitizenId: string
  periodBaseNetRevenue: number
  periodSuccessorUpgradeNetRevenue?: number
}

export interface FounderLegacyRoyaltyInput {
  previousFounderCitizenId: string
  successorCitizenId: string
  assets: readonly FounderLegacyRoyaltyAssetInput[]
  royaltyRate?: number
  treasuryAccountId?: string
}

export interface FounderLegacyRoyaltyEligibleAsset {
  id: string
  baseNetRevenue: number
  successorUpgradeNetRevenue: number
  royaltyAmount: number
}

export interface FounderLegacyRoyaltyExcludedAsset {
  id: string
  reason: FounderLegacyRoyaltyExclusionReason
  excludedNetRevenue: number
}

export interface FounderLegacyRoyaltyLedgerDraft {
  kind: 'founder_legacy_royalty'
  executionEnabled: false
  payoutEnabled: false
  payerCitizenId: string
  receiverAccountId: string
  previousFounderCitizenId: string
  amount: number
  royaltyRate: number
  sourceAssetIds: readonly string[]
  blockers: readonly FounderLegacyRoyaltyBlocker[]
}

export interface FounderLegacyRoyaltyAssessment {
  enabled: false
  payoutEnabled: false
  replacementWorkflowEnabled: false
  waitlistHandoffEnabled: false
  manualReviewRequired: true
  appliesTo: 'inherited_founder_created_base_value_only'
  royaltyRate: number
  treasuryAccountId: string
  previousFounderCitizenId: string
  successorCitizenId: string
  eligibleAssets: readonly FounderLegacyRoyaltyEligibleAsset[]
  excludedAssets: readonly FounderLegacyRoyaltyExcludedAsset[]
  totals: {
    inheritedBaseNetRevenue: number
    successorUpgradeNetRevenue: number
    excludedNetRevenue: number
    modeledRoyaltyAmount: number
  }
  ledgerDraft: FounderLegacyRoyaltyLedgerDraft | null
  blockers: readonly FounderLegacyRoyaltyBlocker[]
}

export const DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE = 0.1
export const FOUNDER_LEGACY_TREASURY_ACCOUNT_ID = 'system:founder-legacy-treasury'

const LEGACY_ROYALTY_BLOCKERS: readonly FounderLegacyRoyaltyBlocker[] = [
  'replacement_workflow_disabled',
  'waitlist_handoff_disabled',
  'treasury_payout_disabled',
  'manual_review_required',
  'compliance_review_required',
]

export function assessFounderLegacyRoyalty(input: FounderLegacyRoyaltyInput): FounderLegacyRoyaltyAssessment {
  const royaltyRate = normalizedRoyaltyRate(input.royaltyRate)
  const treasuryAccountId = input.treasuryAccountId?.trim() || FOUNDER_LEGACY_TREASURY_ACCOUNT_ID
  const previousFounderCitizenId = input.previousFounderCitizenId.trim()
  const successorCitizenId = input.successorCitizenId.trim()
  const eligibleAssets: FounderLegacyRoyaltyEligibleAsset[] = []
  const excludedAssets: FounderLegacyRoyaltyExcludedAsset[] = []

  for (const asset of input.assets) {
    const assetId = asset.id.trim()
    if (!assetId) continue
    const currentOwnerCitizenId = asset.currentOwnerCitizenId.trim()
    const createdByCitizenId = asset.createdByCitizenId.trim()

    const baseNetRevenue = positiveMoney(asset.periodBaseNetRevenue)
    const successorUpgradeNetRevenue = positiveMoney(asset.periodSuccessorUpgradeNetRevenue ?? 0)

    if (currentOwnerCitizenId !== successorCitizenId) {
      excludedAssets.push({
        id: assetId,
        reason: 'not_owned_by_successor',
        excludedNetRevenue: roundMoney(baseNetRevenue + successorUpgradeNetRevenue),
      })
      continue
    }

    if (createdByCitizenId === successorCitizenId) {
      excludedAssets.push({
        id: assetId,
        reason: 'successor_created_asset',
        excludedNetRevenue: roundMoney(baseNetRevenue + successorUpgradeNetRevenue),
      })
      continue
    }

    if (createdByCitizenId !== previousFounderCitizenId) {
      excludedAssets.push({
        id: assetId,
        reason: 'not_created_by_previous_founder',
        excludedNetRevenue: roundMoney(baseNetRevenue + successorUpgradeNetRevenue),
      })
      continue
    }

    if (baseNetRevenue <= 0) {
      excludedAssets.push({
        id: assetId,
        reason: 'no_base_revenue',
        excludedNetRevenue: successorUpgradeNetRevenue,
      })
      continue
    }

    eligibleAssets.push({
      id: assetId,
      baseNetRevenue,
      successorUpgradeNetRevenue,
      royaltyAmount: roundMoney(baseNetRevenue * royaltyRate),
    })
  }

  const inheritedBaseNetRevenue = sumMoney(eligibleAssets.map((asset) => asset.baseNetRevenue))
  const successorUpgradeNetRevenue = sumMoney(eligibleAssets.map((asset) => asset.successorUpgradeNetRevenue))
  const excludedNetRevenue = sumMoney(excludedAssets.map((asset) => asset.excludedNetRevenue))
  const modeledRoyaltyAmount = sumMoney(eligibleAssets.map((asset) => asset.royaltyAmount))
  const sourceAssetIds = eligibleAssets.map((asset) => asset.id)

  return {
    enabled: false,
    payoutEnabled: false,
    replacementWorkflowEnabled: false,
    waitlistHandoffEnabled: false,
    manualReviewRequired: true,
    appliesTo: 'inherited_founder_created_base_value_only',
    royaltyRate,
    treasuryAccountId,
    previousFounderCitizenId,
    successorCitizenId,
    eligibleAssets,
    excludedAssets,
    totals: {
      inheritedBaseNetRevenue,
      successorUpgradeNetRevenue,
      excludedNetRevenue,
      modeledRoyaltyAmount,
    },
    ledgerDraft: modeledRoyaltyAmount > 0
      ? {
        kind: 'founder_legacy_royalty',
        executionEnabled: false,
        payoutEnabled: false,
        payerCitizenId: successorCitizenId,
        receiverAccountId: treasuryAccountId,
        previousFounderCitizenId,
        amount: modeledRoyaltyAmount,
        royaltyRate,
        sourceAssetIds,
        blockers: LEGACY_ROYALTY_BLOCKERS,
      }
      : null,
    blockers: LEGACY_ROYALTY_BLOCKERS,
  }
}

function normalizedRoyaltyRate(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE
  return roundMoney(Math.min(1, Math.max(0, value)))
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0))
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
