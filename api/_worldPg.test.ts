import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  ASSET_UPSERT_SQL,
  LEDGER_PLACE_INSERT_SQL,
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
    })
  })
})

describe('writeWorldPlacement (authoritative since Phase 1b.6)', () => {
  test('upserts the asset on the composite key and appends a world.place ledger entry', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await writeWorldPlacement(placement())

    expect(queryMock).toHaveBeenCalledTimes(2)
    const [upsertSql, upsertParams] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(upsertSql).toBe(ASSET_UPSERT_SQL)
    expect(upsertSql).toMatch(/ON CONFLICT \(citizen_id, asset_id\) DO UPDATE/i)
    expect(upsertParams).toEqual([
      'starter-home-1',
      CITIZEN_ID,
      'small_home',
      'home',
      44.45,
      26.08,
      PLACED_AT.toISOString(),
    ])
    const [ledgerSql, ledgerParams] = queryMock.mock.calls[1] as [string, unknown[]]
    expect(ledgerSql).toBe(LEDGER_PLACE_INSERT_SQL)
    expect(JSON.parse(String(ledgerParams[1]))).toEqual({
      assetId: 'starter-home-1',
      itemId: 'small_home',
      kind: 'home',
      lat: 44.45,
      lng: 26.08,
    })
  })

  test('throws on failure — the handler owns the 500, there is no Blob to fall back to', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(writeWorldPlacement(placement())).rejects.toThrow('connection refused')
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
