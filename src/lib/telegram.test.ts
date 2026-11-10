import { describe, expect, test, vi } from 'vitest'
import {
  authenticateTelegramMiniApp,
  citizenWithTelegramSession,
  insideTelegramContainer,
  telegramDisplayName,
  telegramLaunchInitData,
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

  const INIT_DATA = 'query_id=AAH&user=%7B%22id%22%3A7%7D&auth_date=1700000000&hash=abc123'
  const LAUNCH_HASH = `#tgWebAppData=${encodeURIComponent(INIT_DATA)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios`
  const memoryStorage = () => {
    const store = new Map<string, string>()
    return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  }

  test('reads the signed launch data from the URL fragment inside a Telegram app, without any Telegram script', () => {
    const sessionStorage = memoryStorage()
    const native = { TelegramWebviewProxy: { postEvent: () => {} }, sessionStorage }

    expect(telegramMiniAppInitData({ ...native, location: { hash: LAUNCH_HASH } })).toBe(INIT_DATA)
    // The fragment is gone after an in-app reload; the tab remembers it.
    expect(telegramMiniAppInitData({ ...native, location: { hash: '' } })).toBe(INIT_DATA)
    expect(telegramLaunchInitData({ TelegramWebviewProxy: {}, location: { hash: '#section' }, sessionStorage: memoryStorage() })).toBeNull()
    expect(telegramLaunchInitData({ TelegramWebviewProxy: {}, location: { hash: '#tgWebAppData=' } })).toBeNull()
  })

  test('Telegram Web frames the app: a framed page reads the fragment too', () => {
    const top = {}
    const framed = { parent: top, self: {}, location: { hash: LAUNCH_HASH }, sessionStorage: memoryStorage() }
    expect(insideTelegramContainer(framed)).toBe(true)
    expect(telegramLaunchInitData(framed)).toBe(INIT_DATA)
  })

  test("an ordinary browser tab ignores a crafted launch link — someone else's signed data cannot sign you in", () => {
    const tab: Record<string, unknown> = { location: { hash: LAUNCH_HASH }, sessionStorage: memoryStorage() }
    tab.parent = tab
    tab.self = tab
    expect(insideTelegramContainer(tab)).toBe(false)
    expect(telegramLaunchInitData(tab)).toBeNull()
    expect(telegramMiniAppInitData(tab)).toBeNull()
    // Nothing was remembered either: the same tab stays outside Telegram afterwards.
    expect(telegramMiniAppInitData({ ...tab, location: { hash: '' } })).toBeNull()
    expect(insideTelegramContainer({})).toBe(false)
  })

  test('the WebApp bridge wins when Telegram provides one, and blocked storage is harmless', () => {
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(telegramMiniAppInitData({
      Telegram: { WebApp: { initData: 'bridge=1' } },
      location: { hash: '#tgWebAppData=fragment%3D1' },
    })).toBe('bridge=1')
    expect(telegramLaunchInitData({ TelegramWebviewProxy: {}, location: { hash: '#tgWebAppData=fragment%3D1' }, sessionStorage: throwing })).toBe('fragment=1')
    expect(telegramLaunchInitData({ TelegramWebviewProxy: {}, location: { hash: '' }, sessionStorage: throwing })).toBeNull()
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

  test('maps bot-user rejection to an invalid Telegram session', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      json: async () => ({ ok: false, error: 'Invalid Telegram session.', code: 'bot_user' }),
    }))
    await expect(authenticateTelegramMiniApp(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'invalid_session',
      error: 'Invalid Telegram session.',
      code: 'bot_user',
    })
  })

  test('rejects successful Telegram sessions dated in the future', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T10:00:00.000Z'))
    const session = verifiedSession()
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, ...session, authDate: Math.floor(Date.now() / 1000) + 61 }) }))
    await expect(authenticateTelegramMiniApp(fetchImpl as never, 'auth_date=1&hash=abc')).resolves.toEqual({
      ok: false,
      reason: 'invalid_session',
      error: 'Telegram session could not be verified.',
      code: 'auth_date_from_future',
    })
    vi.useRealTimers()
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
    authDate: 1_750_000_000,
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
