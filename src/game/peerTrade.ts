export type PeerTradeBlocker =
  | 'marketplace_disabled'
  | 'escrow_disabled'
  | 'settlement_disabled'
  | 'onchain_execution_disabled'
  | 'marketplace_readiness_required'
  | 'buyer_required'
  | 'seller_required'
  | 'buyer_seller_must_be_distinct'
  | 'listing_required'
  | 'item_required'
  | 'positive_price_required'
  | 'seller_inventory_required'
  | 'buyer_funds_required'
  | 'compliance_review_required'
  | 'manual_trade_review_required'

export interface PeerTradeSettlementPolicyInput {
  buyerCitizenId: string
  sellerCitizenId: string
  listingId?: string | null
  itemId?: string | null
  price?: number | null
  buyerAvailableFunds?: number | null
  sellerOwnsItem?: boolean
  marketplaceReady?: boolean
  complianceApproved?: boolean
  manualTradeApproved?: boolean
  platformFeeRate?: number | null
  citySalesTaxRate?: number | null
  platformFeeReceiverId?: string | null
  cityTreasuryAccountId?: string | null
  settledAt?: number | null
}

export interface PeerTradeSettlementDraft {
  kind: 'peer_trade_settlement'
  executionEnabled: false
  marketplaceEnabled: false
  escrowEnabled: false
  settlementEnabled: false
  onchainExecutionEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  buyerCitizenId: string
  sellerCitizenId: string
  listingId: string
  itemId: string
  grossPrice: number
  platformFeeReceiverId: string
  platformFeeRate: number
  platformFeeAmount: number
  cityTreasuryAccountId: string | null
  citySalesTaxRate: number
  citySalesTaxAmount: number
  sellerReceivesAmount: number
  buyerPaysAmount: number
  settledAt: number | null
  blockers: readonly PeerTradeBlocker[]
}

export interface PeerTradeSettlementPolicyAssessment {
  enabled: false
  marketplaceEnabled: false
  escrowEnabled: false
  settlementEnabled: false
  onchainExecutionEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  buyerCitizenId: string
  sellerCitizenId: string
  listingId: string | null
  itemId: string | null
  price: number
  buyerAvailableFunds: number
  sellerOwnsItem: boolean
  marketplaceReady: boolean
  complianceApproved: boolean
  manualTradeApproved: boolean
  platformFeeReceiverId: string
  platformFeeRate: number
  platformFeeAmount: number
  cityTreasuryAccountId: string | null
  citySalesTaxRate: number
  citySalesTaxAmount: number
  sellerReceivesAmount: number
  buyerPaysAmount: number
  readyForManualReview: boolean
  draft: PeerTradeSettlementDraft | null
  blockers: readonly PeerTradeBlocker[]
}

export const DEFAULT_PEER_TRADE_PLATFORM_FEE_RATE = 0.03
export const DEFAULT_CITY_SALES_TAX_RATE = 0
export const PEER_TRADE_PLATFORM_FEE_ACCOUNT_ID = 'system:reality-platform-fees'

const BASE_DISABLED_BLOCKERS: readonly PeerTradeBlocker[] = [
  'marketplace_disabled',
  'escrow_disabled',
  'settlement_disabled',
  'onchain_execution_disabled',
]

