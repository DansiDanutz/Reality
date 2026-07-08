import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  requestRealityOperatorQueueToken,
  type RealityOperatorQueueAuthResult,
} from './realityOperatorAuth'

afterEach(() => {
  vi.useRealTimers()
})

describe('Reality operator auth client bridge', () => {
  test('does not request operator authority outside Telegram Mini Apps', async () => {
    const fetchImpl = vi.fn()

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, null)).resolves.toEqual({
      ok: false,
      reason: 'not_in_telegram',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('posts Telegram initData and returns a scoped queue token', async () => {
    const response = operatorAuthResponse()
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => response,
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual(response)
    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-operator-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'auth_date=1&hash=abc' }),
    })
  })

  test('maps non-allowlisted operators to a manual denial', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        ok: false,
        error: 'Telegram account is not approved for Reality operator review.',
        code: 'operator_not_allowed',
      }),
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'not_allowed',
      error: 'Telegram account is not approved for Reality operator review.',
      code: 'operator_not_allowed',
    })
  })

  test('keeps operator auth disabled when the server is not configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: 'Reality operator auth is not configured.',
        code: 'operator_auth_not_configured',
      }),
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'not_configured',
      error: 'Reality operator auth is not configured.',
      code: 'operator_auth_not_configured',
    })
  })

  test('maps Telegram verifier failures to invalid sessions by server code', async () => {
    for (const code of ['auth_date_expired', 'auth_date_from_future', 'invalid_init_data', 'missing_auth_date']) {
      const fetchImpl = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          ok: false,
          error: 'Invalid Telegram session.',
          code,
        }),
      }))

      await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
        ok: false,
        reason: 'invalid_session',
        error: 'Invalid Telegram session.',
        code,
      })
    }
  })

  test('rejects malformed successful responses without exposing a token', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, operatorToken: 'operator-token' }),
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Reality operator auth was rejected.',
      code: undefined,
    })
  })

  test('rejects successful operator responses that are already expired', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'))
    const response = operatorAuthResponse({
      expiresAt: Date.now() - 1_000,
      expiresInSeconds: 900,
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => response,
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Reality operator auth was rejected.',
      code: undefined,
    })
  })

  test('rejects successful operator responses with inconsistent expiry metadata', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'))
    const response = operatorAuthResponse({
      expiresAt: Date.now() + 3_600_000,
      expiresInSeconds: 900,
    })
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => response,
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Reality operator auth was rejected.',
      code: undefined,
    })
  })

  test('rejects successful operator responses with mismatched Telegram identity', async () => {
    const response = {
      ...operatorAuthResponse(),
      operator: {
        ...operatorAuthResponse().operator,
        telegramUserId: '42424242',
        realityAccountId: 'telegram:777',
      },
    }
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => response,
    }))

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'server_rejected',
      error: 'Reality operator auth was rejected.',
      code: undefined,
    })
  })

  test('maps request failures without retrying or persisting authority', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'request_failed',
      error: 'Reality operator auth is unavailable.',
    })
  })
})

function operatorAuthResponse(
  overrides: Partial<Extract<RealityOperatorQueueAuthResult, { ok: true }>> = {},
): Extract<RealityOperatorQueueAuthResult, { ok: true }> {
  return {
    ok: true,
    operator: {
      role: 'founder_covenant_reviewer',
      telegramUserId: '42424242',
      realityAccountId: 'telegram:42424242',
      scope: 'founder_covenant_queue',
    },
    operatorToken: 'operator-token',
    expiresAt: Date.now() + 900_000,
    expiresInSeconds: 900,
    ...overrides,
  }
}
