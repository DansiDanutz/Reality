import { createHmac, timingSafeEqual } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const WEB_APP_DATA_KEY = 'WebAppData'
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60
const CLOCK_SKEW_SECONDS = 60
const HASH_RE = /^[a-f0-9]{64}$/i

export interface TelegramMiniAppUser {
  id: string
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  photoUrl?: string
  isBot?: boolean
  isPremium?: boolean
  allowsWriteToPm?: boolean
}

export type VerifyTelegramMiniAppInitDataError =
  | 'missing_bot_token'
  | 'invalid_init_data'
  | 'missing_hash'
  | 'invalid_hash'
  | 'missing_auth_date'
  | 'auth_date_expired'
  | 'auth_date_from_future'
  | 'missing_user'
  | 'invalid_user'

export type VerifyTelegramMiniAppInitDataResult =
  | {
    ok: true
    user: TelegramMiniAppUser
    authDate: number
    queryId?: string
    startParam?: string
    realityAccountId: string
  }
  | { ok: false; error: VerifyTelegramMiniAppInitDataError }

export interface VerifyTelegramMiniAppInitDataOptions {
  nowSeconds?: number
  maxAgeSeconds?: number
}

export interface TelegramRealityAccountRecord {
  realityAccountId: string
  telegramUserId: string
  citizenId?: string
  founderNumber?: number | null
  citizenLinkedAt?: string
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  photoUrl?: string
  authDate: number
  lastVerifiedAt: string
  provider: 'telegram-mini-app'
}

export function verifyTelegramMiniAppInitData(
  initData: string,
  botToken: string | undefined,
  options: VerifyTelegramMiniAppInitDataOptions = {},
): VerifyTelegramMiniAppInitDataResult {
  if (!botToken?.trim()) return { ok: false, error: 'missing_bot_token' }
  const parsed = parseInitData(initData)
  if (!parsed.ok) return parsed

  const expectedHash = telegramMiniAppHash(parsed.dataCheckString, botToken)
  if (!safeHexEqual(parsed.hash, expectedHash)) return { ok: false, error: 'invalid_hash' }

  const authDate = readUnixSeconds(parsed.fields.get('auth_date'))
  if (authDate === null) return { ok: false, error: 'missing_auth_date' }

  const nowSeconds = Math.floor(options.nowSeconds ?? Date.now() / 1000)
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS
  if (authDate > nowSeconds + CLOCK_SKEW_SECONDS) return { ok: false, error: 'auth_date_from_future' }
  if (nowSeconds - authDate > maxAgeSeconds) return { ok: false, error: 'auth_date_expired' }

  const rawUser = parsed.fields.get('user')
  if (!rawUser) return { ok: false, error: 'missing_user' }
  const user = parseTelegramMiniAppUser(rawUser)
  if (!user) return { ok: false, error: 'invalid_user' }

  return {
    ok: true,
    user,
    authDate,
    queryId: optionalText(parsed.fields.get('query_id')),
    startParam: optionalText(parsed.fields.get('start_param')),
    realityAccountId: realityTelegramAccountId(user),
  }
}

export function realityTelegramAccountId(user: Pick<TelegramMiniAppUser, 'id'>): string {
  return `telegram:${user.id}`
}

export function telegramRealityAccountPath(user: Pick<TelegramMiniAppUser, 'id'>): string {
  return `telegram-users/${user.id}.json`
}

export function telegramRealityAccountRecord(
  verified: Extract<VerifyTelegramMiniAppInitDataResult, { ok: true }>,
  lastVerifiedAt: Date,
  existing: TelegramRealityAccountRecord | null = null,
  citizenLink: { citizenId: string; founderNumber: number | null; citizenLinkedAt: string } | null = null,
): TelegramRealityAccountRecord {
  const citizenId = citizenLink?.citizenId ?? existing?.citizenId
  const founderNumber = citizenLink ? citizenLink.founderNumber : existing?.founderNumber
  const citizenLinkedAt = citizenLink?.citizenLinkedAt ?? existing?.citizenLinkedAt
  return {
    realityAccountId: verified.realityAccountId,
    telegramUserId: verified.user.id,
    ...(citizenId ? { citizenId } : {}),
    ...(founderNumber !== undefined ? { founderNumber } : {}),
    ...(citizenLinkedAt ? { citizenLinkedAt } : {}),
    firstName: verified.user.firstName,
    lastName: verified.user.lastName,
    username: verified.user.username,
    languageCode: verified.user.languageCode,
    photoUrl: verified.user.photoUrl,
    authDate: verified.authDate,
    lastVerifiedAt: lastVerifiedAt.toISOString(),
    provider: 'telegram-mini-app',
  }
}

async function readTelegramRealityAccountRecord(
  user: Pick<TelegramMiniAppUser, 'id'>,
): Promise<TelegramRealityAccountRecord | null> {
  const path = telegramRealityAccountPath(user)
  const batch = await list({ prefix: path, limit: 1 })
  const url = batch.blobs.find((blob) => blob.pathname === path)?.downloadUrl ?? batch.blobs[0]?.downloadUrl
  if (!url) return null

  const response = await fetch(url)
  if (!response.ok) return null
  const value = await response.json() as unknown
  return isTelegramRealityAccountRecord(value, user) ? value : null
}

