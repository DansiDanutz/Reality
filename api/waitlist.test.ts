import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './waitlist'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://waitlist/signup.json' })),
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

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('founder waitlist API', () => {
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
