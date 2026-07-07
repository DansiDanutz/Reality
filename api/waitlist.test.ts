import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './waitlist'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://waitlist' })),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('waitlist API', () => {
  test('returns the stored founder waitlist count with cache headers', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList(['waitlist/a.json', 'waitlist/b.json']))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers).toEqual({ 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' })
    expect(res.body).toEqual({ ok: true, count: 2 })
  })

  test('returns a structured temporary failure when waitlist count storage cannot be listed', async () => {
    vi.mocked(list).mockRejectedValueOnce(new Error('blob unavailable'))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.headers).toEqual({ 'Cache-Control': 'no-store' })
    expect(res.body).toEqual({
      ok: false,
      code: 'waitlist_count_unavailable',
      error: 'The waitlist count is briefly unavailable. Try again in a minute.',
    })
  })

  test('stores normalized waitlist emails without leaking addresses into blob keys', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T10:00:00.000Z'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: ' Founder@Example.COM ' },
    } as never, res as never)

    const clean = 'founder@example.com'
    const key = createHash('sha256').update(clean).digest('hex').slice(0, 32)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `waitlist/${key}.json`,
      JSON.stringify({ email: clean, joinedAt: '2026-07-07T10:00:00.000Z' }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('returns a structured temporary failure when waitlist signup storage cannot be written', async () => {
    vi.mocked(put).mockRejectedValueOnce(new Error('blob unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: 'founder@example.com' },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      code: 'waitlist_write_unavailable',
      error: 'The waitlist is briefly unavailable. Try again in a minute.',
    })
  })

  test('keeps invalid email and honeypot behavior unchanged', async () => {
    const invalid = responseRecorder()
    await handler({ method: 'POST', body: { email: 'not-an-email' } } as never, invalid as never)

    expect(invalid.statusCode).toBe(400)
    expect(invalid.body).toEqual({ ok: false, error: 'That email address does not look right.' })
    expect(put).not.toHaveBeenCalled()

    const honeypot = responseRecorder()
    await handler({
      method: 'POST',
      body: { email: 'founder@example.com', website: 'https://bot.example' },
    } as never, honeypot as never)

    expect(honeypot.statusCode).toBe(200)
    expect(honeypot.body).toEqual({ ok: true })
    expect(put).not.toHaveBeenCalled()
  })
})

function blobList(pathnames: string[]): { blobs: { pathname: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore: false,
  }
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
