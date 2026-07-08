import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './waitlist'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const NOW = '2026-07-08T00:30:00.000Z'

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('waitlist API', () => {
  test('stores a hashed contact record without raw email or economy fields', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: '  Founder@Example.COM  ' },
    } as never, res as never)

    const contactHash = createHash('sha256').update('founder@example.com').digest('hex').slice(0, 32)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `waitlist/${contactHash}.json`,
      JSON.stringify({ contactHash, joinedAt: NOW }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    const stored = JSON.parse(String(vi.mocked(put).mock.calls[0]?.[1]))
    expect(stored).not.toHaveProperty('email')
    expect(stored).not.toHaveProperty('queuePosition')
    expect(stored).not.toHaveProperty('founderSeatPurchaseEnabled')
    expect(stored).not.toHaveProperty('paidPriorityEnabled')
    expect(stored).not.toHaveProperty('cryptoPaymentEnabled')
    expect(stored).not.toHaveProperty('automaticPromotionEnabled')
    expect(stored).not.toHaveProperty('automaticReplacementEnabled')
    expect(stored).not.toHaveProperty('waitlistHandoffEnabled')
  })

  test('keeps GET count as public social proof only', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList(['waitlist/a.json', 'waitlist/b.json'], true, 'cursor-1'))
      .mockResolvedValueOnce(blobList(['waitlist/c.json'], false))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('s-maxage=60, stale-while-revalidate=300')
    expect(res.body).toEqual({ ok: true, count: 3 })
    expect(list).toHaveBeenNthCalledWith(1, { prefix: 'waitlist/', cursor: undefined, limit: 1000 })
    expect(list).toHaveBeenNthCalledWith(2, { prefix: 'waitlist/', cursor: 'cursor-1', limit: 1000 })
    expect(put).not.toHaveBeenCalled()
  })

  test('does not store honeypot signups', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: 'founder@example.com', website: 'https://spam.example' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects invalid email before hashing', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { email: 'not-an-email' },
    } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'That email address does not look right.' })
    expect(put).not.toHaveBeenCalled()
  })
})

function blobList(
  pathnames: string[],
  hasMore = false,
  cursor?: string,
): { blobs: { pathname: string }[]; hasMore: boolean; cursor?: string } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore,
    ...(cursor ? { cursor } : {}),
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
