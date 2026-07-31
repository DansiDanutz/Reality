import { describe, expect, test } from 'vitest'
import handler from './clear-session'

describe('clear session API', () => {
  test('requires CSRF proof before clearing browser cookies', async () => {
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: { cookie: 'reality_csrf=csrf-1' },
      body: {},
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(res.headers['Set-Cookie']).toBeUndefined()
  })

  test('clears browser cookies without touching registry credentials', async () => {
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: {
        cookie: 'reality_session=citizen-a.token-a; reality_csrf=csrf-1',
        'x-reality-csrf': 'csrf-1',
      },
      body: {},
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(res.headers['Set-Cookie']).toEqual([
      expect.stringContaining('reality_session=; Max-Age=0'),
      expect.stringContaining('reality_csrf=; Max-Age=0'),
    ])
  })

  test('rejects non-POST methods', async () => {
    const res = responseRecorder()
    await handler({ method: 'GET', headers: {} } as never, res as never)
    expect(res.statusCode).toBe(405)
  })
})

function responseRecorder() {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader(name: string, value: string | string[]) {
      recorder.headers[name] = value
    },
    status(code: number) {
      recorder.statusCode = code
      return { json(body: unknown) { recorder.body = body } }
    },
  }
  return recorder
}
