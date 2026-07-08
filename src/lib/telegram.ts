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
  | { ok: false; reason: 'not_in_telegram' | 'request_failed' | 'invalid_session' | 'not_allowed'; error?: string; code?: string }

const TELEGRAM_NOT_ALLOWED_ERROR_CODES = new Set([
  'bot_user_not_allowed',
])

interface TelegramWebApp {
  initData?: string
}

interface TelegramWindow {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}

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
      const code = typeof data.code === 'string' ? data.code : undefined
      return {
        ok: false,
        reason: telegramMiniAppAuthFailureReason(code),
        error: typeof data.error === 'string' ? data.error : 'Telegram session could not be verified.',
        code,
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

export function telegramMiniAppAuthErrorMessage(result: Exclude<TelegramMiniAppAuthResult, { ok: true }>): string {
  if (result.error) return result.error
  switch (result.reason) {
    case 'not_allowed':
      return 'Telegram bot accounts cannot sign in to Reality.'
    case 'request_failed':
      return 'Telegram verification is unavailable.'
    case 'invalid_session':
      return 'Telegram session could not be verified.'
    case 'not_in_telegram':
      return 'Telegram Mini App session not detected.'
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

function telegramMiniAppAuthFailureReason(
  code: string | undefined,
): Exclude<TelegramMiniAppAuthResult, { ok: true }>['reason'] {
  if (code !== undefined && TELEGRAM_NOT_ALLOWED_ERROR_CODES.has(code)) return 'not_allowed'
  return 'invalid_session'
}

function isVerifiedTelegramSession(value: Record<string, unknown>): value is Record<string, unknown> & VerifiedTelegramMiniAppSession & { ok: true } {
  const user = value.telegramUser
  return typeof value.realityAccountId === 'string' &&
    value.realityAccountId.startsWith('telegram:') &&
    Number.isFinite(value.authDate) &&
    isRecord(user) &&
    typeof user.id === 'string' &&
    typeof user.firstName === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
