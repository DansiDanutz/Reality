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

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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

  test('rejects Telegram registration when the account already belongs to a citizen', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.mocked(list).mockResolvedValueOnce(blobList(['telegram-users/42424242.json'], 'blob://telegram-existing'))
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        realityAccountId: 'telegram:42424242',
        telegramUserId: '42424242',
        citizenId: '11111111-1111-4111-8111-111111111111',
        founderNumber: 12,
        citizenLinkedAt: '2026-07-06T01:00:00.000Z',
        firstName: 'David',
        username: 'davidreality',
        authDate: NOW_SECONDS - 60,
        lastVerifiedAt: '2026-07-06T01:00:00.000Z',
        provider: 'telegram-mini-app',
      }), { status: 200 })
    ))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.42' },
      body: {
        name: 'Second David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David', username: 'davidreality' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      code: 'telegram_account_taken',
      error: 'This Telegram account is already linked to a Reality citizen.',
    })
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith({ prefix: 'telegram-users/42424242.json', limit: 1 })
    expect(put).not.toHaveBeenCalled()
  })

  test('links an unclaimed Telegram auth record during first registration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList(['telegram-users/42424242.json'], 'blob://telegram-existing'))
      .mockResolvedValueOnce(blobList([]))
      .mockResolvedValueOnce(blobList([]))
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        realityAccountId: 'telegram:42424242',
        telegramUserId: '42424242',
        firstName: 'Old',
        username: 'oldusername',
        authDate: NOW_SECONDS - 120,
        lastVerifiedAt: '2026-07-06T01:00:00.000Z',
        provider: 'telegram-mini-app',
      }), { status: 200 })
    ))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.42' },
      body: {
        name: 'David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David', username: 'davidreality' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    const telegramPut = vi.mocked(put).mock.calls.find(([pathname]) => pathname === 'telegram-users/42424242.json')
    expect(JSON.parse(String(telegramPut?.[1]))).toMatchObject({
      realityAccountId: 'telegram:42424242',
      telegramUserId: '42424242',
      citizenId: expect.any(String),
      founderNumber: 1,
      citizenLinkedAt: new Date(NOW_SECONDS * 1000).toISOString(),
      firstName: 'David',
      username: 'davidreality',
      lastVerifiedAt: new Date(NOW_SECONDS * 1000).toISOString(),
    })
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