export function assessPeerTradeSettlementPolicy(
  input: PeerTradeSettlementPolicyInput,
): PeerTradeSettlementPolicyAssessment {
  const buyerCitizenId = input.buyerCitizenId.trim()
  const sellerCitizenId = input.sellerCitizenId.trim()
  const listingId = input.listingId?.trim() || null
  const itemId = input.itemId?.trim() || null
  const price = positiveMoney(input.price ?? 0)
  const buyerAvailableFunds = positiveMoney(input.buyerAvailableFunds ?? 0)
  const sellerOwnsItem = input.sellerOwnsItem === true
  const marketplaceReady = input.marketplaceReady === true
  const complianceApproved = input.complianceApproved === true
  const manualTradeApproved = input.manualTradeApproved === true
  const platformFeeReceiverId = input.platformFeeReceiverId?.trim() || PEER_TRADE_PLATFORM_FEE_ACCOUNT_ID
  const platformFeeRate = normalizedRate(input.platformFeeRate, DEFAULT_PEER_TRADE_PLATFORM_FEE_RATE)
  const cityTreasuryAccountId = input.cityTreasuryAccountId?.trim() || null
  const citySalesTaxRate = cityTreasuryAccountId
    ? normalizedRate(input.citySalesTaxRate, DEFAULT_CITY_SALES_TAX_RATE)
    : 0
  const platformFeeAmount = roundMoney(price * platformFeeRate)
  const citySalesTaxAmount = roundMoney(price * citySalesTaxRate)
  const sellerReceivesAmount = roundMoney(Math.max(0, price - platformFeeAmount))
  const buyerPaysAmount = roundMoney(price + citySalesTaxAmount)

  const readinessBlockers: PeerTradeBlocker[] = []
  if (!marketplaceReady) readinessBlockers.push('marketplace_readiness_required')
  if (!buyerCitizenId) readinessBlockers.push('buyer_required')
  if (!sellerCitizenId) readinessBlockers.push('seller_required')
  if (buyerCitizenId && sellerCitizenId && buyerCitizenId === sellerCitizenId) {
    readinessBlockers.push('buyer_seller_must_be_distinct')
  }
  if (!listingId) readinessBlockers.push('listing_required')
  if (!itemId) readinessBlockers.push('item_required')
  if (price <= 0) readinessBlockers.push('positive_price_required')
  if (!sellerOwnsItem) readinessBlockers.push('seller_inventory_required')
  if (buyerAvailableFunds < buyerPaysAmount || buyerPaysAmount <= 0) readinessBlockers.push('buyer_funds_required')
  if (!complianceApproved) readinessBlockers.push('compliance_review_required')
  if (!manualTradeApproved) readinessBlockers.push('manual_trade_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_trade_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    marketplaceEnabled: false,
    escrowEnabled: false,
    settlementEnabled: false,
    onchainExecutionEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    buyerCitizenId,
    sellerCitizenId,
    listingId,
    itemId,
    price,
    buyerAvailableFunds,
    sellerOwnsItem,
    marketplaceReady,
    complianceApproved,
    manualTradeApproved,
    platformFeeReceiverId,
    platformFeeRate,
    platformFeeAmount,
    cityTreasuryAccountId,
    citySalesTaxRate,
    citySalesTaxAmount,
    sellerReceivesAmount,
    buyerPaysAmount,
    readyForManualReview,
    draft: readyForManualReview && listingId && itemId && buyerCitizenId && sellerCitizenId
      ? peerTradeSettlementDraft({
        buyerCitizenId,
        sellerCitizenId,
        listingId,
        itemId,
        price,
        platformFeeReceiverId,
        platformFeeRate,
        platformFeeAmount,
        cityTreasuryAccountId,
        citySalesTaxRate,
        citySalesTaxAmount,
        sellerReceivesAmount,
        buyerPaysAmount,
        settledAt: normalizedInstant(input.settledAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function peerTradeSettlementDraft(input: {
  buyerCitizenId: string
  sellerCitizenId: string
  listingId: string
  itemId: string
  price: number
  platformFeeReceiverId: string
  platformFeeRate: number
  platformFeeAmount: number
  cityTreasuryAccountId: string | null
  citySalesTaxRate: number
  citySalesTaxAmount: number
  sellerReceivesAmount: number
  buyerPaysAmount: number
  settledAt: number | null
  blockers: readonly PeerTradeBlocker[]
}): PeerTradeSettlementDraft {
  return {
    kind: 'peer_trade_settlement',
    executionEnabled: false,
    marketplaceEnabled: false,
    escrowEnabled: false,
    settlementEnabled: false,
    onchainExecutionEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    buyerCitizenId: input.buyerCitizenId,
    sellerCitizenId: input.sellerCitizenId,
    listingId: input.listingId,
    itemId: input.itemId,
    grossPrice: input.price,
    platformFeeReceiverId: input.platformFeeReceiverId,
    platformFeeRate: input.platformFeeRate,
    platformFeeAmount: input.platformFeeAmount,
    cityTreasuryAccountId: input.cityTreasuryAccountId,
    citySalesTaxRate: input.citySalesTaxRate,
    citySalesTaxAmount: input.citySalesTaxAmount,
    sellerReceivesAmount: input.sellerReceivesAmount,
    buyerPaysAmount: input.buyerPaysAmount,
    settledAt: input.settledAt,
    blockers: input.blockers,
  }
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

function uniqueBlockers(blockers: readonly PeerTradeBlocker[]): PeerTradeBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}
