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
  dualWriteWorldPlacement,
  placementCapReachedPg,
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
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('assetRowFromPlacement', () => {
  test('shapes an assets-table row with the pathname metadata as structured columns', () => {
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

describe('dualWriteWorldPlacement', () => {
  test('does nothing when POSTGRES_ENABLED is off', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '')
    await dualWriteWorldPlacement(placement())
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('upserts the asset and appends a world.place ledger entry when the flag is on', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await dualWriteWorldPlacement(placement())

    expect(queryMock).toHaveBeenCalledTimes(2)
    const [upsertSql, upsertParams] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(upsertSql).toBe(ASSET_UPSERT_SQL)
    expect(upsertSql).toMatch(/INSERT INTO assets/i)
    // Re-placing your own asset moves it (Blob allowOverwrite:true semantics),
    // but another citizen's asset id can never be hijacked.
    expect(upsertSql).toMatch(/ON CONFLICT \(asset_id\) DO UPDATE/i)
    expect(upsertSql).toMatch(/WHERE assets\.citizen_id = EXCLUDED\.citizen_id/i)
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
    expect(ledgerSql).toMatch(/INSERT INTO ledger/i)
    expect(ledgerParams[0]).toBe(CITIZEN_ID)
    expect(JSON.parse(String(ledgerParams[1]))).toEqual({
      assetId: 'starter-home-1',
      itemId: 'small_home',
      kind: 'home',
      lat: 44.45,
      lng: 26.08,
    })
  })

  test('never throws — a Postgres failure is logged, Blob stays authoritative', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused'))

    await expect(dualWriteWorldPlacement(placement())).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('dual-write'),
      expect.any(Error),
    )
  })
})

describe('placementCapReachedPg', () => {
  test('reports not-reached when POSTGRES_ENABLED is off, without touching the db', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '')
    expect(await placementCapReachedPg(CITIZEN_ID, 20)).toBe(false)
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('counts today\'s world.place ledger entries against the cap', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PLACED_AT)
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ count: 3 }])

    expect(await placementCapReachedPg(CITIZEN_ID, 20)).toBe(false)

    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/SELECT count/i)
    expect(statement).toMatch(/FROM ledger/i)
    expect(params).toEqual([CITIZEN_ID, '2026-07-10T00:00:00.000Z'])
    vi.useRealTimers()
  })

  test('reports reached once the count hits the cap', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ count: 20 }])
    expect(await placementCapReachedPg(CITIZEN_ID, 20)).toBe(true)
  })

  test('fails open on a Postgres error — Blob remains the authoritative cap', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused'))

    expect(await placementCapReachedPg(CITIZEN_ID, 20)).toBe(false)
    expect(consoleError).toHaveBeenCalled()
  })
})
