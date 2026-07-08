import { describe, expect, test, vi } from 'vitest'
import {
  authenticateTelegramMiniApp,
  citizenWithTelegramSession,
  telegramDisplayName,
  telegramMiniAppInitData,
  type VerifiedTelegramMiniAppSession,
} from './telegram'
import type { Citizen } from '../game/types'

describe('Telegram Mini App client bridge', () => {
  test('reads only signed initData from the Telegram WebApp bridge', () => {
    expect(telegramMiniAppInitData({})).toBeNull()
    expect(telegramMiniAppInitData({
      Telegram: {
        WebApp: {
          initData: ' query_id=abc&hash=def ',
          initDataUnsafe: { user: { id: 1 } },
        } as never,
      },
    })).toBe(' query_id=abc&hash=def ')
    expect(telegramMiniAppInitData({
      Telegram: { WebApp: { initDataUnsafe: { user: { id: 1 } } } as never },
    })).toBeNull()
  })

  test('does nothing outside Telegram Mini Apps', async () => {
    const fetchImpl = vi.fn()

    await expect(authenticateTelegramMiniApp(fetchImpl as never, null)).resolves.toEqual({
      ok: false,
      reason: 'not_in_telegram',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('posts initData to the server verifier and returns a verified session', async () => {
    const session = verifiedSession()
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, ...session }),
    }))

    await expect(authenticateTelegramMiniApp(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: true,
      session,
    })
    expect(fetchImpl).toHaveBeenCalledWith('/api/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'auth_date=1&hash=abc' }),
    })
  })

  test('returns invalid_session for failed verification responses', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      json: async () => ({ ok: false, error: 'Invalid Telegram session.', code: 'invalid_hash' }),
    }))

    await expect(authenticateTelegramMiniApp(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'invalid_session',
      error: 'Invalid Telegram session.',
      code: 'invalid_hash',
    })
  })

  test('rejects successful-looking sessions with incoherent identity fields', async () => {
    const session = verifiedSession()
    const cases = [
      { ...session, realityAccountId: 'telegram:777' },
      { ...session, authDate: -1 },
      { ...session, authDate: 1.5 },
      { ...session, telegramUser: { ...session.telegramUser, id: '' } },
      { ...session, telegramUser: { ...session.telegramUser, firstName: '   ' } },
      { ...session, telegramUser: { ...session.telegramUser, username: '' } },
    ]

    for (const payload of cases) {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, ...payload }),
      }))

      await expect(authenticateTelegramMiniApp(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
        ok: false,
        reason: 'invalid_session',
        error: 'Telegram session could not be verified.',
        code: undefined,
      })
    }
  })

  test('maps a verified Telegram session onto a local citizen', () => {
    const citizen: Citizen = {
      name: 'David',
      founderNumber: 1,
      createdAt: 1_800_000_000,
    }

    expect(citizenWithTelegramSession(citizen, verifiedSession(), 1_800_000_030)).toEqual({
      ...citizen,
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramUsername: 'davidreality',
      telegramName: 'David Reality',
      telegramLinkedAt: 1_800_000_030,
    })
    expect(telegramDisplayName({ firstName: '', username: 'fallback' })).toBe('@fallback')
  })
})

function verifiedSession(): VerifiedTelegramMiniAppSession {
  return {
    realityAccountId: 'telegram:42424242',
    authDate: 1_800_000_000,
    startParam: 'founder-seat',
    telegramUser: {
      id: '42424242',
      firstName: 'David',
      lastName: 'Reality',
      username: 'davidreality',
      languageCode: 'en',
    },
  }
}
