import { describe, expect, test } from 'vitest'
import {
  DEFAULT_CITY_SALES_TAX_RATE,
  DEFAULT_PEER_TRADE_PLATFORM_FEE_RATE,
  PEER_TRADE_PLATFORM_FEE_ACCOUNT_ID,
  assessPeerTradeSettlementPolicy,
} from './peerTrade'

describe('peer trade settlement policy', () => {
  test('keeps marketplace, escrow, settlement, and on-chain execution disabled by default', () => {
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: 'buyer-1',
      sellerCitizenId: 'seller-1',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      marketplaceEnabled: false,
      escrowEnabled: false,
      settlementEnabled: false,
      onchainExecutionEnabled: false,
      manualReviewRequired: true,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      buyerCitizenId: 'buyer-1',
      sellerCitizenId: 'seller-1',
      listingId: null,
      itemId: null,
      price: 0,
      buyerAvailableFunds: 0,
      sellerOwnsItem: false,
      marketplaceReady: false,
      complianceApproved: false,
      manualTradeApproved: false,
      platformFeeReceiverId: PEER_TRADE_PLATFORM_FEE_ACCOUNT_ID,
      platformFeeRate: DEFAULT_PEER_TRADE_PLATFORM_FEE_RATE,
      cityTreasuryAccountId: null,
      citySalesTaxRate: 0,
      citySalesTaxAmount: 0,
      sellerReceivesAmount: 0,
      buyerPaysAmount: 0,
      readyForManualReview: false,
      draft: null,
    })
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'escrow_disabled',
      'settlement_disabled',
      'onchain_execution_disabled',
      'marketplace_readiness_required',
      'listing_required',
      'item_required',
      'positive_price_required',
      'seller_inventory_required',
      'buyer_funds_required',
      'compliance_review_required',
      'manual_trade_review_required',
    ])
  })

  test('drafts disabled settlement with platform fee and city tax when review-ready', () => {
    const settledAt = 1_783_303_200_000
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: ' buyer-1 ',
      sellerCitizenId: ' seller-1 ',
      listingId: ' listing-1 ',
      itemId: ' item-water-filter ',
      price: 1_000,
      buyerAvailableFunds: 1_050,
      sellerOwnsItem: true,
      marketplaceReady: true,
      complianceApproved: true,
      manualTradeApproved: false,
      platformFeeRate: 0.03,
      citySalesTaxRate: 0.02,
      cityTreasuryAccountId: ' treasury:area-1 ',
      settledAt,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.draft).toEqual({
      kind: 'peer_trade_settlement',
      executionEnabled: false,
      marketplaceEnabled: false,
      escrowEnabled: false,
      settlementEnabled: false,
      onchainExecutionEnabled: false,
      sourceOfTruth: 'reality_server_ledger',
      currency: 'game_credits',
      buyerCitizenId: 'buyer-1',
      sellerCitizenId: 'seller-1',
      listingId: 'listing-1',
      itemId: 'item-water-filter',
      grossPrice: 1_000,
      platformFeeReceiverId: PEER_TRADE_PLATFORM_FEE_ACCOUNT_ID,
      platformFeeRate: 0.03,
      platformFeeAmount: 30,
      cityTreasuryAccountId: 'treasury:area-1',
      citySalesTaxRate: 0.02,
      citySalesTaxAmount: 20,
      sellerReceivesAmount: 970,
      buyerPaysAmount: 1_020,
      settledAt,
      blockers: [
        'marketplace_disabled',
        'escrow_disabled',
        'settlement_disabled',
        'onchain_execution_disabled',
        'manual_trade_review_required',
      ],
    })
  })

  test('keeps settlement disabled even after manual trade approval is modeled', () => {
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: 'buyer-1',
      sellerCitizenId: 'seller-1',
      listingId: 'listing-1',
      itemId: 'item-1',
      price: 100,
      buyerAvailableFunds: 100,
      sellerOwnsItem: true,
      marketplaceReady: true,
      complianceApproved: true,
      manualTradeApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(true)
    expect(assessment.citySalesTaxRate).toBe(DEFAULT_CITY_SALES_TAX_RATE)
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'escrow_disabled',
      'settlement_disabled',
      'onchain_execution_disabled',
    ])
    expect(assessment.draft).toMatchObject({
      executionEnabled: false,
      marketplaceEnabled: false,
      escrowEnabled: false,
      settlementEnabled: false,
      onchainExecutionEnabled: false,
      buyerPaysAmount: 100,
      sellerReceivesAmount: 97,
      blockers: [
        'marketplace_disabled',
        'escrow_disabled',
        'settlement_disabled',
        'onchain_execution_disabled',
      ],
    })
  })

  test('blocks self-trades and missing seller inventory', () => {
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: 'same-1',
      sellerCitizenId: 'same-1',
      listingId: 'listing-1',
      itemId: 'item-1',
      price: 100,
      buyerAvailableFunds: 200,
      sellerOwnsItem: false,
      marketplaceReady: true,
      complianceApproved: true,
      manualTradeApproved: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'escrow_disabled',
      'settlement_disabled',
      'onchain_execution_disabled',
      'buyer_seller_must_be_distinct',
      'seller_inventory_required',
    ])
  })

  test('requires buyer funds for gross price plus city tax', () => {
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: 'buyer-1',
      sellerCitizenId: 'seller-1',
      listingId: 'listing-1',
      itemId: 'item-1',
      price: 100,
      buyerAvailableFunds: 101,
      sellerOwnsItem: true,
      marketplaceReady: true,
      complianceApproved: true,
      manualTradeApproved: true,
      cityTreasuryAccountId: 'treasury:area-1',
      citySalesTaxRate: 0.02,
    })

    expect(assessment.buyerPaysAmount).toBe(102)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'escrow_disabled',
      'settlement_disabled',
      'onchain_execution_disabled',
      'buyer_funds_required',
    ])
  })

  test('normalizes invalid money, rates, account ids, and settlement time', () => {
    const assessment = assessPeerTradeSettlementPolicy({
      buyerCitizenId: ' ',
      sellerCitizenId: ' seller-1 ',
      listingId: ' ',
      itemId: ' ',
      price: Number.POSITIVE_INFINITY,
      buyerAvailableFunds: -1,
      sellerOwnsItem: true,
      marketplaceReady: true,
      complianceApproved: true,
      manualTradeApproved: true,
      platformFeeRate: 2,
      citySalesTaxRate: 0.005,
      cityTreasuryAccountId: ' ',
      platformFeeReceiverId: ' ',
      settledAt: -1,
    })

    expect(assessment.buyerCitizenId).toBe('')
    expect(assessment.sellerCitizenId).toBe('seller-1')
    expect(assessment.listingId).toBeNull()
    expect(assessment.itemId).toBeNull()
    expect(assessment.price).toBe(0)
    expect(assessment.buyerAvailableFunds).toBe(0)
    expect(assessment.platformFeeRate).toBe(1)
    expect(assessment.cityTreasuryAccountId).toBeNull()
    expect(assessment.citySalesTaxRate).toBe(0)
    expect(assessment.draft).toBeNull()
    expect(assessment.blockers).toEqual([
      'marketplace_disabled',
      'escrow_disabled',
      'settlement_disabled',
      'onchain_execution_disabled',
      'buyer_required',
      'listing_required',
      'item_required',
      'positive_price_required',
      'buyer_funds_required',
    ])
  })
})
