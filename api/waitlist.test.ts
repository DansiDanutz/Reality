import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './waitlist'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://waitlist/signup.json' })),
}))

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [{ allowed: true }])
vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const POLICY = {
  founderSeatLimit: 2_000,
  founderSeatsFreeForFirstCohort: true,
  replacementWorkflowEnabled: false,
  waitlistHandoffEnabled: false,
  seatTransferEnabled: false,
  areaTransferEnabled: false,
  landTransferEnabled: false,
  payoutEligibility: 'none',
  profitPromise: false,
  cryptoPaymentRequired: false,
  tonSettlementEnabled: false,
  manualReviewRequired: true,
}

beforeEach(() => {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([{ allowed: true }])
  resetDbForTest()
})

describe('founder waitlist API', () => {
  test('rejects ignored query variants before listing the waitlist', async () => {
    const res = responseRecorder()

    await handler({ method: 'GET', query: { cacheBust: 'random' } } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'Query parameters are not allowed.' })
    expect(list).not.toHaveBeenCalled()
  })

  test('returns signup count with manual founder replacement gates', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList(['waitlist/a.json', 'waitlist/b.json'], true, 'page-2'))
      .mockResolvedValueOnce(blobList(['waitlist/c.json'], false))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(list).toHaveBeenCalledWith({ prefix: 'waitlist/', cursor: undefined, limit: 1000 })
    expect(list).toHaveBeenCalledWith({ prefix: 'waitlist/', cursor: 'page-2', limit: 1000 })
    expect(res.headers).toEqual({ 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      count: 3,
      policy: POLICY,
    })
  })

  test('stores signup records with no automatic replacement, payout, or crypto rights', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T08:00:00.000Z'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: '  Founder@Reality.Game  ' },
    } as never, res as never)

    const key = createHash('sha256').update('founder@reality.game').digest('hex').slice(0, 32)
    expect(put).toHaveBeenCalledWith(
      `waitlist/${key}.json`,
      JSON.stringify({
        kind: 'founder_waitlist_signup',
        email: 'founder@reality.game',
        joinedAt: '2026-07-07T08:00:00.000Z',
        status: 'waiting',
        requestedFounderSeat: true,
        policy: POLICY,
        handoff: {
          replacementCandidate: false,
          replacementWorkflowEnabled: false,
          waitlistHandoffEnabled: false,
          seatTransferEnabled: false,
          areaTransferEnabled: false,
          landTransferEnabled: false,
          manualReviewRequired: true,
        },
        monetization: {
          payoutEligibility: 'none',
          profitPromise: false,
          cryptoPaymentRequired: false,
          tonSettlementEnabled: false,
        },
      }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, policy: POLICY })
  })

  test('reserves one Postgres signup slot per IP per day, namespaced away from registration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T08:00:00.000Z'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
      body: { email: 'founder@reality.game' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const [sql, params] = pgQueryMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/reality_claim_registration_slot/)
    const waitlistKey = createHash('sha256').update('waitlist|203.0.113.9').digest('hex').slice(0, 16)
    const registrationKey = createHash('sha256').update('203.0.113.9').digest('hex').slice(0, 16)
    expect(params).toEqual([waitlistKey, '2026-07-07', 5])
    expect(waitlistKey).not.toBe(registrationKey)
  })

  test('returns 429 and writes nothing once the per-IP daily budget is spent', async () => {
    pgQueryMock.mockResolvedValueOnce([{ allowed: false }])
    const res = responseRecorder()

    await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: { email: 'founder@reality.game' } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ ok: false, error: 'Too many waitlist signups from this connection today. Try again tomorrow.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('fails closed with 503 when the rate-limit store is unavailable', async () => {
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: { email: 'founder@reality.game' } } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects invalid emails without writing a waitlist record', async () => {
    const res = responseRecorder()

    await handler({ method: 'POST', body: { email: 'not an email' } } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'That email address does not look right.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('accepts honeypot submissions without writing a waitlist record', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: 'founder@reality.game', website: 'https://bot.example' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).not.toHaveBeenCalled()
  })
})

function blobList(pathnames: string[], hasMore = false, cursor?: string) {
  return {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl: `blob://${pathname}` })),
    hasMore,
    cursor,
  } as never
}

function responseRecorder(): {
  headers: Record<string, string>
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
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
