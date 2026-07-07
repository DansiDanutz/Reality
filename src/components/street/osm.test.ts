import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearNeighborhoodCacheForTest, fetchNeighborhood } from './osm'

const okResponse = (elements: unknown[]) =>
  ({ ok: true, json: () => Promise.resolve({ elements }) }) as unknown as Response

const BUILDING = {
  type: 'way',
  tags: { building: 'yes' },
  geometry: [
    { lat: 44.43, lon: 26.1 },
    { lat: 44.431, lon: 26.1 },
    { lat: 44.431, lon: 26.101 },
  ],
}

describe('fetchNeighborhood mirror fallback', () => {
  afterEach(() => {
    clearNeighborhoodCacheForTest()
    vi.unstubAllGlobals()
  })

  it('falls through to a later mirror when earlier ones fail', async () => {
    // Mirror 1: HTTP error (the overpass-api.de 406 outage). Mirror 2: network
    // failure (kumi timeout). Mirror 3: healthy — must be reached and used.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 406 } as Response)
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(okResponse([BUILDING]))
    vi.stubGlobal('fetch', fetchMock)

    const hood = await fetchNeighborhood(44.4325, 26.1039)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(hood.buildings).toHaveLength(1)
  })

  it('throws when every mirror fails, preserving the last error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('all mirrors down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchNeighborhood(44.4325, 26.1039)).rejects.toThrow('all mirrors down')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a real error (not null) when mirrors only return HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 406 } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchNeighborhood(44.4325, 26.1039)).rejects.toThrow(/responded 406/)
  })

  it('returns first successful mirror without calling the rest', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([BUILDING]))
    vi.stubGlobal('fetch', fetchMock)

    await fetchNeighborhood(44.4325, 26.1039)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
