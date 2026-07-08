import { del, list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './leaderboard'

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}))

afterEach(() => {
  vi.mocked(del).mockReset()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockReset()
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
