import { describe, expect, test } from 'vitest'
import {
  ASSET_INSERT_SQL,
  assetInsertParams,
  buildAssetRow,
  parseWorldPathname,
} from './world-migration-lib.mjs'

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'

describe('parseWorldPathname', () => {
  test('extracts the structured metadata encoded in the blob pathname', () => {
    expect(parseWorldPathname(`world/${CITIZEN_ID}/starter-home-1__small_home__home__44.45__26.08.json`)).toEqual({
      citizenId: CITIZEN_ID,
      assetId: 'starter-home-1',
      itemId: 'small_home',
      kind: 'home',
      lat: 44.45,
      lng: 26.08,
    })
  })

  test('handles negative coordinates and the business kind', () => {
    expect(parseWorldPathname(`world/${CITIZEN_ID}/shop-2__coffee_shop__business__-33.87__-70.65.json`)).toEqual({
      citizenId: CITIZEN_ID,
      assetId: 'shop-2',
      itemId: 'coffee_shop',
      kind: 'business',
      lat: -33.87,
      lng: -70.65,
    })
  })

  test('rejects pathnames that do not match the scheme', () => {
    expect(parseWorldPathname(`world/${CITIZEN_ID}/garbage.json`)).toBeNull()
    expect(parseWorldPathname('world/not-a-uuid/a__b__home__1__2.json')).toBeNull()
    expect(parseWorldPathname(`world/${CITIZEN_ID}/a__b__castle__1__2.json`)).toBeNull()
    expect(parseWorldPathname('worldrate/x__2026-07-10__1.json')).toBeNull()
  })
})

describe('buildAssetRow', () => {
  const parsed = {
    citizenId: CITIZEN_ID,
    assetId: 'starter-home-1',
    itemId: 'small_home',
    kind: 'home',
    lat: 44.45,
    lng: 26.08,
  }

  test('shapes an insert-ready row, stamping placed_at from the blob upload time', () => {
    const uploadedAt = new Date('2026-07-03T22:00:00.000Z')
    expect(buildAssetRow(parsed, uploadedAt)).toEqual({
      ...parsed,
      placedAt: '2026-07-03T22:00:00.000Z',
    })
  })

  test('insert statement is idempotent (ON CONFLICT DO NOTHING) so re-runs never clobber newer dual-writes', () => {
    expect(ASSET_INSERT_SQL).toMatch(/INSERT INTO assets/i)
    // Composite conflict target: asset ids are only unique per citizen
    expect(ASSET_INSERT_SQL).toMatch(/ON CONFLICT \(citizen_id, asset_id\) DO NOTHING/i)
  })

  test('params line up with the insert statement columns', () => {
    const row = buildAssetRow(parsed, new Date('2026-07-03T22:00:00.000Z'))
    expect(assetInsertParams(row)).toEqual([
      'starter-home-1',
      CITIZEN_ID,
      'small_home',
      'home',
      44.45,
      26.08,
      '2026-07-03T22:00:00.000Z',
    ])
  })
})
