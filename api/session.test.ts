import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './session'

const queryMock = vi.fn(async (): Promise<unknown[]> => [{ ok: 1 }])
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({ query: queryMock }) }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  resetDbForTest()
})

describe('cookie session bootstrap', () => {
  test('rejects requests without a session cookie', async () => {
    const res = responseRecorder()
    await handler({ method: 'GET', headers: {} } as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('returns identity metadata without returning the bearer token', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://test')
    const citizenId = '12345678-1234-1234-1234-123456789abc'
    queryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ citizen_id: citizenId, name: 'Ada', founder_number: 4, created_at: '2026-07-01T00:00:00.000Z' }])
      .mockResolvedValueOnce([]) // token still has more than half its life — no renewal
    const res = responseRecorder()
    await handler({ method: 'GET', headers: { cookie: `reality_session=${citizenId}.secret-token` } } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, citizenId, name: 'Ada', founderNumber: 4, createdAt: new Date('2026-07-01T00:00:00.000Z').getTime() })
    expect(JSON.stringify(res.body)).not.toContain('secret-token')
    expect(res.headers['Set-Cookie']).toBeUndefined()
  })

  test('slides the session: extends a token inside its renewal window and re-issues the cookies', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://test')
    const citizenId = '12345678-1234-1234-1234-123456789abc'
    queryMock
      .mockResolvedValueOnce([{ ok: 1 }])
      .mockResolvedValueOnce([{ citizen_id: citizenId, name: 'Ada', founder_number: 4, created_at: '2026-07-01T00:00:00.000Z' }])
      .mockResolvedValueOnce([{ citizen_id: citizenId }]) // expiry was inside the last 15 days → extended
    const res = responseRecorder()
    await handler({ method: 'GET', headers: { cookie: `reality_session=${citizenId}.secret-token` } } as never, res as never)
    expect(res.statusCode).toBe(200)
    const renewSql = String(queryMock.mock.calls[2]?.[0])
    expect(renewSql).toMatch(/UPDATE citizens SET token_expires_at = now\(\) \+ make_interval/)
    expect(renewSql).toContain('token_revoked_at IS NULL')
    expect(renewSql).toContain('token_expires_at IS NOT NULL')
    expect(queryMock.mock.calls[2]?.[1]).toEqual([citizenId, 30, 15])
    // The same token goes back out with a fresh Max-Age — no rotation, other devices keep working.
    const cookies = res.headers['Set-Cookie'] as string[]
    expect(cookies[0]).toContain(`reality_session=${encodeURIComponent(`${citizenId}.secret-token`)}`)
    expect(cookies[0]).toContain('Max-Age=2592000')
    expect(cookies[0]).toContain('HttpOnly')
  })
})

function responseRecorder() {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader(name: string, value: string | string[]) { recorder.headers[name] = value },
    status(code: number) { recorder.statusCode = code; return { json(body: unknown) { recorder.body = body } } },
  }
  return recorder
}
