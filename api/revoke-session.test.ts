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
  test('revokes a verified token server-side', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ citizen_id: '00000000-0000-0000-0000-000000000001' }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { citizenId: '00000000-0000-0000-0000-000000000001', token: 'session-token' } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, revoked: true })
    expect(res.headers['Set-Cookie']).toContain('reality_session=; Max-Age=0')
    expect(String(queryMock.mock.calls[0][0])).toContain('token_revoked_at IS NULL')
    expect(String(queryMock.mock.calls[0][0])).toContain('token_expires_at IS NULL OR token_expires_at > now()')
    expect(String(queryMock.mock.calls[1][0])).toContain('SET token_revoked_at = now()')
  })

  test('rejects an invalid token without revoking anything', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const res = responseRecorder()

    await handler({ method: 'POST', body: { citizenId: '00000000-0000-0000-0000-000000000001', token: 'wrong' } } as never, res as never)

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
