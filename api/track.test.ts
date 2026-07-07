import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { FUNNEL_EVENTS as CLIENT_FUNNEL_EVENTS } from '../src/lib/analytics'
import { FUNNEL_EVENTS as API_FUNNEL_EVENTS } from './funnelEvents'
import handler from './track'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const AID = '12345678-1234-4234-9234-123456789abc'

afterEach(() => {
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('track API funnel contract', () => {
  test('keeps the API event allowlist in sync with the client funnel events', () => {
    expect(API_FUNNEL_EVENTS).toEqual(CLIENT_FUNNEL_EVENTS)
  })

  test('accepts every client funnel event and persists a unique funnel marker', async () => {
    vi.mocked(list).mockResolvedValue(blobList([]))

    for (const event of CLIENT_FUNNEL_EVENTS) {
      const res = responseRecorder()

      await handler({
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.42' },
        body: { event, aid: AID },
      } as never, res as never)

      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ ok: true })
      expect(vi.mocked(put).mock.calls.some(([pathname]) =>
        typeof pathname === 'string' && pathname.startsWith(`funnel/${event}/`)
      )).toBe(true)
    }
  })

  test('rejects unknown events and malformed anonymous ids', async () => {
    const unknown = responseRecorder()

    await handler({
      method: 'POST',
      body: { event: 'life_ladder_stage_progress_typo', aid: AID },
    } as never, unknown as never)

    expect(unknown.statusCode).toBe(400)
    expect(unknown.body).toEqual({ ok: false, error: 'Bad event.' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()

    const badAid = responseRecorder()
    await handler({
      method: 'POST',
      body: { event: CLIENT_FUNNEL_EVENTS[0], aid: 'not-a-uuid' },
    } as never, badAid as never)

    expect(badAid.statusCode).toBe(400)
    expect(badAid.body).toEqual({ ok: false, error: 'Bad event.' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('keeps the per-IP rate brake before writing funnel markers', async () => {
    vi.mocked(list).mockResolvedValue(blobList(Array.from({ length: 40 }, (_, index) => `trackip/hash__day__${index}.json`)))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-real-ip': '203.0.113.42' },
      body: { event: CLIENT_FUNNEL_EVENTS[0], aid: AID },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ ok: false })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects non-POST methods', async () => {
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ ok: false, error: 'Method not allowed' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
})

function blobList(paths: string[]) {
  return {
    blobs: paths.map((pathname) => ({ pathname })),
    hasMore: false,
    cursor: undefined,
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
}
