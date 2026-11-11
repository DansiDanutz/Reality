import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './time'

afterEach(() => vi.useRealTimers())

function recorder() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { res.headers[name] = value; return res },
    status(code: number) { res.statusCode = code; return res },
    json(body: unknown) { res.body = body; return res },
  }
  return res
}

describe('/api/time', () => {
  test('returns the server clock, never cached', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
    const res = recorder()
    handler({ method: 'GET' } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, now: Date.parse('2026-10-21T12:00:00.000Z') })
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  test('only answers GET', () => {
    const res = recorder()
    handler({ method: 'POST' } as never, res as never)
    expect(res.statusCode).toBe(405)
  })
})
