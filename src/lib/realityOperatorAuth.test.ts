import { describe, expect, test, vi } from 'vitest'
import {
  requestRealityOperatorQueueToken,
  type RealityOperatorQueueAuthResult,
} from './realityOperatorAuth'

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

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, ' auth_date=1&hash=abc ')).resolves.toEqual(response)
    expect(fetchImpl).toHaveBeenCalledWith('/api/reality-operator-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'auth_date=1&hash=abc' }),
    })
  })

  test('does not request operator authority with blank explicit initData', async () => {
    const fetchImpl = vi.fn()

    await expect(requestRealityOperatorQueueToken(fetchImpl as never, '   ')).resolves.toEqual({
      ok: false,
      reason: 'not_in_telegram',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
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

function operatorAuthResponse(): RealityOperatorQueueAuthResult {
  return {
    ok: true,
    operator: {
      role: 'founder_covenant_reviewer',
      telegramUserId: '42424242',
      realityAccountId: 'telegram:42424242',
      scope: 'founder_covenant_queue',
    },
    operatorToken: 'operator-token',
    expiresAt: 1_783_000_900_000,
    expiresInSeconds: 900,
  }
}
