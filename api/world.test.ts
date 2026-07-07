import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, { areaStatePath, assessPlacementInsideFounderArea, distanceKmBetweenCoordinates } from './world'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://world/asset.json' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_CITIZEN_ID = '22222222-2222-4222-8222-222222222222'
const TOKEN = 'founder-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const FOUNDER_PATH = `citizens/${CITIZEN_ID}__${TOKEN_HASH}__12.json`

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('world placement API claimed-area boundary', () => {
  test('reads high-precision shared-world asset coordinates', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([
        `world/${CITIZEN_ID}/asset-1__water__business__44.42701__26.10278.json`,
      ]))
      .mockResolvedValueOnce(blobList(['founders/0012.json']))
    const res = responseRecorder()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('s-maxage=30, stale-while-revalidate=120')
    expect(res.body).toEqual({
      ok: true,
      assets: [{ cid: '11111111', itemId: 'water', kind: 'business', lat: 44.42701, lng: 26.10278 }],
      stats: { assets: 1, founders: 1 },
    })
  })

  test('places shared-world assets only after the founder claim contains the stored coordinate', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(areaState()), { status: 200 })))
    const res = responseRecorder()

    await handler(postRequest({ lat: 44.42701, lng: 26.10278 }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `world/${CITIZEN_ID}/asset-1__water__business__44.42701__26.10278.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('requires a founder area claim before writing an asset to the shared world', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler(postRequest(), res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      error: 'Claim your founder area before placing shared-world assets.',
      code: 'area_not_claimed',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects placements outside the claimed radius with distance evidence', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(areaState({ radiusKm: 0.5 })), { status: 200 })))
    const res = responseRecorder()

    await handler(postRequest({ lat: 44.45, lng: 26.16 }), res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      ok: false,
      error: 'Place this asset inside your claimed founder area.',
      code: 'placement_outside_area',
      boundary: { radiusKm: 0.5 },
    })
    expect((res.body as { boundary: { distanceKm: number } }).boundary.distanceKm).toBeGreaterThan(0.5)
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects stored claims that belong to a different founder', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify(areaState({ founderCitizenId: OTHER_CITIZEN_ID })), { status: 200 })
    ))
    const res = responseRecorder()

    await handler(postRequest(), res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      ok: false,
      error: 'Shared-world placements must use the founder who owns the claimed area.',
      code: 'area_owner_mismatch',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects malformed stored claim coordinates before placement', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([FOUNDER_PATH]))
      .mockResolvedValueOnce(blobList([areaStatePath(CITIZEN_ID)], 'blob://area-state'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(areaState({ radiusKm: 0 })), { status: 200 })))
    const res = responseRecorder()

    await handler(postRequest(), res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      error: 'Founder area claim needs valid coordinates before shared-world placement.',
      code: 'area_claim_invalid',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('keeps boundary math inclusive and dateline-safe', () => {
    const boundary = assessPlacementInsideFounderArea({
      founderCitizenId: CITIZEN_ID,
      centerLat: 0,
      centerLng: 179.99,
      radiusKm: 3,
    }, 0, -179.99)

    expect(boundary.ok).toBe(true)
    expect(distanceKmBetweenCoordinates(0, 179.99, 0, -179.99)).toBeLessThan(3)
  })
})

function postRequest(overrides: Partial<Record<'lat' | 'lng', number>> = {}) {
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

function areaState(overrides: Partial<{
  founderCitizenId: string
  centerLat: number
  centerLng: number
  radiusKm: number
}> = {}) {
  const founderCitizenId = overrides.founderCitizenId ?? CITIZEN_ID
  return {
    version: 1,
    founderCitizenId,
    claim: {
      founderCitizenId,
      centerLat: overrides.centerLat ?? 44.4268,
      centerLng: overrides.centerLng ?? 26.1025,
      radiusKm: overrides.radiusKm ?? 0.8,
    },
  }
}

function blobList(pathnames: string[], downloadUrl = 'blob://download'): { blobs: { pathname: string; downloadUrl: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl })),
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
