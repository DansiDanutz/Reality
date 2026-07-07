import { createHmac } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import handler, {
  realityTelegramAccountId,
  telegramRealityAccountPath,
  telegramRealityAccountRecord,
  verifyTelegramMiniAppInitData,
} from './telegram-auth'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://telegram-users/42424242.json' })),
}))

const BOT_TOKEN = '123456:REALITY_TEST_BOT_TOKEN'
const NOW_SECONDS = 1_800_000_000

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  delete process.env.TELEGRAM_BOT_TOKEN
})

describe('telegram Mini App auth', () => {
  test('verifies Telegram Mini App initData and maps it to a Reality account id', () => {
    const initData = signedInitData({
      auth_date: String(NOW_SECONDS - 60),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      start_param: 'founder-seat',
      signature: 'test-signature',
      user: JSON.stringify({
        id: 42_424_242,
        first_name: 'David',
        last_name: 'Reality',
        username: 'davidreality',
        language_code: 'en',
        is_premium: true,
        allows_write_to_pm: true,
      }),
    })

    expect(verifyTelegramMiniAppInitData(initData, BOT_TOKEN, { nowSeconds: NOW_SECONDS })).toEqual({
      ok: true,
      user: {
        id: '42424242',
        firstName: 'David',
        lastName: 'Reality',
        username: 'davidreality',
        languageCode: 'en',
        photoUrl: undefined,
        isBot: undefined,
        isPremium: true,
        allowsWriteToPm: true,
      },
      authDate: NOW_SECONDS - 60,
      queryId: 'AAHdF6IQAAAAAN0XohDhrOrc',
      startParam: 'founder-seat',
      realityAccountId: 'telegram:42424242',
    })
  })

  test('rejects tampered, stale, future, and unconfigured sessions', () => {
    const initData = signedInitData({
      auth_date: String(NOW_SECONDS - 60),
      user: JSON.stringify({ id: 7, first_name: 'Founder' }),
    })

    expect(verifyTelegramMiniAppInitData(
      initData.replace('Founder', 'Attacker'),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'invalid_hash' })

    expect(verifyTelegramMiniAppInitData(
      signedInitData({ auth_date: String(NOW_SECONDS - 90_000), user: JSON.stringify({ id: 7, first_name: 'Founder' }) }),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'auth_date_expired' })

    expect(verifyTelegramMiniAppInitData(
      signedInitData({ auth_date: String(NOW_SECONDS + 120), user: JSON.stringify({ id: 7, first_name: 'Founder' }) }),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'auth_date_from_future' })

    expect(verifyTelegramMiniAppInitData(initData, undefined, { nowSeconds: NOW_SECONDS }))
      .toEqual({ ok: false, error: 'missing_bot_token' })
  })

  test('rejects invalid user payloads and duplicate fields', () => {
    expect(verifyTelegramMiniAppInitData(
      signedInitData({ auth_date: String(NOW_SECONDS), user: JSON.stringify({ id: 9 }) }),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'invalid_user' })

    expect(verifyTelegramMiniAppInitData(
      signedInitData({ auth_date: String(NOW_SECONDS), user: JSON.stringify({ id: 0, first_name: 'Zero' }) }),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'invalid_user' })

    expect(verifyTelegramMiniAppInitData(
      signedInitData({ auth_date: String(NOW_SECONDS), user: JSON.stringify({ id: -1, first_name: 'Negative' }) }),
      BOT_TOKEN,
      { nowSeconds: NOW_SECONDS },
    )).toEqual({ ok: false, error: 'invalid_user' })

    const duplicateUser = signedInitData({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 9, first_name: 'Founder' }),
    }) + '&user=%7B%7D'

    expect(verifyTelegramMiniAppInitData(duplicateUser, BOT_TOKEN, { nowSeconds: NOW_SECONDS }))
      .toEqual({ ok: false, error: 'invalid_init_data' })

    const duplicateHash = signedInitData({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 9, first_name: 'Founder' }),
    }) + '&hash=' + '0'.repeat(64)

    expect(verifyTelegramMiniAppInitData(duplicateHash, BOT_TOKEN, { nowSeconds: NOW_SECONDS }))
      .toEqual({ ok: false, error: 'invalid_init_data' })
  })

  test('server handler stays disabled until a bot token is configured', async () => {
    const res = responseRecorder()
    await handler({
      method: 'POST',
      body: {
        initData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 7, first_name: 'Founder' }),
        }),
      },
    } as never, res as never)

    expect(res.headers).toEqual({ 'Cache-Control': 'no-store' })
    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Telegram auth is not configured.',
      code: 'missing_bot_token',
    })
    expect(put).not.toHaveBeenCalled()
  })

  test('server handler persists a verified Telegram identity record', async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T02:00:00.000Z'))
    try {
      const initData = signedInitData({
        auth_date: String(Math.floor(Date.now() / 1000) - 30),
        user: JSON.stringify({ id: 42_424_242, first_name: 'David', username: 'davidreality' }),
      })
      const res = responseRecorder()
      vi.mocked(list).mockResolvedValueOnce(blobList([]))

      await handler({ method: 'POST', body: { initData } } as never, res as never)

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        realityAccountId: 'telegram:42424242',
        telegramUser: { id: '42424242', firstName: 'David', username: 'davidreality' },
        account: {
          realityAccountId: 'telegram:42424242',
          telegramUserId: '42424242',
          firstName: 'David',
          username: 'davidreality',
          lastVerifiedAt: '2026-07-06T02:00:00.000Z',
          provider: 'telegram-mini-app',
        },
      })
      expect(put).toHaveBeenCalledWith(
        'telegram-users/42424242.json',
        JSON.stringify((res.body as { account: unknown }).account),
        { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
      )
    } finally {
      vi.useRealTimers()
    }
  })

  test('server handler preserves the linked Reality citizen mapping on auth refresh', async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T02:30:00.000Z'))
    try {
      const existingAccount = {
        realityAccountId: 'telegram:42424242',
        telegramUserId: '42424242',
        citizenId: '11111111-1111-4111-8111-111111111111',
        founderNumber: 12,
        citizenLinkedAt: '2026-07-06T01:00:00.000Z',
        firstName: 'David',
        username: 'oldusername',
        authDate: Math.floor(Date.now() / 1000) - 120,
        lastVerifiedAt: '2026-07-06T01:00:00.000Z',
        provider: 'telegram-mini-app',
      }
      vi.mocked(list).mockResolvedValueOnce(blobList(['telegram-users/42424242.json'], 'blob://existing-telegram'))
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(existingAccount), { status: 200 })))
      const initData = signedInitData({
        auth_date: String(Math.floor(Date.now() / 1000) - 30),
        user: JSON.stringify({ id: 42_424_242, first_name: 'David', username: 'newusername' }),
      })
      const res = responseRecorder()

      await handler({ method: 'POST', body: { initData } } as never, res as never)

      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        account: {
          realityAccountId: 'telegram:42424242',
          telegramUserId: '42424242',
          citizenId: '11111111-1111-4111-8111-111111111111',
          founderNumber: 12,
          citizenLinkedAt: '2026-07-06T01:00:00.000Z',
          username: 'newusername',
          lastVerifiedAt: '2026-07-06T02:30:00.000Z',
        },
      })
      expect(put).toHaveBeenCalledWith(
        'telegram-users/42424242.json',
        JSON.stringify((res.body as { account: unknown }).account),
        { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
      )
    } finally {
      vi.useRealTimers()
    }
  })

  test('builds deterministic Telegram Reality account ids', () => {
    expect(realityTelegramAccountId({ id: '42424242' })).toBe('telegram:42424242')
    expect(telegramRealityAccountPath({ id: '42424242' })).toBe('telegram-users/42424242.json')
    expect(telegramRealityAccountRecord({
      ok: true,
      authDate: NOW_SECONDS,
      realityAccountId: 'telegram:42424242',
      user: { id: '42424242', firstName: 'David' },
    }, new Date('2026-07-06T00:00:00.000Z'))).toEqual({
      realityAccountId: 'telegram:42424242',
      telegramUserId: '42424242',
      firstName: 'David',
      authDate: NOW_SECONDS,
      lastVerifiedAt: '2026-07-06T00:00:00.000Z',
      provider: 'telegram-mini-app',
    })
    expect(telegramRealityAccountRecord({
      ok: true,
      authDate: NOW_SECONDS,
      realityAccountId: 'telegram:42424242',
      user: { id: '42424242', firstName: 'David' },
    }, new Date('2026-07-06T00:00:00.000Z'), null, {
      citizenId: '11111111-1111-4111-8111-111111111111',
      founderNumber: 12,
      citizenLinkedAt: '2026-07-06T00:00:00.000Z',
    })).toMatchObject({
      citizenId: '11111111-1111-4111-8111-111111111111',
      founderNumber: 12,
      citizenLinkedAt: '2026-07-06T00:00:00.000Z',
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
  headers: Record<string, string>
  statusCode: number
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
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
