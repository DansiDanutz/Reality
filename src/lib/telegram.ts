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
  launchContext?: TelegramLaunchContext
}

export interface TelegramLaunchContext {
  source: 'telegram-mini-app'
  startParam: string
  capturedAt: string
  inviteTrackingEnabled: false
  automaticGrowthRewardsEnabled: false
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
        launchContext: isTelegramLaunchContext(data.launchContext) ? data.launchContext : undefined,
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

function isTelegramLaunchContext(value: unknown): value is TelegramLaunchContext {
  return isRecord(value) &&
    value.source === 'telegram-mini-app' &&
    typeof value.startParam === 'string' &&
    /^[A-Za-z0-9_-]{1,96}$/.test(value.startParam) &&
    typeof value.capturedAt === 'string' &&
    value.inviteTrackingEnabled === false &&
    value.automaticGrowthRewardsEnabled === false
}
