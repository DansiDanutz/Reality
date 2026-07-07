import { describe, expect, test } from 'vitest'
import {
  rollbackRejectedWorldPlacement,
  settleWorldPlacementResponse,
  type WorldPlacementDailyCounters,
} from './worldPlacementSettlement'

const previousCounters: WorldPlacementDailyCounters = {
  mealsToday: 1,
  shiftsToday: 0,
  earnedToday: 0,
  sleptToday: 0,
  boughtToday: 2,
  day: 10,
}
const optimisticCounters: WorldPlacementDailyCounters = {
  ...previousCounters,
  boughtToday: 3,
}
const item = { id: 'water-kiosk', name: 'Water Kiosk', price: 1200 }
const otherItem = { id: 'food-stand', name: 'Food Stand', price: 1800 }
const asset = { id: 'water-kiosk-1', itemId: 'water-kiosk' }

describe('world placement server settlement', () => {
  test('treats accepted and offline responses as non-rejections', () => {
    expect(settleWorldPlacementResponse({ ok: true })).toEqual({ kind: 'accepted' })
    expect(settleWorldPlacementResponse({ ok: true, assetId: 'a1' })).toEqual({ kind: 'accepted' })
    expect(settleWorldPlacementResponse(null)).toEqual({ kind: 'offline_unverified' })
  })

  test('maps claimed-area server rejections to player-facing messages', () => {
    expect(settleWorldPlacementResponse({ ok: false, code: 'area_not_claimed' })).toEqual({
      kind: 'rejected',
      code: 'area_not_claimed',
      message: 'Claim your founder area before placing shared-world assets.',
    })
    expect(settleWorldPlacementResponse({ ok: false, code: 'placement_outside_area' })).toEqual({
      kind: 'rejected',
      code: 'placement_outside_area',
      message: 'Place this asset inside your claimed founder area.',
    })
    expect(settleWorldPlacementResponse({ ok: false, code: 'area_owner_mismatch' })).toEqual({
      kind: 'rejected',
      code: 'area_owner_mismatch',
      message: 'This claimed area belongs to another founder.',
    })
    expect(settleWorldPlacementResponse({ ok: false, code: 'area_claim_invalid' })).toEqual({
      kind: 'rejected',
      code: 'area_claim_invalid',
      message: 'Your founder area claim needs manual review before placement.',
    })
  })

  test('maps legacy world API errors without codes', () => {
    expect(settleWorldPlacementResponse({ ok: false, error: 'Not a registered citizen.' })).toMatchObject({
      kind: 'rejected',
      code: 'not_registered',
    })
    expect(settleWorldPlacementResponse({ ok: false, error: 'Invalid asset.' })).toMatchObject({
      kind: 'rejected',
      code: 'invalid_asset',
    })
    expect(settleWorldPlacementResponse({ ok: false, error: 'The world is briefly unavailable.' })).toMatchObject({
      kind: 'rejected',
      code: 'world_unavailable',
    })
    expect(settleWorldPlacementResponse({ ok: false, error: 'Nope.' })).toMatchObject({
      kind: 'rejected',
      code: 'server_rejected',
    })
  })

  test('rolls rejected placement back into placement mode without refund when no newer placement exists', () => {
    const rejection = settleWorldPlacementResponse({ ok: false, code: 'placement_outside_area' })
    if (rejection.kind !== 'rejected') throw new Error('expected rejection')

    const rolledBack = rollbackRejectedWorldPlacement({
      assets: [asset],
      placing: null,
      item,
      assetId: asset.id,
      dailyCounters: optimisticCounters,
      previousDailyCounters: previousCounters,
      optimisticDailyCounters: optimisticCounters,
      rejection,
    })

    expect(rolledBack).toEqual({
      assets: [],
      placing: item,
      dailyCounters: previousCounters,
      refund: 0,
      message: 'Place this asset inside your claimed founder area.',
      changed: true,
    })
  })

  test('refunds instead of clobbering a newer placement in progress', () => {
    const rejection = settleWorldPlacementResponse({ ok: false, code: 'area_not_claimed' })
    if (rejection.kind !== 'rejected') throw new Error('expected rejection')

    const rolledBack = rollbackRejectedWorldPlacement({
      assets: [asset],
      placing: otherItem,
      item,
      assetId: asset.id,
      dailyCounters: optimisticCounters,
      previousDailyCounters: previousCounters,
      optimisticDailyCounters: optimisticCounters,
      rejection,
    })

    expect(rolledBack.assets).toEqual([])
    expect(rolledBack.placing).toBe(otherItem)
    expect(rolledBack.refund).toBe(item.price)
    expect(rolledBack.dailyCounters).toBe(previousCounters)
  })

  test('does not rewind daily counters after later player progress changes them', () => {
    const rejection = settleWorldPlacementResponse({ ok: false, code: 'area_not_claimed' })
    if (rejection.kind !== 'rejected') throw new Error('expected rejection')
    const laterCounters = { ...optimisticCounters, mealsToday: 2 }

    const rolledBack = rollbackRejectedWorldPlacement({
      assets: [asset],
      placing: null,
      item,
      assetId: asset.id,
      dailyCounters: laterCounters,
      previousDailyCounters: previousCounters,
      optimisticDailyCounters: optimisticCounters,
      rejection,
    })

    expect(rolledBack.dailyCounters).toBe(laterCounters)
  })

  test('ignores stale rejections after the optimistic asset is already gone', () => {
    const rejection = settleWorldPlacementResponse({ ok: false, code: 'area_not_claimed' })
    if (rejection.kind !== 'rejected') throw new Error('expected rejection')

    const rolledBack = rollbackRejectedWorldPlacement({
      assets: [],
      placing: null,
      item,
      assetId: asset.id,
      dailyCounters: optimisticCounters,
      previousDailyCounters: previousCounters,
      optimisticDailyCounters: optimisticCounters,
      rejection,
    })

    expect(rolledBack).toEqual({
      assets: [],
      placing: null,
      dailyCounters: optimisticCounters,
      refund: 0,
      message: 'Claim your founder area before placing shared-world assets.',
      changed: false,
    })
  })
})
