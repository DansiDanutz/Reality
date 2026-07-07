import { createHmac } from 'node:crypto'
import { describe, expect, test, vi, afterEach } from 'vitest'
import handler from './reality-operator-auth'
import {
  isRealityOperatorTelegramUser,
  realityOperatorQueueTokenClaims,
  signRealityOperatorQueueToken,
  verifyRealityOperatorQueueToken,
} from './reality-operator-token'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(),
}))

const BOT_TOKEN = '123456:REALITY_TEST_BOT_TOKEN'
const OPERATOR_SECRET = 'operator-auth-secret'
const NOW_SECONDS = 1_800_000_000

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Reality operator Telegram auth', () => {
  test('issues a short-lived founder covenant queue token for allowlisted Telegram operators', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T10:00:00.000Z'))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.stubEnv('REALITY_OPERATOR_TELEGRAM_IDS', '42424242,777')
    vi.stubEnv('REALITY_OPERATOR_AUTH_SECRET', OPERATOR_SECRET)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        initData: signedInitData({
          auth_date: String(Math.floor(Date.now() / 1000) - 30),
          user: JSON.stringify({ id: 42_424_242, first_name: 'David', username: 'davidreality' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      operator: {
        role: 'founder_covenant_reviewer',
        telegramUserId: '42424242',
        realityAccountId: 'telegram:42424242',
        scope: 'founder_covenant_queue',
      },
      expiresAt: Date.now() + 15 * 60 * 1000,
      expiresInSeconds: 900,
    })
    const token = (res.body as { operatorToken: string }).operatorToken
    expect(verifyRealityOperatorQueueToken(token, OPERATOR_SECRET, Date.now())).toEqual({
      ok: true,
      claims: {
        kind: 'founder_covenant_queue',
        telegramUserId: '42424242',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
    })
  })

  test('rejects non-allowlisted Telegram operators before issuing a token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.stubEnv('REALITY_OPERATOR_TELEGRAM_IDS', '777')
    vi.stubEnv('REALITY_OPERATOR_AUTH_SECRET', OPERATOR_SECRET)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        initData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42_424_242, first_name: 'David' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      ok: false,
      error: 'Telegram account is not approved for Reality operator review.',
      code: 'operator_not_allowed',
    })
  })

  test('stays disabled until the signing secret is configured', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    vi.stubEnv('REALITY_OPERATOR_TELEGRAM_IDS', '42424242')
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        initData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42_424_242, first_name: 'David' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Reality operator auth is not configured.',
      code: 'operator_auth_not_configured',
    })
  })

  test('validates operator queue token signatures, expiry, scope, and allowlist parsing', () => {
    expect(isRealityOperatorTelegramUser('42424242', '  777 42424242,bad-id ')).toBe(true)
    expect(isRealityOperatorTelegramUser('9', '  777 42424242,bad-id ')).toBe(false)
    const claims = realityOperatorQueueTokenClaims('42424242', 1_000, 900_000)
    expect(claims).toEqual({
      kind: 'founder_covenant_queue',
      telegramUserId: '42424242',
      issuedAt: 1_000,
      expiresAt: 901_000,
    })
    const token = signRealityOperatorQueueToken(claims!, OPERATOR_SECRET)
    expect(token).toBeTruthy()
    expect(verifyRealityOperatorQueueToken(token, OPERATOR_SECRET, 2_000)).toEqual({ ok: true, claims })
    expect(verifyRealityOperatorQueueToken(`${token}x`, OPERATOR_SECRET, 2_000)).toEqual({
      ok: false,
      error: 'invalid_token',
    })
    expect(verifyRealityOperatorQueueToken(token, OPERATOR_SECRET, 901_000)).toEqual({
      ok: false,
      error: 'expired_token',
    })
    expect(signRealityOperatorQueueToken(claims!, undefined)).toBeNull()
    expect(verifyRealityOperatorQueueToken(token, undefined, 2_000)).toEqual({
      ok: false,
      error: 'missing_secret',
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
