import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './auth-google'

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://account' })),
}))

const GOOGLE_CLIENT_ID = 'reality-google-client'
const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'founder-token'

beforeEach(() => {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
})

afterEach(() => {
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('Google auth API', () => {
  test('stays disabled with a structured response until configured', async () => {
    const res = responseRecorder()

    await handler({ method: 'POST', body: { credential: 'credential' } } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Google sign-in is not configured on this server yet.',
      code: 'google_auth_not_configured',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects credentials Google cannot verify', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid', { status: 401 })))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { credential: 'bad-token' } } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Google could not verify this sign-in.' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('links a verified Google account to a registered citizen', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    vi.stubGlobal('fetch', vi.fn(async () => googleProfileResponse()))
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }]) // citizens-table token hash match
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { credential: 'good-token', citizenId: CITIZEN_ID, token: TOKEN },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      linked: true,
      profile: {
        sub: 'google-user-1',
        email: 'david@example.test',
        name: 'David Reality',
        picture: 'https://example.test/david.png',
      },
    })
    expect(put).toHaveBeenCalledWith(
      'accounts/google-user-1.json',
      expect.stringContaining(`"citizenId":"${CITIZEN_ID}"`),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('requires CSRF proof for explicit cookie-authenticated Google linking', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    vi.stubGlobal('fetch', vi.fn(async () => googleProfileResponse()))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1` },
      body: { action: 'link', credential: 'good-token' },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('links with a CSRF-protected cookie session when action is explicit', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    vi.stubGlobal('fetch', vi.fn(async () => googleProfileResponse()))
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }])
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: {
        cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1`,
        'x-reality-csrf': 'csrf-1',
      },
      body: { action: 'link', credential: 'good-token' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, linked: true })
  })

  test('restores a linked citizen cloud save for a verified Google account', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    const account = { citizenId: CITIZEN_ID, linkedAt: '2026-07-06T00:00:00.000Z' }
    const save = JSON.stringify({ version: 1, citizen: { id: CITIZEN_ID } })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return googleProfileResponse()
      if (url === 'blob://account') return new Response(JSON.stringify(account), { status: 200 })
      if (url === 'blob://save') return new Response(save, { status: 200 })
      return new Response('not found', { status: 404 })
    }))
    pgQueryMock.mockResolvedValueOnce([{ state: JSON.parse(save) }])
    vi.mocked(list)
      .mockResolvedValueOnce(blobList(['accounts/google-user-1.json'], 'blob://account'))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { credential: 'good-token' } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      linked: true,
      profile: {
        sub: 'google-user-1',
        email: 'david@example.test',
        name: 'David Reality',
        picture: 'https://example.test/david.png',
      },
      save,
    })
    expect(list).toHaveBeenCalledTimes(1)
  })

  test('returns a structured service failure when Google or storage is unavailable', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network unavailable')
    }))
    const googleUnavailable = responseRecorder()

    await handler({ method: 'POST', body: { credential: 'good-token' } } as never, googleUnavailable as never)

    expect(googleUnavailable.statusCode).toBe(503)
    expect(googleUnavailable.body).toEqual({
      ok: false,
      error: 'Sign-in is briefly unavailable. Try again in a minute.',
      code: 'google_auth_unavailable',
    })

    vi.stubGlobal('fetch', vi.fn(async () => googleProfileResponse()))
    vi.mocked(list).mockRejectedValueOnce(new Error('blob list unavailable'))
    const storageUnavailable = responseRecorder()

    await handler({ method: 'POST', body: { credential: 'good-token' } } as never, storageUnavailable as never)

    expect(storageUnavailable.statusCode).toBe(503)
    expect(storageUnavailable.body).toEqual({
      ok: false,
      error: 'Sign-in is briefly unavailable. Try again in a minute.',
      code: 'google_auth_unavailable',
    })
  })
})

function googleProfileResponse(): Response {
  return new Response(JSON.stringify({
    aud: GOOGLE_CLIENT_ID,
    sub: 'google-user-1',
    email: 'david@example.test',
    name: 'David Reality',
    picture: 'https://example.test/david.png',
  }), { status: 200 })
}

function blobList(pathnames: string[], downloadUrl = 'blob://download'): {
  blobs: { pathname: string; downloadUrl: string }[]
  hasMore: boolean
} {
  return {
    blobs: pathnames.map((pathname) => ({ pathname, downloadUrl })),
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
