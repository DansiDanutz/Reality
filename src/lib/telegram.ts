import type { Citizen } from '../game/types'

export interface TelegramMiniAppUser {
  id: string
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  photoUrl?: string
}

export interface VerifiedTelegramMiniAppSession {
  realityAccountId: string
  telegramUser: TelegramMiniAppUser
  authDate: number
  startParam?: string
}

export type TelegramMiniAppAuthResult =
  | { ok: true; session: VerifiedTelegramMiniAppSession }
  | { ok: false; reason: 'not_in_telegram' | 'request_failed' | 'invalid_session'; error?: string; code?: string }

interface TelegramWebApp {
  initData?: string
}

interface TelegramWindow {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}

const TELEGRAM_CLOCK_SKEW_SECONDS = 60

export function telegramMiniAppInitData(source: TelegramWindow = globalThis as TelegramWindow): string | null {
  const initData = source.Telegram?.WebApp?.initData
  return typeof initData === 'string' && initData.trim().length > 0 ? initData : null
}

export async function authenticateTelegramMiniApp(
  fetchImpl: typeof fetch = fetch,
  initData = telegramMiniAppInitData(),
): Promise<TelegramMiniAppAuthResult> {
  if (!initData) return { ok: false, reason: 'not_in_telegram' }

  try {
    const response = await fetchImpl('/api/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    const data = await response.json() as Record<string, unknown>
    if (response.ok && data.ok === true && isFutureTelegramAuthDate(data.authDate)) {
      return {
        ok: false,
        reason: 'invalid_session',
        error: 'Telegram session could not be verified.',
        code: 'auth_date_from_future',
      }
    }
    if (!response.ok || data.ok !== true || !isVerifiedTelegramSession(data)) {
      return {
        ok: false,
        reason: 'invalid_session',
        error: typeof data.error === 'string' ? data.error : 'Telegram session could not be verified.',
        code: typeof data.code === 'string' ? data.code : undefined,
      }
    }
    return {
      ok: true,
      session: {
        realityAccountId: data.realityAccountId,
        telegramUser: data.telegramUser,
        authDate: data.authDate,
        startParam: typeof data.startParam === 'string' ? data.startParam : undefined,
      },
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Telegram verification is unavailable.' }
  }
}

function isFutureTelegramAuthDate(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > Math.floor(Date.now() / 1000) + TELEGRAM_CLOCK_SKEW_SECONDS
}

export function citizenWithTelegramSession(
  citizen: Citizen,
  session: VerifiedTelegramMiniAppSession,
  linkedAt: number,
): Citizen {
  return {
    ...citizen,
    telegramUserId: session.telegramUser.id,
    telegramAccountId: session.realityAccountId,
    telegramUsername: session.telegramUser.username,
    telegramName: telegramDisplayName(session.telegramUser),
    telegramLinkedAt: linkedAt,
  }
}

export function telegramDisplayName(user: Pick<TelegramMiniAppUser, 'firstName' | 'lastName' | 'username'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return fullName || (user.username ? `@${user.username}` : 'Telegram')
}

function isVerifiedTelegramSession(value: Record<string, unknown>): value is Record<string, unknown> & VerifiedTelegramMiniAppSession & { ok: true } {
  const user = value.telegramUser
  const { authDate } = value
  if (!isRecord(user)) return false
  if (!isNonEmptyText(user.id) || !isNonEmptyText(user.firstName)) return false
  return value.realityAccountId === `telegram:${user.id}` &&
    typeof authDate === 'number' &&
    Number.isSafeInteger(authDate) &&
    authDate >= 0 &&
    (user.username === undefined || isNonEmptyText(user.username)) &&
    (user.lastName === undefined || isNonEmptyText(user.lastName)) &&
    (user.languageCode === undefined || isNonEmptyText(user.languageCode)) &&
    (user.photoUrl === undefined || isNonEmptyText(user.photoUrl))
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
