export type MarketplaceListingBlocker =
  | 'marketplace_disabled'
  | 'listing_creation_disabled'
  | 'inventory_reservation_disabled'
  | 'escrow_disabled'
  | 'server_authority_required'
  | 'seller_required'
  | 'server_listing_id_required'
  | 'item_required'
  | 'positive_quantity_required'
  | 'positive_unit_price_required'
  | 'inventory_proof_required'
  | 'available_inventory_required'
  | 'compliance_review_required'
  | 'manual_listing_review_required'

export interface MarketplaceListingPolicyInput {
  sellerCitizenId: string
  serverListingId?: string | null
  itemId?: string | null
  requestedQuantity?: number | null
  unitPrice?: number | null
  sellerInventoryQuantity?: number | null
  existingReservedQuantity?: number | null
  inventoryProofAvailable?: boolean
  serverAuthorityReady?: boolean
  complianceApproved?: boolean
  manualListingApproved?: boolean
  listedAt?: number | null
}

export interface MarketplaceListingDraft {
  kind: 'marketplace_listing_reservation'
  executionEnabled: false
  marketplaceEnabled: false
  listingCreationEnabled: false
  inventoryReservationEnabled: false
  escrowEnabled: false
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  sellerCitizenId: string
  listingId: string
  itemId: string
  requestedQuantity: number
  unitPrice: number
  totalListingPrice: number
  sellerInventoryQuantity: number
  existingReservedQuantity: number
  availableInventoryQuantity: number
  listedAt: number | null
  blockers: readonly MarketplaceListingBlocker[]
}

export interface MarketplaceListingPolicyAssessment {
  enabled: false
  marketplaceEnabled: false
  listingCreationEnabled: false
  inventoryReservationEnabled: false
  escrowEnabled: false
  manualReviewRequired: true
  sourceOfTruth: 'reality_server_ledger'
  currency: 'game_credits'
  sellerCitizenId: string
  serverListingId: string | null
  itemId: string | null
  requestedQuantity: number
  unitPrice: number
  totalListingPrice: number
  sellerInventoryQuantity: number
  existingReservedQuantity: number
  availableInventoryQuantity: number
  inventoryProofAvailable: boolean
  serverAuthorityReady: boolean
  complianceApproved: boolean
  manualListingApproved: boolean
  readyForManualReview: boolean
  draft: MarketplaceListingDraft | null
  blockers: readonly MarketplaceListingBlocker[]
}

const BASE_DISABLED_BLOCKERS: readonly MarketplaceListingBlocker[] = [
  'marketplace_disabled',
  'listing_creation_disabled',
  'inventory_reservation_disabled',
  'escrow_disabled',
]

export function assessMarketplaceListingPolicy(
  input: MarketplaceListingPolicyInput,
): MarketplaceListingPolicyAssessment {
  const sellerCitizenId = input.sellerCitizenId.trim()
  const serverListingId = input.serverListingId?.trim() || null
  const itemId = input.itemId?.trim() || null
  const requestedQuantity = positiveInteger(input.requestedQuantity ?? 0)
  const unitPrice = positiveMoney(input.unitPrice ?? 0)
  const sellerInventoryQuantity = positiveInteger(input.sellerInventoryQuantity ?? 0)
  const existingReservedQuantity = positiveInteger(input.existingReservedQuantity ?? 0)
  const availableInventoryQuantity = Math.max(0, sellerInventoryQuantity - existingReservedQuantity)
  const totalListingPrice = roundMoney(requestedQuantity * unitPrice)
  const inventoryProofAvailable = input.inventoryProofAvailable === true
  const serverAuthorityReady = input.serverAuthorityReady === true
  const complianceApproved = input.complianceApproved === true
  const manualListingApproved = input.manualListingApproved === true

  const readinessBlockers: MarketplaceListingBlocker[] = []
  if (!serverAuthorityReady) readinessBlockers.push('server_authority_required')
  if (!sellerCitizenId) readinessBlockers.push('seller_required')
  if (!serverListingId) readinessBlockers.push('server_listing_id_required')
  if (!itemId) readinessBlockers.push('item_required')
  if (requestedQuantity <= 0) readinessBlockers.push('positive_quantity_required')
  if (unitPrice <= 0) readinessBlockers.push('positive_unit_price_required')
  if (!inventoryProofAvailable) readinessBlockers.push('inventory_proof_required')
  if (requestedQuantity <= 0 || availableInventoryQuantity < requestedQuantity) {
    readinessBlockers.push('available_inventory_required')
  }
  if (!complianceApproved) readinessBlockers.push('compliance_review_required')
  if (!manualListingApproved) readinessBlockers.push('manual_listing_review_required')

  const readyForManualReview = readinessBlockers.every((blocker) => blocker === 'manual_listing_review_required')
  const blockers = uniqueBlockers([...BASE_DISABLED_BLOCKERS, ...readinessBlockers])

  return {
    enabled: false,
    marketplaceEnabled: false,
    listingCreationEnabled: false,
    inventoryReservationEnabled: false,
    escrowEnabled: false,
    manualReviewRequired: true,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    sellerCitizenId,
    serverListingId,
    itemId,
    requestedQuantity,
    unitPrice,
    totalListingPrice,
    sellerInventoryQuantity,
    existingReservedQuantity,
    availableInventoryQuantity,
    inventoryProofAvailable,
    serverAuthorityReady,
    complianceApproved,
    manualListingApproved,
    readyForManualReview,
    draft: readyForManualReview && sellerCitizenId && serverListingId && itemId
      ? marketplaceListingDraft({
        sellerCitizenId,
        serverListingId,
        itemId,
        requestedQuantity,
        unitPrice,
        totalListingPrice,
        sellerInventoryQuantity,
        existingReservedQuantity,
        availableInventoryQuantity,
        listedAt: normalizedInstant(input.listedAt ?? null),
        blockers,
      })
      : null,
    blockers,
  }
}

function marketplaceListingDraft(input: {
  sellerCitizenId: string
  serverListingId: string
  itemId: string
  requestedQuantity: number
  unitPrice: number
  totalListingPrice: number
  sellerInventoryQuantity: number
  existingReservedQuantity: number
  availableInventoryQuantity: number
  listedAt: number | null
  blockers: readonly MarketplaceListingBlocker[]
}): MarketplaceListingDraft {
  return {
    kind: 'marketplace_listing_reservation',
    executionEnabled: false,
    marketplaceEnabled: false,
    listingCreationEnabled: false,
    inventoryReservationEnabled: false,
    escrowEnabled: false,
    sourceOfTruth: 'reality_server_ledger',
    currency: 'game_credits',
    sellerCitizenId: input.sellerCitizenId,
    listingId: input.serverListingId,
    itemId: input.itemId,
    requestedQuantity: input.requestedQuantity,
    unitPrice: input.unitPrice,
    totalListingPrice: input.totalListingPrice,
    sellerInventoryQuantity: input.sellerInventoryQuantity,
    existingReservedQuantity: input.existingReservedQuantity,
    availableInventoryQuantity: input.availableInventoryQuantity,
    listedAt: input.listedAt,
    blockers: input.blockers,
  }
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function positiveMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(value)
}

function normalizedInstant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return value
}

function uniqueBlockers(blockers: readonly MarketplaceListingBlocker[]): MarketplaceListingBlocker[] {
  return [...new Set(blockers)]
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
