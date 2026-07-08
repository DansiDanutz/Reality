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

export function telegramMiniAppInitData(source: TelegramWindow = globalThis as TelegramWindow): string | null {
  const initData = source.Telegram?.WebApp?.initData
  return typeof initData === 'string' && initData.trim().length > 0 ? initData : null
}

export async function authenticateTelegramMiniApp(
  fetchImpl: typeof fetch = fetch,
  initData = telegramMiniAppInitData(),
): Promise<TelegramMiniAppAuthResult> {
  const normalizedInitData = normalizeTelegramInitData(initData)
  if (!normalizedInitData) return { ok: false, reason: 'not_in_telegram' }

  try {
    const response = await fetchImpl('/api/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: normalizedInitData }),
    })
    const data = await response.json() as Record<string, unknown>
    const session = parseVerifiedTelegramSession(data)
    if (!response.ok || data.ok !== true || !session) {
      return {
        ok: false,
        reason: 'invalid_session',
        error: typeof data.error === 'string' ? data.error : 'Telegram session could not be verified.',
        code: typeof data.code === 'string' ? data.code : undefined,
      }
    }
    return {
      ok: true,
      session,
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

export function normalizeTelegramInitData(initData: string | null | undefined): string | null {
  if (typeof initData !== 'string') return null
  const normalized = initData.trim()
  return normalized.length > 0 ? normalized : null
}

function parseVerifiedTelegramSession(value: Record<string, unknown>): VerifiedTelegramMiniAppSession | null {
  const user = value.telegramUser
  if (
    typeof value.realityAccountId !== 'string' ||
    !Number.isFinite(value.authDate) ||
    !isRecord(user) ||
    typeof user.id !== 'string' ||
    typeof user.firstName !== 'string'
  ) {
    return null
  }
  const realityAccountId = value.realityAccountId.trim()
  const telegramUserId = user.id.trim()
  const firstName = user.firstName.trim()
  const authDate = Number(value.authDate)
  if (
    !realityAccountId.startsWith('telegram:') ||
    telegramUserId.length === 0 ||
    firstName.length === 0 ||
    realityAccountId !== `telegram:${telegramUserId}`
  ) {
    return null
  }
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : undefined
  const username = typeof user.username === 'string' ? user.username.trim() : undefined
  const languageCode = typeof user.languageCode === 'string' ? user.languageCode.trim() : undefined
  const photoUrl = typeof user.photoUrl === 'string' ? user.photoUrl.trim() : undefined
  const startParam = typeof value.startParam === 'string' ? value.startParam.trim() : undefined
  return {
    realityAccountId,
    authDate,
    startParam: startParam || undefined,
    telegramUser: {
      id: telegramUserId,
      firstName,
      ...(lastName ? { lastName } : {}),
      ...(username ? { username } : {}),
      ...(languageCode ? { languageCode } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
