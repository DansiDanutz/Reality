import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './revoke-session'
import { resetDbForTest } from './_db'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({ query: queryMock }) }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('revoke session API', () => {
  test('requires CSRF proof for cookie-authenticated logout', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: { cookie: 'reality_session=00000000-0000-0000-0000-000000000001.cookie-token; reality_csrf=csrf-1' },
      body: {},
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('revokes a verified cookie session with matching CSRF proof', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ citizen_id: '00000000-0000-0000-0000-000000000001' }])
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: {
        cookie: 'reality_session=00000000-0000-0000-0000-000000000001.cookie-token; reality_csrf=csrf-1',
        'x-reality-csrf': 'csrf-1',
      },
      body: {},
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, revoked: true })
  })

  test('does not accept body credentials in place of the cookie session', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const res = responseRecorder()

    await handler({ method: 'POST', body: { citizenId: '00000000-0000-0000-0000-000000000001', token: 'session-token' } } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, code: 'session_required' })
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('rejects an invalid cookie token without revoking anything', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: {
        cookie: 'reality_session=00000000-0000-0000-0000-000000000001.wrong; reality_csrf=csrf-1',
        'x-reality-csrf': 'csrf-1',
      },
      body: {},
    } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})

function responseRecorder() {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
    status(code: number) {
      recorder.statusCode = code
      return { json(body: unknown) { recorder.body = body } }
    },
  }
  return recorder
}
