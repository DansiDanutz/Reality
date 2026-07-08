import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './world'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'world-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const NOW = new Date('2026-07-07T12:34:56.000Z')

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('world API placement writes', () => {
  test('stores a valid authenticated world placement and daily rate marker', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.451,
        lng: 26.082,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `world/${CITIZEN_ID}/starter-home-1__small_home__home__44.45__26.08.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    expect(put).toHaveBeenCalledWith(
      `worldrate/${CITIZEN_ID}__2026-07-07__${NOW.getTime()}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('rejects client-owned fields before citizen verification or writes', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.45,
        lng: 26.08,
        money: 999_999,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toEqual({
      ok: false,
      error: 'Client-controlled world fields are not allowed.',
      code: 'client_controlled_server_field',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects invalid coordinates before citizen verification or writes', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 91,
        lng: 26.08,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'Invalid asset.' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('blocks placements once the daily citizen cap is reached', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList(Array.from({ length: 20 }, (_, index) =>
        `worldrate/${CITIZEN_ID}__2026-07-07__${index}.json`
      )))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.45,
        lng: 26.08,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      ok: false,
      error: "You've placed 20 things in the world today. Come back tomorrow.",
    })
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
