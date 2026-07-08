import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, { buildDiscoveryQuery } from './overpass'
import { buildDiscoveryQuery as clientBuildDiscoveryQuery } from '../src/game/mapDiscovery'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('overpass proxy API', () => {
  test('rejects non-GET methods', async () => {
    const res = responseRecorder()

    await handler({ method: 'POST', query: {} } as never, res as never)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ ok: false, error: 'Method not allowed' })
  })

  test('rejects missing, non-finite, and out-of-range coordinates', async () => {
    for (const query of [
      {},
      { lat: 'not-a-number', lng: '26.08' },
      { lat: '91', lng: '26.08' },
      { lat: '44.45', lng: '181' },
    ]) {
      const res = responseRecorder()

      await handler({ method: 'GET', query } as never, res as never)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ ok: false, error: 'lat and lng query params are required' })
    }
  })

  test('forwards the discovery query and returns elements with a long CDN cache', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [{ type: 'node', lat: 1, lon: 2 }] }), { status: 200 }) as never,
    )
    const res = responseRecorder()

    await handler({ method: 'GET', query: { lat: '44.4512', lng: '26.0834' } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, elements: [{ type: 'node', lat: 1, lon: 2 }] })
    expect(res.headers['Cache-Control']).toContain('s-maxage=86400')
    // Coordinates are rounded to 3 decimals before hitting upstream.
    const sentBody = String(fetchMock.mock.calls[0][1]?.body)
    expect(decodeURIComponent(sentBody)).toContain('44.451,26.083')
  })

  test('falls through mirrors and returns 502 when all fail', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('busy', { status: 504 }) as never)
    const res = responseRecorder()

    await handler({ method: 'GET', query: { lat: '10', lng: '20' } } as never, res as never)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ ok: false, error: 'All Overpass mirrors failed' })
  })

  test('the proxy query stays in sync with the client query builder', () => {
    expect(buildDiscoveryQuery(44.451, 26.083)).toBe(clientBuildDiscoveryQuery(44.451, 26.083))
  })
})

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
