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
  citizenId?: string
  online?: boolean
  save?: string
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

interface TelegramLaunchSource extends TelegramWindow {
  location?: { hash?: string }
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'>
  /** Injected by Telegram's native apps into the Mini App webview. */
  TelegramWebviewProxy?: unknown
  external?: unknown
  parent?: unknown
  self?: unknown
}

/**
 * Is this page really running inside Telegram? Native apps inject a bridge
 * object; Telegram Web frames the app (and the CSP lets nobody else frame it).
 * A plain browser tab is neither — which is what makes a hand-made
 * `#tgWebAppData=` link worthless there.
 */
export function insideTelegramContainer(source: TelegramLaunchSource = globalThis as TelegramLaunchSource): boolean {
  try {
    if (source.TelegramWebviewProxy !== undefined && source.TelegramWebviewProxy !== null) return true
    const external = source.external as { notify?: unknown } | null | undefined
    if (external && typeof external === 'object' && typeof external.notify === 'function') return true
    return source.parent !== undefined && source.self !== undefined && source.parent !== source.self
  } catch {
    return true // a cross-origin parent that throws on access is still a parent
  }
}

const LAUNCH_DATA_KEY = 'reality-telegram-init-data'

/**
 * Telegram hands a Mini App its signed launch data in the URL fragment
 * (`#tgWebAppData=<url-encoded initData>&tgWebAppVersion=…`). Reading it here
 * means the app needs no third-party script; the server verifies the
 * signature either way. The fragment is gone after an in-app reload, so the
 * value is kept for the tab's lifetime.
 *
 * Only honoured inside a real Telegram container. The signature proves which
 * Telegram user the data belongs to, not that THIS browser is theirs: in an
 * ordinary tab, a link carrying someone else's valid launch data would sign
 * the visitor into that person's citizen, or bind a new citizen to them.
 */
export function telegramLaunchInitData(source: TelegramLaunchSource = globalThis as TelegramLaunchSource): string | null {
  if (!insideTelegramContainer(source)) return null
  let fromHash: string | null = null
  try {
    const hash = String(source.location?.hash ?? '').replace(/^#/, '')
    fromHash = hash.includes('tgWebAppData=') ? new URLSearchParams(hash).get('tgWebAppData') : null
  } catch {
    fromHash = null
  }
  try {
    if (fromHash && fromHash.trim().length > 0) {
      source.sessionStorage?.setItem(LAUNCH_DATA_KEY, fromHash)
      return fromHash
    }
    const remembered = source.sessionStorage?.getItem(LAUNCH_DATA_KEY)
    return typeof remembered === 'string' && remembered.trim().length > 0 ? remembered : null
  } catch {
    return fromHash && fromHash.trim().length > 0 ? fromHash : null
  }
}

export function telegramMiniAppInitData(source: TelegramLaunchSource = globalThis as TelegramLaunchSource): string | null {
  const initData = source.Telegram?.WebApp?.initData
  if (typeof initData === 'string' && initData.trim().length > 0) return initData
  return telegramLaunchInitData(source)
}

export async function authenticateTelegramMiniApp(
  fetchImpl: typeof fetch = fetch,
  initData = telegramMiniAppInitData(),
  restore = false,
): Promise<TelegramMiniAppAuthResult> {
  if (!initData) return { ok: false, reason: 'not_in_telegram' }

  try {
    const response = await fetchImpl('/api/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, ...(restore ? { restore: true } : {}) }),
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
        ...(typeof data.citizenId === 'string' ? { citizenId: data.citizenId } : {}),
        ...(typeof data.session === 'boolean' ? { online: data.session } : {}),
        ...(typeof data.save === 'string' ? { save: data.save } : {}),
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
