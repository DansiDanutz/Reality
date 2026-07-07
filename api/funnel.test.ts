import { list } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { FUNNEL_EVENTS } from './funnelEvents'
import handler from './funnel'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
}))

afterEach(() => {
  vi.mocked(list).mockReset()
})

describe('funnel API', () => {
  test('counts every configured funnel event in journey order', async () => {
    vi.mocked(list).mockImplementation(async ({ prefix }) => {
      const eventIndex = FUNNEL_EVENTS.findIndex((event) => prefix === `funnel/${event}/`)
      return blobList(Array.from({ length: eventIndex + 1 }, (_, index) => `${prefix}${index}.json`))
    })
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('s-maxage=60, stale-while-revalidate=300')
    expect(res.body).toEqual({
      ok: true,
      funnel: FUNNEL_EVENTS.map((event, index) => ({ event, uniques: index + 1 })),
    })
    for (const event of FUNNEL_EVENTS) {
      expect(list).toHaveBeenCalledWith({ prefix: `funnel/${event}/`, cursor: undefined, limit: 1000 })
    }
  })

  test('rejects non-GET methods', async () => {
    const res = responseRecorder()

    await handler({ method: 'POST' } as never, res as never)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ ok: false, error: 'Method not allowed' })
    expect(list).not.toHaveBeenCalled()
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
    headers: {} as Record<string, string>,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
  }
}
