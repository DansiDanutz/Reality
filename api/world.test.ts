import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './world'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://world/asset.json' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__12.json`

afterEach(() => {
  vi.mocked(list).mockReset()
  vi.mocked(put).mockReset()
})

describe('world placement API responses', () => {
  test('returns a stable placement receipt with the stored asset coordinates', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([FOUNDER_PATH]))
    const res = responseRecorder()

    await handler(postRequest({ lat: 44.42701, lng: 26.10278 }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      code: 'asset_placed',
      asset: {
        citizenId: CITIZEN_ID,
        assetId: 'asset-1',
        itemId: 'water',
        kind: 'business',
        lat: 44.43,
        lng: 26.1,
        pathname: `world/${CITIZEN_ID}/asset-1__water__business__44.43__26.10.json`,
      },
    })
    expect(put).toHaveBeenCalledWith(
      `world/${CITIZEN_ID}/asset-1__water__business__44.43__26.10.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('returns stable rejection codes for unsupported method, invalid asset, and unregistered citizen', async () => {
    const method = responseRecorder()
    await handler({ method: 'DELETE' } as never, method as never)
    expect(method.statusCode).toBe(405)
    expect(method.body).toEqual({ ok: false, error: 'Method not allowed', code: 'method_not_allowed' })

    const invalid = responseRecorder()
    await handler(postRequest({ itemId: 'water-1', kind: 'vehicle' }), invalid as never)
    expect(invalid.statusCode).toBe(400)
    expect(invalid.body).toEqual({ ok: false, error: 'Invalid asset.', code: 'invalid_asset' })
    expect(list).not.toHaveBeenCalled()

    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const unauthorized = responseRecorder()
    await handler(postRequest(), unauthorized as never)
    expect(unauthorized.statusCode).toBe(401)
    expect(unauthorized.body).toEqual({ ok: false, error: 'Not a registered citizen.', code: 'not_registered' })
    expect(put).not.toHaveBeenCalled()
  })

  test('returns a stable world unavailable code when storage write fails', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([FOUNDER_PATH]))
    vi.mocked(put).mockRejectedValueOnce(new Error('blob write failed'))
    const res = responseRecorder()

    await handler(postRequest(), res as never)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      ok: false,
      error: 'The world is briefly unavailable.',
      code: 'world_unavailable',
    })
  })
})

function postRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    body: {
      citizenId: CITIZEN_ID,
      token: TOKEN,
      assetId: 'asset-1',
      itemId: 'water',
      kind: 'business',
      lat: 44.4269,
      lng: 26.1026,
      ...overrides,
    },
  } as never
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
