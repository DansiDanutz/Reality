import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './world'

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'world-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

function stubPg() {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
}

describe('world API reads (Postgres-authoritative since Phase 1b.6)', () => {
  test('serves the shared map from the assets table with founder stats', async () => {
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([
        { citizen_id: CITIZEN_ID, item_id: 'small_home', kind: 'home', lat: 44.45, lng: 26.08 },
        { citizen_id: 'deadbeef-0000-4000-8000-000000000001', item_id: 'coffee_shop', kind: 'business', lat: -33.87, lng: -70.65 },
      ])
      .mockResolvedValueOnce([{ count: 8 }])
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('s-maxage=30, stale-while-revalidate=120')
    expect(res.body).toEqual({
      ok: true,
      assets: [
        { cid: '12345678', itemId: 'small_home', kind: 'home', lat: 44.45, lng: 26.08 },
        { cid: 'deadbeef', itemId: 'coffee_shop', kind: 'business', lat: -33.87, lng: -70.65 },
      ],
      stats: { assets: 2, founders: 8 },
    })
  })

  test('degrades to an empty world when the database read fails', async () => {
    stubPg()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, assets: [], stats: { assets: 0, founders: 0 } })
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('world API placement writes', () => {
  const VALID_BODY = {
    citizenId: CITIZEN_ID,
    token: TOKEN,
    assetId: 'starter-home-1',
    itemId: 'small_home',
    kind: 'home',
    lat: 44.451,
    lng: 26.082,
  }

  test('rejects client-owned fields before any storage call', async () => {
    stubPg()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY, money: 999_999 } } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toEqual({
      ok: false,
      error: 'Client-controlled world fields are not allowed.',
      code: 'client_controlled_server_field',
    })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('rejects invalid coordinates before any storage call', async () => {
    stubPg()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY, lat: 91 } } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'Invalid asset.' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('rejects unregistered citizens via the citizens table', async () => {
    stubPg()
    pgQueryMock.mockResolvedValueOnce([]) // token hash not found
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(401)
    const [verifySql, verifyParams] = pgQueryMock.mock.calls[0] as [string, unknown[]]
    expect(verifySql).toMatch(/FROM citizens/i)
    expect(verifyParams).toEqual([CITIZEN_ID, TOKEN_HASH])
  })

  test('stores a placement: assets upsert + world.place ledger entry, structured columns', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }]) // citizen verified
      .mockResolvedValueOnce([{ count: 3 }]) // cap check: 3 today
      .mockResolvedValueOnce([]) // asset upsert
      .mockResolvedValueOnce([]) // ledger entry
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    const [upsertSql, upsertParams] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(upsertSql).toMatch(/INSERT INTO assets/i)
    expect(upsertSql).toMatch(/ON CONFLICT \(citizen_id, asset_id\) DO UPDATE/i)
    expect(upsertParams).toEqual([
      'starter-home-1',
      CITIZEN_ID,
      'small_home',
      'home',
      44.45,
      26.08,
      '2026-07-10T12:00:00.000Z',
    ])
    const [ledgerSql] = pgQueryMock.mock.calls[3] as [string]
    expect(ledgerSql).toMatch(/INSERT INTO ledger/i)
  })

  test('blocks placements once the daily ledger cap is reached', async () => {
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ count: 20 }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      ok: false,
      error: "You've placed 20 things in the world today. Come back tomorrow.",
    })
    expect(pgQueryMock).toHaveBeenCalledTimes(2) // no writes past the cap
  })

  test('fails loudly when the authoritative write fails', async () => {
    stubPg()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ ok: false, error: 'The world is briefly unavailable.' })
    expect(consoleError).toHaveBeenCalled()
  })
})

function responseRecorder(): {
  statusCode: number
  body: unknown
  headers: Record<string, string>
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
    status(statusCode: number) {
      recorder.statusCode = statusCode
      return {
        json(body: unknown) {
          recorder.body = body
        },
      }
    },
  }
  return recorder
}
