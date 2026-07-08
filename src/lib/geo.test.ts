import { afterEach, describe, expect, test, vi } from 'vitest'
import { detectLocation } from './geo'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectLocation', () => {
  test('uses valid server geolocation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        ok: true,
        city: 'Bucharest',
        country: 'RO',
        lat: 44.45,
        lng: 26.08,
      }))
    ))

    await expect(detectLocation()).resolves.toEqual({
      city: 'Bucharest',
      country: 'RO',
      lat: 44.45,
      lng: 26.08,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/geo')
  })

  test('rejects out-of-range server coordinates and uses a valid fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === '/api/geo') {
        return new Response(JSON.stringify({ ok: true, city: 'Impossible', lat: 120, lng: 26.08 }))
      }
      return new Response(JSON.stringify({
        success: true,
        city: 'Timisoara',
        country: 'Romania',
        latitude: 45.75,
        longitude: 21.23,
      }))
    }))

    await expect(detectLocation()).resolves.toEqual({
      city: 'Timisoara',
      country: 'Romania',
      lat: 45.75,
      lng: 21.23,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('returns null when server and fallback coordinates are impossible', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url) === '/api/geo') {
        return new Response(JSON.stringify({ ok: true, city: 'Impossible', lat: 44.45, lng: 220 }))
      }
      return new Response(JSON.stringify({
        success: true,
        city: 'Also Impossible',
        latitude: -120,
        longitude: 21.23,
      }))
    }))

    await expect(detectLocation()).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
