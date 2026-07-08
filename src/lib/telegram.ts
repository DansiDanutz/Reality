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

const TELEGRAM_AUTH_FUTURE_SKEW_SECONDS = 60

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
  const authDate = value.authDate
  if (typeof authDate !== 'number' || !Number.isFinite(authDate)) return false
  const nowSeconds = Math.floor(Date.now() / 1000)
  return typeof value.realityAccountId === 'string' &&
    value.realityAccountId.startsWith('telegram:') &&
    authDate <= nowSeconds + TELEGRAM_AUTH_FUTURE_SKEW_SECONDS &&
    isRecord(user) &&
    typeof user.id === 'string' &&
    typeof user.firstName === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
