import { describe, expect, test } from 'vitest'
import handler from './geo'

describe('geo API', () => {
  test('returns Vercel IP geolocation when coordinates are valid', () => {
    const res = responseRecorder()

    handler({
      method: 'GET',
      headers: {
        'x-vercel-ip-latitude': '44.45',
        'x-vercel-ip-longitude': '26.08',
        'x-vercel-ip-city': 'Bucure%C8%99ti',
        'x-vercel-ip-country': 'RO',
      },
    } as never, res as never)

    expect(res.headers).toEqual({ 'Cache-Control': 'private, no-store' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      city: 'București',
      country: 'RO',
      lat: 44.45,
      lng: 26.08,
    })
  })

  test('rejects missing, non-finite, and out-of-range coordinates', () => {
    for (const headers of [
      {},
      { 'x-vercel-ip-latitude': 'not-a-number', 'x-vercel-ip-longitude': '26.08' },
      { 'x-vercel-ip-latitude': '91', 'x-vercel-ip-longitude': '26.08' },
      { 'x-vercel-ip-latitude': '44.45', 'x-vercel-ip-longitude': '181' },
    ]) {
      const res = responseRecorder()

      handler({ method: 'GET', headers } as never, res as never)

      expect(res.headers).toEqual({ 'Cache-Control': 'private, no-store' })
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ ok: false })
    }
  })

  test('keeps valid coordinates when the city header has malformed encoding', () => {
    const res = responseRecorder()

    expect(() => handler({
      method: 'GET',
      headers: {
        'x-vercel-ip-latitude': '44.45',
        'x-vercel-ip-longitude': '26.08',
        'x-vercel-ip-city': 'Bucharest%2',
        'x-vercel-ip-country': 'RO',
      },
    } as never, res as never)).not.toThrow()

    expect(res.headers).toEqual({ 'Cache-Control': 'private, no-store' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      country: 'RO',
      lat: 44.45,
      lng: 26.08,
    })
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
