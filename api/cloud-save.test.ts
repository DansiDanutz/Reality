import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './cloud-save'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://save' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'
const SAVE = JSON.stringify({ version: 1, citizen: { id: CITIZEN_ID, name: 'David' } })

afterEach(() => {
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('cloud save API', () => {
  test('stores a valid save for a registered citizen', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([citizenTokenPath(CITIZEN_ID, TOKEN)]))
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
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects cloud saves from unregistered citizens', async () => {
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
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
    vi.mocked(list).mockRejectedValueOnce(new Error('blob list unavailable'))
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
    vi.mocked(list).mockResolvedValueOnce(blobList([citizenTokenPath(CITIZEN_ID, TOKEN)]))
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

function citizenTokenPath(citizenId: string, token: string): string {
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  return `citizens/${citizenId}__${tokenHash}__1.json`
}

function blobList(pathnames: string[]): { blobs: { pathname: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore: false,
  }
}

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
