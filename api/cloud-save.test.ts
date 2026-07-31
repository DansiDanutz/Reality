import { list, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import rawHandler from './cloud-save'
import { withCitizenSessionHandler } from './_sessionTest'

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
const handler = withCitizenSessionHandler(rawHandler, CITIZEN_ID, TOKEN)
const SAVE = JSON.stringify({ state: { citizen: { id: CITIZEN_ID, name: 'David' }, lastSeenAt: 123 }, version: 6 })

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
  test('does not authenticate legacy body credentials', async () => {
    const res = responseRecorder()
    await rawHandler({ method: 'POST', body: { citizenId: CITIZEN_ID, token: TOKEN, save: SAVE } } as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, code: 'session_required' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

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
  test('rejects a save whose embedded citizen differs from the cookie session', async () => {
    const res = responseRecorder()
    const mismatchedSave = JSON.stringify({
      state: { citizen: { id: '22222222-2222-4222-8222-222222222222', name: 'Mallory' } },
      version: 6,
    })

    await handler({
      method: 'POST',
      body: { save: mismatchedSave },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      ok: false,
      error: 'Cloud save identity does not match the active session.',
      code: 'citizen_mismatch',
    })
    expect(pgQueryMock).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('stores a valid save for a registered citizen', async () => {
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }]) // citizens-table token hash match
    pgQueryMock.mockResolvedValueOnce([{ accepted: true }]) // monotonic cloud-save reservation
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
    pgQueryMock.mockResolvedValueOnce([{ accepted: true }])
    const res = responseRecorder()
    const save = JSON.stringify({ state: { citizen: { id: CITIZEN_ID, token: 'legacy-secret' } }, version: 6 })

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(put).toHaveBeenCalledWith(
      `saves/${CITIZEN_ID}.json`,
      JSON.stringify({ state: { citizen: { id: CITIZEN_ID } }, version: 6 }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('rejects a save older than the authoritative cloud snapshot', async () => {
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }])
    pgQueryMock.mockResolvedValueOnce([{ accepted: false }])
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { citizenId: CITIZEN_ID, token: TOKEN, save: JSON.stringify({ state: { lastSeenAt: 100, citizen: { id: CITIZEN_ID } }, version: 6 }) },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, error: 'A newer cloud save already exists.', code: 'stale_save' })
    expect(put).not.toHaveBeenCalled()
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
    pgQueryMock.mockResolvedValueOnce([{ accepted: true }])
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
