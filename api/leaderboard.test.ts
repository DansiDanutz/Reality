import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './leaderboard'

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'leaderboard-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const NOW = new Date('2026-07-10T12:00:00.000Z')

function stubPg() {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('leaderboard API reads (Postgres-authoritative since Phase 1b.6)', () => {
  test('ranks the scores table by capped worth and exposes a bounded top list', async () => {
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([
        { citizen_id: '00000000-0000-4000-8000-000000000001', name: 'water-maker', capped_worth: '750000.00' },
        { citizen_id: '00000000-0000-4000-8000-000000000002', name: 'food-shop', capped_worth: '250000.00' },
      ])
      .mockResolvedValueOnce([{ count: 2 }])
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
    const [rankSql] = pgQueryMock.mock.calls[0] as [string]
    expect(rankSql).toMatch(/ORDER BY capped_worth DESC/i)
  })

  test('returns a structured service failure when the database cannot be read', async () => {
    stubPg()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.headers['Cache-Control']).toBeUndefined()
    expect(res.body).toEqual({
      ok: false,
      error: 'The leaderboard is briefly unavailable.',
      code: 'leaderboard_unavailable',
    })
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('leaderboard API score submissions', () => {
  const BODY = { citizenId: CITIZEN_ID, token: TOKEN, name: 'Water Maker!', netWorth: 9_000_000 }

  test('requires CSRF proof for cookie-authenticated score submissions', async () => {
    stubPg()
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: { cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1` },
      body: { name: 'Water Maker!', netWorth: 100 },
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('rejects unregistered citizens via the citizens table', async () => {
    stubPg()
    pgQueryMock.mockResolvedValueOnce([]) // token hash not found
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(401)
    const [, verifyParams] = pgQueryMock.mock.calls[0] as [string, unknown[]]
    expect(verifyParams).toEqual([CITIZEN_ID, TOKEN_HASH])
  })

  test('caps by the authoritative citizen age and audits the capped claim atomically', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }]) // verified
      .mockResolvedValueOnce([{ name: 'Canonical Citizen', created_at: '2026-07-05T12:00:00.000Z' }]) // authoritative profile
      .mockResolvedValueOnce([]) // atomic upsert-with-audit
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const [upsertSql, upsertParams] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(upsertSql).toMatch(/INSERT INTO scores/i)
    expect(upsertSql).toMatch(/INSERT INTO ledger/i)
    // 5 days → 200k + 6 * 100k = 800k cap
    expect(upsertParams.slice(0, 5)).toEqual([CITIZEN_ID, 'canonical-citizen', 9_000_000, 800_000, NOW.toISOString()])
    expect(JSON.parse(String(upsertParams[5]))).toEqual({
      reason: 'implausible_net_worth',
      claimed: 9_000_000,
      capped: 800_000,
    })
  })

  test('falls back to the fail-closed day-0 cap when the citizen age is unknown', async () => {
    stubPg()
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([]) // no profile row → fail-closed day-0 cap/name fallback
      .mockResolvedValueOnce([])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const [, upsertParams] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(upsertParams[3]).toBe(300_000)
  })

  test('rejects invalid net worth before any storage call', async () => {
    stubPg()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, netWorth: -5 } } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('fails loudly when the authoritative write fails', async () => {
    stubPg()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z' }])
      .mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(500)
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
