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
    const res = responseRecorder()
    await handler({ method: 'GET', headers: { cookie: `reality_session=${citizenId}.secret-token` } } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, citizenId, name: 'Ada', founderNumber: 4, createdAt: new Date('2026-07-01T00:00:00.000Z').getTime() })
    expect(JSON.stringify(res.body)).not.toContain('secret-token')
  })
})

function responseRecorder() {
  const recorder = { statusCode: 200, body: undefined as unknown, status(code: number) { recorder.statusCode = code; return { json(body: unknown) { recorder.body = body } } } }
  return recorder
}
