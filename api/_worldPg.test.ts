import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  WORLD_PLACE_SQL,
  assetRowFromPlacement,
  placementsTodayPg,
  writeWorldPlacement,
} from './_worldPg'

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const PLACED_AT = new Date('2026-07-10T09:00:00.000Z')

function placement() {
  return assetRowFromPlacement({
    citizenId: CITIZEN_ID,
    assetId: 'starter-home-1',
    itemId: 'small_home',
    kind: 'home',
    lat: 44.45,
    lng: 26.08,
    placedAt: PLACED_AT,
    price: 45_000,
    dailyLimit: 20,
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('assetRowFromPlacement', () => {
  test('shapes an assets-table row with structured columns', () => {
    expect(placement()).toEqual({
      assetId: 'starter-home-1',
      citizenId: CITIZEN_ID,
      itemId: 'small_home',
      kind: 'home',
      lat: 44.45,
      lng: 26.08,
      placedAt: PLACED_AT.toISOString(),
      price: 45_000,
      dailyLimit: 20,
    })
  })
})

describe('writeWorldPlacement (authoritative since Phase 1b.6)', () => {
  test('uses one atomic server charge, asset insert, and ledger entry', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ new_balance: '155000', refusal: null }])

    await writeWorldPlacement(placement())

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [placeSql, placeParams] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(placeSql).toBe(WORLD_PLACE_SQL)
    expect(placeParams).toEqual([
      CITIZEN_ID,
      'starter-home-1',
      'small_home',
      'home',
      44.45,
      26.08,
      45_000,
      JSON.stringify({ assetId: 'starter-home-1', itemId: 'small_home', kind: 'home', lat: 44.45, lng: 26.08, price: 45_000 }),
      PLACED_AT.toISOString(),
      20,
    ])
  })

  test('throws on failure — the handler owns the 500, there is no Blob to fall back to', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(writeWorldPlacement(placement())).rejects.toThrow('connection refused')
  })

  test('turns an insufficient-funds refusal into a deterministic error', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ new_balance: '10', refusal: 'insufficient_funds' }])
    await expect(writeWorldPlacement(placement())).rejects.toThrow('world_place_insufficient_funds')
  })

  test('turns an atomic daily-limit refusal into a deterministic error', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ new_balance: '10', refusal: 'daily_limit' }])
    await expect(writeWorldPlacement(placement())).rejects.toThrow('world_place_daily_limit')
  })

  test('rejects an idempotency replay with a different asset identity', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ new_balance: '10', refusal: 'asset_mismatch' }])
    await expect(writeWorldPlacement(placement())).rejects.toThrow('world_place_asset_mismatch')
  })
})

describe('placementsTodayPg', () => {
  test("counts today's world.place ledger entries from midnight UTC", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PLACED_AT)
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ count: 3 }])

    expect(await placementsTodayPg(CITIZEN_ID)).toBe(3)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/FROM ledger/i)
    expect(params).toEqual([CITIZEN_ID, '2026-07-10T00:00:00.000Z'])
  })

  test('throws on failure instead of silently unlocking the cap', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(placementsTodayPg(CITIZEN_ID)).rejects.toThrow('connection refused')
  })
})
