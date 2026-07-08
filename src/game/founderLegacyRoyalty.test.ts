import { describe, expect, test } from 'vitest'
import {
  DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE,
  FOUNDER_LEGACY_TREASURY_ACCOUNT_ID,
  assessFounderLegacyRoyalty,
} from './founderLegacyRoyalty'

describe('founder legacy royalty policy', () => {
  test('models inherited founder-created base value without enabling payout execution', () => {
    const assessment = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      assets: [{
        id: 'business-water',
        currentOwnerCitizenId: 'founder-new',
        createdByCitizenId: 'founder-old',
        periodBaseNetRevenue: 1_000,
      }],
    })

    expect(assessment).toMatchObject({
      enabled: false,
      payoutEnabled: false,
      replacementWorkflowEnabled: false,
      waitlistHandoffEnabled: false,
      manualReviewRequired: true,
      appliesTo: 'inherited_founder_created_base_value_only',
      royaltyRate: DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE,
      treasuryAccountId: FOUNDER_LEGACY_TREASURY_ACCOUNT_ID,
      totals: {
        inheritedBaseNetRevenue: 1_000,
        successorUpgradeNetRevenue: 0,
        excludedNetRevenue: 0,
        modeledRoyaltyAmount: 100,
      },
    })
    expect(assessment.ledgerDraft).toEqual({
      kind: 'founder_legacy_royalty',
      executionEnabled: false,
      payoutEnabled: false,
      payerCitizenId: 'founder-new',
      receiverAccountId: FOUNDER_LEGACY_TREASURY_ACCOUNT_ID,
      previousFounderCitizenId: 'founder-old',
      amount: 100,
      royaltyRate: DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE,
      sourceAssetIds: ['business-water'],
      blockers: [
        'replacement_workflow_disabled',
        'waitlist_handoff_disabled',
        'treasury_payout_disabled',
        'manual_review_required',
        'compliance_review_required',
      ],
    })
  })

  test('excludes successor-created assets from the predecessor royalty pool', () => {
    const assessment = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      assets: [{
        id: 'business-food',
        currentOwnerCitizenId: 'founder-new',
        createdByCitizenId: 'founder-new',
        periodBaseNetRevenue: 700,
      }],
    })

    expect(assessment.eligibleAssets).toEqual([])
    expect(assessment.excludedAssets).toEqual([{
      id: 'business-food',
      reason: 'successor_created_asset',
      excludedNetRevenue: 700,
    }])
    expect(assessment.totals.modeledRoyaltyAmount).toBe(0)
    expect(assessment.ledgerDraft).toBeNull()
  })

  test('separates successor upgrade revenue from inherited base revenue', () => {
    const assessment = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      royaltyRate: 0.15,
      assets: [{
        id: 'business-clinic',
        currentOwnerCitizenId: 'founder-new',
        createdByCitizenId: 'founder-old',
        periodBaseNetRevenue: 800,
        periodSuccessorUpgradeNetRevenue: 450,
      }],
    })

    expect(assessment.eligibleAssets).toEqual([{
      id: 'business-clinic',
      baseNetRevenue: 800,
      successorUpgradeNetRevenue: 450,
      royaltyAmount: 120,
    }])
    expect(assessment.totals).toEqual({
      inheritedBaseNetRevenue: 800,
      successorUpgradeNetRevenue: 450,
      excludedNetRevenue: 0,
      modeledRoyaltyAmount: 120,
    })
    expect(assessment.ledgerDraft?.amount).toBe(120)
  })

  test('keeps custom treasury receivers distinct from founder identities', () => {
    const inheritedAsset = {
      id: 'business-water',
      currentOwnerCitizenId: 'founder-new',
      createdByCitizenId: 'founder-old',
      periodBaseNetRevenue: 1_000,
    }

    const successorTreasury = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      treasuryAccountId: ' founder-new ',
      assets: [inheritedAsset],
    })
    const previousFounderTreasury = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      treasuryAccountId: 'founder-old',
      assets: [inheritedAsset],
    })
    const externalTreasury = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      treasuryAccountId: 'system:community-treasury',
      assets: [inheritedAsset],
    })

    expect(successorTreasury.treasuryAccountId).toBe(FOUNDER_LEGACY_TREASURY_ACCOUNT_ID)
    expect(successorTreasury.ledgerDraft?.receiverAccountId).toBe(FOUNDER_LEGACY_TREASURY_ACCOUNT_ID)
    expect(previousFounderTreasury.treasuryAccountId).toBe(FOUNDER_LEGACY_TREASURY_ACCOUNT_ID)
    expect(previousFounderTreasury.ledgerDraft?.receiverAccountId).toBe(FOUNDER_LEGACY_TREASURY_ACCOUNT_ID)
    expect(externalTreasury.treasuryAccountId).toBe('system:community-treasury')
    expect(externalTreasury.ledgerDraft?.receiverAccountId).toBe('system:community-treasury')
  })

  test('excludes assets that are not owned by the successor or not created by the previous founder', () => {
    const assessment = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      assets: [{
        id: 'business-other-owner',
        currentOwnerCitizenId: 'operator-1',
        createdByCitizenId: 'founder-old',
        periodBaseNetRevenue: 300,
      }, {
        id: 'business-third-founder',
        currentOwnerCitizenId: 'founder-new',
        createdByCitizenId: 'founder-third',
        periodBaseNetRevenue: 200,
      }],
    })

    expect(assessment.excludedAssets).toEqual([{
      id: 'business-other-owner',
      reason: 'not_owned_by_successor',
      excludedNetRevenue: 300,
    }, {
      id: 'business-third-founder',
      reason: 'not_created_by_previous_founder',
      excludedNetRevenue: 200,
    }])
    expect(assessment.ledgerDraft).toBeNull()
  })

  test('normalizes invalid money and royalty rates without creating executable drafts', () => {
    const assessment = assessFounderLegacyRoyalty({
      previousFounderCitizenId: 'founder-old',
      successorCitizenId: 'founder-new',
      royaltyRate: Number.POSITIVE_INFINITY,
      treasuryAccountId: '  ',
      assets: [{
        id: 'business-negative',
        currentOwnerCitizenId: 'founder-new',
        createdByCitizenId: 'founder-old',
        periodBaseNetRevenue: -10,
        periodSuccessorUpgradeNetRevenue: 25.555,
      }],
    })

    expect(assessment.royaltyRate).toBe(DEFAULT_FOUNDER_LEGACY_ROYALTY_RATE)
    expect(assessment.treasuryAccountId).toBe(FOUNDER_LEGACY_TREASURY_ACCOUNT_ID)
    expect(assessment.excludedAssets).toEqual([{
      id: 'business-negative',
      reason: 'no_base_revenue',
      excludedNetRevenue: 25.56,
    }])
    expect(assessment.ledgerDraft).toBeNull()
  })
})
