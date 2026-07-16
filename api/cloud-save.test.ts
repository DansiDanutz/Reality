import { list, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './cloud-save'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://save' })),
}))

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'
const SAVE = JSON.stringify({ version: 1, citizen: { id: CITIZEN_ID, name: 'David' } })

beforeEach(() => {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('cloud save API', () => {
  test('requires CSRF proof for cookie-authenticated saves', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: { cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1` },
      body: { save: SAVE },
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })
  test('stores a valid save for a registered citizen', async () => {
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }]) // citizens-table token hash match
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: SAVE },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `saves/${CITIZEN_ID}.json`,
      SAVE,
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('scrubs bearer tokens from legacy saves before storing them', async () => {
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }])
    const res = responseRecorder()
    const save = JSON.stringify({ version: 1, citizen: { id: CITIZEN_ID, token: 'legacy-secret' } })

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(put).toHaveBeenCalledWith(
      `saves/${CITIZEN_ID}.json`,
      JSON.stringify({ version: 1, citizen: { id: CITIZEN_ID } }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('rejects malformed and oversized save payloads before storage access', async () => {
    const malformed = responseRecorder()
    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: '{not-json' },
    } as never, malformed as never)

    expect(malformed.statusCode).toBe(400)
    expect(malformed.body).toEqual({ ok: false, error: 'Invalid save payload.' })

    const oversized = responseRecorder()
    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: 'x'.repeat(256_001) },
    } as never, oversized as never)

    expect(oversized.statusCode).toBe(400)
    expect(oversized.body).toEqual({ ok: false, error: 'Invalid save payload.' })
    expect(pgQueryMock).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects cloud saves from unregistered citizens', async () => {
    pgQueryMock.mockResolvedValueOnce([]) // token hash not found
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: SAVE },
    } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Not a registered citizen.' })
    expect(put).not.toHaveBeenCalled()
  })

  test('returns a structured service failure when citizen verification storage is unavailable', async () => {
    pgQueryMock.mockRejectedValueOnce(new Error('database unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: SAVE },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Cloud save is briefly unavailable.',
      code: 'cloud_save_unavailable',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('returns a structured service failure when save storage is unavailable', async () => {
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }])
    vi.mocked(put).mockRejectedValueOnce(new Error('blob write unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: SAVE },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Cloud save is briefly unavailable.',
      code: 'cloud_save_unavailable',
    })
  })
})

function responseRecorder(): {
  statusCode: number
  body: unknown
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
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
