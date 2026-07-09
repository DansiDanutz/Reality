import { createHash } from 'node:crypto'
import { del, list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './leaderboard'

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}))

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'leaderboard-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const NOW = new Date('2026-07-10T12:00:00.000Z')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.mocked(del).mockReset()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockReset()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('leaderboard API', () => {
  test('ranks score blobs by net worth and exposes a bounded top list', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([
      'scores/00000000-0000-4000-8000-000000000001__750000__water-maker.json',
      'scores/00000000-0000-4000-8000-000000000002__250000__food-shop.json',
      'scores/not-a-score.json',
    ]))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('s-maxage=60, stale-while-revalidate=300')
    expect(res.body).toEqual({
      ok: true,
      citizens: 2,
      top: [
        { citizenId: '00000000-0000-4000-8000-000000000001', name: 'water-maker', netWorth: 750000 },
        { citizenId: '00000000-0000-4000-8000-000000000002', name: 'food-shop', netWorth: 250000 },
      ],
    })
  })

  test('returns a structured service failure when leaderboard storage cannot be listed', async () => {
    vi.mocked(list).mockRejectedValueOnce(new Error('blob unavailable'))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.headers['Cache-Control']).toBeUndefined()
    expect(res.body).toEqual({
      ok: false,
      error: 'The leaderboard is briefly unavailable.',
      code: 'leaderboard_unavailable',
    })
  })
})

describe('leaderboard API Postgres dual-write (Phase 1b.4)', () => {
  const BODY = { citizenId: CITIZEN_ID, token: TOKEN, name: 'Water Maker!', netWorth: 9_000_000 }

  test('leaves Postgres untouched when POSTGRES_ENABLED is off', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`])) // verify
      .mockResolvedValueOnce(blobList([])) // age lookup: unknown → fail-closed cap
      .mockResolvedValueOnce(blobList([])) // no previous score
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(pgQueryMock).not.toHaveBeenCalled()
    // Fail-closed day-0 cap applies when the citizen's age is unknown
    expect(put).toHaveBeenCalledWith(
      `scores/${CITIZEN_ID}__300000__water-maker.json`,
      '1',
      expect.anything(),
    )
  })

  test('caps from the Postgres citizen age, dual-writes the score, and logs the capped claim', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    pgQueryMock.mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z' }]) // 5 days old
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`])) // verify
      .mockResolvedValueOnce(blobList([])) // no previous score
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    // Age came from Postgres — no second citizens/ blob list for the age fetch
    expect(list).toHaveBeenCalledTimes(2)
    // 5 days → 200k + 6 * 100k = 800k cap
    expect(put).toHaveBeenCalledWith(
      `scores/${CITIZEN_ID}__800000__water-maker.json`,
      '1',
      expect.anything(),
    )
    expect(pgQueryMock).toHaveBeenCalledTimes(3) // age + upsert + capped-claim ledger
    const [upsertSql, upsertParams] = pgQueryMock.mock.calls[1] as [string, unknown[]]
    expect(upsertSql).toMatch(/INSERT INTO scores/i)
    expect(upsertParams).toEqual([CITIZEN_ID, 'water-maker', 9_000_000, 800_000, NOW.toISOString()])
    const [ledgerSql, ledgerParams] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(ledgerSql).toMatch(/INSERT INTO ledger/i)
    expect(JSON.parse(String(ledgerParams[1]))).toEqual({
      reason: 'implausible_net_worth',
      claimed: 9_000_000,
      capped: 800_000,
    })
  })

  test('a plausible score dual-writes without a ledger entry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    pgQueryMock.mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z' }])
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, netWorth: 500_000 } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(pgQueryMock).toHaveBeenCalledTimes(2) // age + upsert, no ledger row
  })

  test('score submission still succeeds when Postgres fails — fail-closed cap, Blob write intact', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValue(new Error('connection refused'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`])) // verify
      .mockResolvedValueOnce(blobList([])) // blob age fallback: unknown → fail-closed
      .mockResolvedValueOnce(blobList([])) // no previous score
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(put).toHaveBeenCalledWith(
      `scores/${CITIZEN_ID}__300000__water-maker.json`,
      '1',
      expect.anything(),
    )
    expect(consoleError).toHaveBeenCalled()
  })
})

function blobList(pathnames: string[]): { blobs: { pathname: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore: false,
  }
}

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
