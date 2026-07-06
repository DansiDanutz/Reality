import { describe, expect, test } from 'vitest'
import { DEFAULT_MAP_ANCHOR, playableMapAnchorFor } from './mapAnchor'
import type { Citizen, PlacedAsset } from './types'

const citizen: Citizen = {
  name: 'Ada',
  founderNumber: 1,
  createdAt: 1_783_303_200_000,
}

describe('playableMapAnchorFor', () => {
  test('waits until a citizen exists', () => {
    expect(playableMapAnchorFor(null, [])).toBeNull()
  })

  test('uses a fallback anchor for citizens without detected spawn coordinates', () => {
    expect(playableMapAnchorFor(citizen, [])).toEqual(DEFAULT_MAP_ANCHOR)
  })

  test('prefers the detected spawn before the fallback anchor', () => {
    expect(playableMapAnchorFor({ ...citizen, spawnLat: 45.7, spawnLng: 21.2 }, [])).toEqual({
      lat: 45.7,
      lng: 21.2,
    })
  })

  test('prefers an owned home over spawn coordinates', () => {
    const assets: PlacedAsset[] = [{
      id: 'home-1',
      itemId: 'microstudio',
      kind: 'home',
      name: 'Starter House',
      lat: 44.9,
      lng: 26.3,
      incomePerDay: 0,
      pendingIncome: 0,
      placedAtMinute: 0,
    }]
    expect(playableMapAnchorFor({ ...citizen, spawnLat: 45.7, spawnLng: 21.2 }, assets)).toEqual({
      lat: 44.9,
      lng: 26.3,
    })
  })
})
