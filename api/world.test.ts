import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './world'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'world-placement-token'
const PLACEMENT_BODY = {
  citizenId: CITIZEN_ID,
  token: TOKEN,
  assetId: 'asset-1',
  itemId: 'foodcart',
  kind: 'business',
  lat: 44.4268,
  lng: 26.1025,
}

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('world API placement rate cap', () => {
  test('records distinct daily rate markers for same-millisecond placements', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:34:56.789Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([citizenRecordPath()]))
      .mockResolvedValueOnce(blobList([]))
      .mockResolvedValueOnce(blobList([citizenRecordPath()]))
      .mockResolvedValueOnce(blobList([]))

    const first = responseRecorder()
    await handler({ method: 'POST', body: PLACEMENT_BODY } as never, first as never)
    const second = responseRecorder()
    await handler({ method: 'POST', body: PLACEMENT_BODY } as never, second as never)

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(first.body).toEqual({ ok: true })
    expect(second.body).toEqual({ ok: true })
    expect(vi.mocked(list).mock.calls[0]?.[0]).toEqual({ prefix: `citizens/${CITIZEN_ID}__${tokenHash()}`, limit: 1 })
    expect(vi.mocked(list).mock.calls[1]?.[0]).toEqual({ prefix: `worldrate/${CITIZEN_ID}__2026-07-08`, limit: 21 })

    const assetWrites = vi.mocked(put).mock.calls
      .map(([pathname]) => String(pathname))
      .filter((pathname) => pathname.startsWith(`world/${CITIZEN_ID}/`))
    expect(assetWrites).toEqual([
      `world/${CITIZEN_ID}/asset-1__foodcart__business__44.43__26.10.json`,
      `world/${CITIZEN_ID}/asset-1__foodcart__business__44.43__26.10.json`,
    ])

    const rateMarkers = vi.mocked(put).mock.calls
      .map(([pathname]) => String(pathname))
      .filter((pathname) => pathname.startsWith(`worldrate/${CITIZEN_ID}__2026-07-08__`))
    expect(rateMarkers).toHaveLength(2)
    expect(new Set(rateMarkers).size).toBe(2)
    for (const marker of rateMarkers) {
      expect(marker).toMatch(/^worldrate\/11111111-1111-4111-8111-111111111111__2026-07-08__1783514096789__asset-1__[0-9a-f-]{36}\.json$/)
    }
  })

  test('rejects accepted citizens after the daily placement cap is used', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:34:56.789Z'))
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([citizenRecordPath()]))
      .mockResolvedValueOnce(blobList(Array.from(
        { length: 20 },
        (_, index) => `worldrate/${CITIZEN_ID}__2026-07-08__${index}.json`,
      )))
    const res = responseRecorder()

    await handler({ method: 'POST', body: PLACEMENT_BODY } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      ok: false,
      error: "You've placed 20 things in the world today. Come back tomorrow.",
    })
    expect(put).not.toHaveBeenCalled()
  })
})

function citizenRecordPath(): string {
  return `citizens/${CITIZEN_ID}__${tokenHash()}__1.json`
}

function tokenHash(): string {
  return createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
}

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