function parseInitData(initData: string): { ok: true; fields: Map<string, string>; hash: string; dataCheckString: string } | { ok: false; error: VerifyTelegramMiniAppInitDataError } {
  if (typeof initData !== 'string' || initData.trim().length === 0) return { ok: false, error: 'invalid_init_data' }
  const params = new URLSearchParams(initData)
  const fields = new Map<string, string>()
  let hash: string | null = null

  for (const [key, value] of params.entries()) {
    if (!key || fields.has(key)) return { ok: false, error: 'invalid_init_data' }
    if (key === 'hash') {
      if (hash !== null) return { ok: false, error: 'invalid_init_data' }
      hash = value
      continue
    }
    fields.set(key, value)
  }

  if (!hash) return { ok: false, error: 'missing_hash' }
  if (!HASH_RE.test(hash)) return { ok: false, error: 'invalid_hash' }
  if (fields.size === 0) return { ok: false, error: 'invalid_init_data' }

  return {
    ok: true,
    fields,
    hash,
    dataCheckString: [...fields.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  }
}

function telegramMiniAppHash(dataCheckString: string, botToken: string): string {
  const secretKey = createHmac('sha256', WEB_APP_DATA_KEY).update(botToken).digest()
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
}

function safeHexEqual(actual: string, expected: string): boolean {
  if (!HASH_RE.test(actual) || !HASH_RE.test(expected)) return false
  const actualBytes = Buffer.from(actual, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function readUnixSeconds(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const seconds = Number(value)
  return isUnixSeconds(seconds) ? seconds : null
}

function parseTelegramMiniAppUser(rawUser: string): TelegramMiniAppUser | null {
  let value: unknown
  try {
    value = JSON.parse(rawUser)
  } catch {
    return null
  }
  if (!isRecord(value)) return null
  const id = value.id
  const firstName = optionalText(value.first_name)
  if (!Number.isSafeInteger(id) || id < 0 || !firstName) return null

  return {
    id: String(id),
    firstName,
    lastName: optionalText(value.last_name),
    username: optionalText(value.username),
    languageCode: optionalText(value.language_code),
    photoUrl: optionalText(value.photo_url),
    isBot: optionalBoolean(value.is_bot),
    isPremium: optionalBoolean(value.is_premium),
    allowsWriteToPm: optionalBoolean(value.allows_write_to_pm),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isUnixSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isTelegramRealityAccountRecord(
  value: unknown,
  user: Pick<TelegramMiniAppUser, 'id'>,
): value is TelegramRealityAccountRecord {
  if (!isRecord(value)) return false
  if (value.realityAccountId !== realityTelegramAccountId(user)) return false
  if (value.telegramUserId !== user.id) return false
  if (value.provider !== 'telegram-mini-app') return false
  if (typeof value.firstName !== 'string' || !isUnixSeconds(value.authDate) || typeof value.lastVerifiedAt !== 'string') {
    return false
  }
  if (value.citizenId !== undefined && (typeof value.citizenId !== 'string' || !value.citizenId)) return false
  if (value.founderNumber !== undefined && value.founderNumber !== null && typeof value.founderNumber !== 'number') return false
  if (value.citizenLinkedAt !== undefined && typeof value.citizenLinkedAt !== 'string') return false
  return true
}

function readInitData(req: VercelRequest): string | null {
  const body = req.body as { initData?: unknown } | undefined
  return typeof body?.initData === 'string' ? body.initData : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const initData = readInitData(req)
  if (!initData) {
    res.status(400).json({ ok: false, error: 'Missing Telegram initData.' })
    return
  }

  const verified = verifyTelegramMiniAppInitData(initData, process.env.TELEGRAM_BOT_TOKEN)
  if (!verified.ok) {
    const status = verified.error === 'missing_bot_token' ? 503 : 401
    res.status(status).json({
      ok: false,
      error: verified.error === 'missing_bot_token'
        ? 'Telegram auth is not configured.'
        : 'Invalid Telegram session.',
      code: verified.error,
    })
    return
  }

  let accountRecord: TelegramRealityAccountRecord
  try {
    const existingRecord = await readTelegramRealityAccountRecord(verified.user)
    accountRecord = telegramRealityAccountRecord(verified, new Date(), existingRecord)
    await put(
      telegramRealityAccountPath(verified.user),
      JSON.stringify(accountRecord),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  } catch {
    res.status(500).json({ ok: false, error: 'Telegram identity is briefly unavailable.' })
    return
  }

  res.status(200).json({
    ok: true,
    telegramUser: verified.user,
    realityAccountId: verified.realityAccountId,
    account: accountRecord,
    authDate: verified.authDate,
    queryId: verified.queryId,
    startParam: verified.startParam,
  })
}
