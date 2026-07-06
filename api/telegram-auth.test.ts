import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import handler, {
  realityTelegramAccountId,
  verifyTelegramMiniAppInitData,
} from './telegram-auth'

const BOT_TOKEN = '123456:REALITY_TEST_BOT_TOKEN'
const NOW_SECONDS = 1_800_000_000

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
  })

  test('builds deterministic Telegram Reality account ids', () => {
    expect(realityTelegramAccountId({ id: '42424242' })).toBe('telegram:42424242')
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
