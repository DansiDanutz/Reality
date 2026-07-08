import { createHash, createHmac } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler from './register'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const BOT_TOKEN = '123456:telegram-secret'
const NOW_SECONDS = 1_783_307_000
const REGISTER_IP = '203.0.113.42'
const REGISTER_IP_HASH = createHash('sha256').update(REGISTER_IP).digest('hex').slice(0, 16)
const REGISTER_DAY = new Date(NOW_SECONDS * 1000).toISOString().slice(0, 10)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
})

describe('register API Telegram identity bridge', () => {
  test('optionally verifies Telegram initData and stores the verified account on the citizen record', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([]))
      .mockResolvedValueOnce(blobList([]))
    const initData = signedInitData({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({
        id: 42424242,
        first_name: 'David',
        last_name: 'Reality',
        username: 'davidreality',
      }),
    })
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.42' },
      body: { name: 'David', telegramInitData: initData },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      founderNumber: 1,
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: NOW_SECONDS * 1000,
    })
    expect(put).toHaveBeenCalledWith(
      'telegram-users/42424242.json',
      expect.stringContaining('"realityAccountId":"telegram:42424242"'),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    const body = res.body as { citizenId: string; token: string }
    const telegramPut = vi.mocked(put).mock.calls.find(([pathname]) => pathname === 'telegram-users/42424242.json')
    expect(JSON.parse(String(telegramPut?.[1]))).toMatchObject({
      realityAccountId: 'telegram:42424242',
      telegramUserId: '42424242',
      citizenId: body.citizenId,
      founderNumber: 1,
      citizenLinkedAt: new Date(NOW_SECONDS * 1000).toISOString(),
    })
    expect(JSON.parse(String(telegramPut?.[1]))).not.toHaveProperty('token')
    const tokenHash = createHash('sha256').update(body.token).digest('hex').slice(0, 24)
    const citizenPut = vi.mocked(put).mock.calls.find(([pathname]) =>
      pathname === `citizens/${body.citizenId}__${tokenHash}__1.json`
    )
    expect(citizenPut).toBeDefined()
    expect(JSON.parse(String(citizenPut?.[1]))).toMatchObject({
      name: 'David',
      createdAt: new Date(NOW_SECONDS * 1000).toISOString(),
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: new Date(NOW_SECONDS * 1000).toISOString(),
    })
  })

  test('rejects supplied Telegram initData when the signature is not valid', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        name: 'David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David' }),
        }).replace('David', 'Attacker'),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Invalid Telegram session.', code: 'invalid_hash' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('keeps non-Telegram registration available', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.42' },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, founderNumber: 1 })
    const citizenPut = vi.mocked(put).mock.calls.find(([pathname]) =>
      typeof pathname === 'string' && pathname.startsWith('citizens/')
    )
    expect(JSON.parse(String(citizenPut?.[1]))).toEqual({
      name: 'David',
      createdAt: expect.any(String),
    })
  })

  test('returns structured storage failure when registration safety scan is unavailable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.mocked(list).mockRejectedValueOnce(new Error('registration safety list unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Registration safety check is temporarily unavailable. Try again in a minute.',
      code: 'registration_safety_unavailable',
    })
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ prefix: `regip/${REGISTER_IP_HASH}__${REGISTER_DAY}`, limit: 6 })
    expect(put).not.toHaveBeenCalled()
  })

  test('returns structured storage failure when registration safety marker cannot be written', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    vi.mocked(put).mockRejectedValueOnce(new Error('registration safety marker unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Registration safety check is temporarily unavailable. Try again in a minute.',
      code: 'registration_safety_unavailable',
    })
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ prefix: `regip/${REGISTER_IP_HASH}__${REGISTER_DAY}`, limit: 6 })
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith(
      `regip/${REGISTER_IP_HASH}__${REGISTER_DAY}__${NOW_SECONDS * 1000}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    expect(vi.mocked(put).mock.calls.some(([pathname]) =>
      typeof pathname === 'string' &&
      (pathname.startsWith('names/') || pathname.startsWith('founders/') || pathname.startsWith('citizens/') || pathname.startsWith('telegram-users/'))
    )).toBe(false)
  })
})

function signedInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
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
