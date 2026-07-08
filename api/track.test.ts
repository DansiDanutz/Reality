import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, { ACCEPTED_FUNNEL_EVENTS } from './track'
import { FUNNEL_EVENTS as CLIENT_FUNNEL_EVENTS } from '../src/lib/analytics'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(async () => blobList([])),
  put: vi.fn(async () => ({ url: 'blob://track' })),
}))

const AID = '11111111-1111-4111-8111-111111111111'

afterEach(() => {
  vi.mocked(list).mockReset()
  vi.mocked(list).mockResolvedValue(blobList([]))
  vi.mocked(put).mockClear()
})

describe('track API analytics contract', () => {
  test('accepts exactly the client funnel event list', () => {
    expect([...ACCEPTED_FUNNEL_EVENTS].sort()).toEqual([...CLIENT_FUNNEL_EVENTS].sort())
  })

  test('accepts every emitted client event', async () => {
    for (const event of CLIENT_FUNNEL_EVENTS) {
      const res = responseRecorder()

      await handler({
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.42' },
        body: { event, aid: AID },
      } as never, res as never)

      expect(res.statusCode, event).toBe(200)
      expect(res.body, event).toEqual({ ok: true })
    }

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^funnel\/daily_complete\/[0-9a-f]{24}\.json$/),
      expect.stringContaining('"day"'),
      { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
    )
  })

  test('rejects unknown events and malformed anonymous ids', async () => {
    const badEvent = responseRecorder()
    await handler({ method: 'POST', body: { event: 'not_real', aid: AID } } as never, badEvent as never)
    expect(badEvent.statusCode).toBe(400)
    expect(badEvent.body).toEqual({ ok: false, error: 'Bad event.' })

    const badAid = responseRecorder()
    await handler({ method: 'POST', body: { event: 'daily_complete', aid: 'not-a-uuid' } } as never, badAid as never)
    expect(badAid.statusCode).toBe(400)
    expect(badAid.body).toEqual({ ok: false, error: 'Bad event.' })
  })

  test('keeps the per-IP bot brake', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList(Array.from({ length: 40 }, (_, index) => `trackip/hash__day__${index}.json`)))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-real-ip': '203.0.113.99' },
      body: { event: 'daily_complete', aid: AID },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ ok: false })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects non-POST requests', async () => {
    const res = responseRecorder()
    await handler({ method: 'GET' } as never, res as never)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ ok: false, error: 'Method not allowed' })
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
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
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
