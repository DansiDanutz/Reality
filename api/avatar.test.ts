import { get, put } from '@vercel/blob'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import rawHandler from './avatar'
import { withCitizenSessionHandler } from './_sessionTest'

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://avatar-written' })),
}))

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'avatar-token'
const handler = withCitizenSessionHandler(rawHandler, CITIZEN_ID, TOKEN)

beforeEach(() => {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
})

afterEach(() => {
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.mocked(get).mockReset()
  vi.mocked(put).mockClear()
})

describe('avatar API request authority', () => {
  test('does not authenticate legacy body credentials', async () => {
    const res = responseRecorder()
    await rawHandler({ method: 'POST', body: { citizenId: CITIZEN_ID, token: TOKEN, params: {} } } as never, res as never)
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ ok: false, code: 'client_controlled_avatar_field' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('rejects client-controlled avatar economy fields before storage or OpenAI work', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const serverOwnedFields = [
      'founderNumber',
      'balance',
      'money',
      'payoutEligibility',
      'telegramUserId',
      'generatedAt',
      'avatarUrl',
    ]

    for (const field of serverOwnedFields) {
      const res = responseRecorder()

      await handler({
        method: 'POST',
        body: {
          params: validAvatarParams(),
          [field]: field === 'balance' || field === 'money' ? 999_999 : 'client-value',
        },
      } as never, res as never)

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({
        ok: false,
        error: 'Avatar request contains fields the server must own.',
        code: 'client_controlled_avatar_field',
      })
      expect(put).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  })

  test('keeps valid avatar requests disabled until OpenAI is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        params: validAvatarParams(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'The avatar studio is not configured on this server yet.',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('generates and stores an avatar for a verified citizen request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T12:00:00.000Z'))
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    pgQueryMock.mockResolvedValueOnce([{ ok: 1 }]) // citizens-table token hash match
    pgQueryMock.mockResolvedValueOnce([{ refusal: null }]) // atomic citizen/global quota reservation
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('fake-png').toString('base64') }],
      }), { status: 200 })
    ))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        params: validAvatarParams(),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, url: `/api/avatar?cid=${CITIZEN_ID}&v=${Date.now()}` })
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/images/generations', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-openai-key' },
    }))
    expect(String(pgQueryMock.mock.calls[1][0])).toContain('reality_claim_avatar_slot')
    expect(pgQueryMock.mock.calls[1][1]).toEqual([CITIZEN_ID, '2026-07-07', 5, 500])
    expect(put).toHaveBeenCalledWith(
      `avatars/${CITIZEN_ID}.png`,
      Buffer.from('fake-png'),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/png' },
    )
    expect(put).toHaveBeenCalledWith(
      `avatarrate/${CITIZEN_ID}__2026-07-07__${Date.now()}.json`,
      JSON.stringify(validAvatarParams()),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    expect(put).toHaveBeenCalledWith(
      `avatarglobal/2026-07-07__${CITIZEN_ID}__${Date.now()}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })
})

function validAvatarParams() {
  return {
    gender: 'male',
    age: 32,
    heightCm: 180,
    weightKg: 82,
    hairColor: 'dark brown',
    hairStyle: 'short',
    eyeColor: 'brown',
  }
}

function responseRecorder(): {
  statusCode: number
  body: unknown
  status: (statusCode: number) => { json: (body: unknown) => void; end: () => void; send: (body: unknown) => void }
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
        end() {},
        send(body: unknown) {
          recorder.body = body
        },
      }
    },
  }
  return recorder
}
