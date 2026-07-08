import { describe, expect, test } from 'vitest'
import { assessMarketplaceListingPolicy } from './marketplaceListing'

describe('marketplace listing policy', () => {
  test('keeps marketplace listing, inventory reservation, and escrow disabled by default', () => {
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: 'seller-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      marketplaceEnabled: false,
      listingCreationEnabled: false,
      inventoryReservationEnabled: false,
      escrowEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      sellerCitizenId: 'seller-1',
      serverListingId: null,
      itemId: null,
      requestedQuantity: 0,
      unitPrice: 0,
      totalListingPrice: 0,
      sellerInventoryQuantity: 0,
      existingReservedQuantity: 0,
      availableInventoryQuantity: 0,
      inventoryProofAvailable: false,
      serverAuthorityReady: false,
      complianceApproved: false,
      manualListingApproved: false,
      readyForManualReview: false,
      draft: null,
    })
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'listing_creation_disabled',
      'inventory_reservation_disabled',
      'escrow_disabled',
      'server_authority_required',
      'server_listing_id_required',
      'item_required',
      'positive_quantity_required',
      'positive_unit_price_required',
      'inventory_proof_required',
      'available_inventory_required',
      'compliance_review_required',
      'manual_listing_review_required',
    ])
  })

  test('drafts disabled inventory-backed listing reservation when review-ready', () => {
    const listedAt = 1_783_303_200_000
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: ' seller-1 ',
      serverListingId: ' listing-1 ',
      itemId: ' water-filter ',
      requestedQuantity: 3,
      unitPrice: 125.5,
      sellerInventoryQuantity: 5,
      existingReservedQuantity: 1,
      inventoryProofAvailable: true,
      serverAuthorityReady: true,
      complianceApproved: true,
      manualListingApproved: false,
      listedAt,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.draft).toEqual({
      kind: 'marketplace_listing_reservation',
      executionEnabled: false,
      marketplaceEnabled: false,
      listingCreationEnabled: false,
      inventoryReservationEnabled: false,
      escrowEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      sellerCitizenId: 'seller-1',
      listingId: 'listing-1',
      itemId: 'water-filter',
      requestedQuantity: 3,
      unitPrice: 125.5,
      totalListingPrice: 376.5,
      sellerInventoryQuantity: 5,
      existingReservedQuantity: 1,
      availableInventoryQuantity: 4,
      listedAt,
      blockers: [
        'marketplace_disabled',
        'listing_creation_disabled',
        'inventory_reservation_disabled',
        'escrow_disabled',
        'manual_listing_review_required',
      ],
    })
  })

  test('keeps listing reservation disabled even after manual approval is modeled', () => {
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: 'seller-1',
      serverListingId: 'listing-1',
      itemId: 'item-1',
      requestedQuantity: 1,
      unitPrice: 50,
      sellerInventoryQuantity: 1,
      inventoryProofAvailable: true,
      serverAuthorityReady: true,
      complianceApproved: true,
      manualListingApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'listing_creation_disabled',
      'inventory_reservation_disabled',
      'escrow_disabled',
    ])
    expect(assessment.draft).toMatchObject({
      executionEnabled: false,
      marketplaceEnabled: false,
      listingCreationEnabled: false,
      inventoryReservationEnabled: false,
      escrowEnabled: false,
      totalListingPrice: 50,
      blockers: [
        'marketplace_disabled',
        'listing_creation_disabled',
        'inventory_reservation_disabled',
        'escrow_disabled',
      ],
    })
  })

  test('blocks listing quantities that exceed unreserved seller inventory', () => {
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: 'seller-1',
      serverListingId: 'listing-1',
      itemId: 'item-1',
      requestedQuantity: 3,
      unitPrice: 20,
      sellerInventoryQuantity: 4,
      existingReservedQuantity: 2,
      inventoryProofAvailable: true,
      serverAuthorityReady: true,
      complianceApproved: true,
      manualListingApproved: true,
    })

    expect(assessment.availableInventoryQuantity).toBe(2)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'listing_creation_disabled',
      'inventory_reservation_disabled',
      'escrow_disabled',
      'available_inventory_required',
    ])
  })

  test('requires server authority, seller identity, listing id, item id, price, and inventory proof', () => {
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: ' ',
      serverListingId: ' ',
      itemId: ' ',
      requestedQuantity: 2,
      unitPrice: 10,
      sellerInventoryQuantity: 3,
      inventoryProofAvailable: false,
      serverAuthorityReady: false,
      complianceApproved: true,
      manualListingApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'listing_creation_disabled',
      'inventory_reservation_disabled',
      'escrow_disabled',
      'server_authority_required',
      'seller_required',
      'server_listing_id_required',
      'item_required',
      'inventory_proof_required',
    ])
  })

  test('normalizes malformed quantities, prices, and timestamps without creating a draft', () => {
    const assessment = assessMarketplaceListingPolicy({
      sellerCitizenId: ' seller-1 ',
      serverListingId: ' listing-1 ',
      itemId: ' item-1 ',
      requestedQuantity: 2.9,
      unitPrice: Number.POSITIVE_INFINITY,
      sellerInventoryQuantity: 5.8,
      existingReservedQuantity: Number.NaN,
      inventoryProofAvailable: true,
      serverAuthorityReady: true,
      complianceApproved: true,
      manualListingApproved: true,
      listedAt: -1,
    })

    expect(assessment.requestedQuantity).toBe(2)
    expect(assessment.unitPrice).toBe(0)
    expect(assessment.sellerInventoryQuantity).toBe(5)
    expect(assessment.existingReservedQuantity).toBe(0)
    expect(assessment.availableInventoryQuantity).toBe(5)
    expect(assessment.totalListingPrice).toBe(0)
    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'listing_creation_disabled',
      'inventory_reservation_disabled',
      'escrow_disabled',
      'positive_unit_price_required',
    ])
  })
})
