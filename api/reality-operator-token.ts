import { createHmac, timingSafeEqual } from 'node:crypto'

const OPERATOR_TOKEN_VERSION = 'roqt1'
const OPERATOR_QUEUE_TOKEN_KIND = 'founder_covenant_queue'
const TELEGRAM_USER_ID_RE = /^\d{1,32}$/

export interface RealityOperatorQueueTokenClaims {
  kind: typeof OPERATOR_QUEUE_TOKEN_KIND
  telegramUserId: string
  issuedAt: number
  expiresAt: number
}

export type VerifyRealityOperatorQueueTokenResult =
  | { ok: true; claims: RealityOperatorQueueTokenClaims }
  | { ok: false; error: 'missing_secret' | 'invalid_token' | 'expired_token' | 'issued_in_future' }

export function realityOperatorTelegramIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter((value) => TELEGRAM_USER_ID_RE.test(value)),
  )
}

export function isRealityOperatorTelegramUser(telegramUserId: string, rawAllowlist: string | undefined): boolean {
  return realityOperatorTelegramIds(rawAllowlist).has(telegramUserId)
}

export function signRealityOperatorQueueToken(
  claims: RealityOperatorQueueTokenClaims,
  secret: string | undefined,
): string | null {
  const cleanSecret = secret?.trim()
  if (!cleanSecret || !isRealityOperatorQueueTokenClaims(claims)) return null
  const payload = base64UrlEncode(JSON.stringify(claims))
  const signature = signPayload(payload, cleanSecret)
  return `${OPERATOR_TOKEN_VERSION}.${payload}.${signature}`
}

export function verifyRealityOperatorQueueToken(
  token: string | null | undefined,
  secret: string | undefined,
  nowMs = Date.now(),
): VerifyRealityOperatorQueueTokenResult {
  const cleanSecret = secret?.trim()
  if (!cleanSecret) return { ok: false, error: 'missing_secret' }
  const parts = token?.trim().split('.') ?? []
  if (parts.length !== 3 || parts[0] !== OPERATOR_TOKEN_VERSION) return { ok: false, error: 'invalid_token' }
  const [, payload, signature] = parts
  if (!payload || !signature || !safeEqual(signature, signPayload(payload, cleanSecret))) {
    return { ok: false, error: 'invalid_token' }
  }

  const claims = parseClaims(payload)
  if (!claims) return { ok: false, error: 'invalid_token' }
  if (claims.issuedAt > nowMs) return { ok: false, error: 'issued_in_future' }
  if (claims.expiresAt <= nowMs) return { ok: false, error: 'expired_token' }
  return { ok: true, claims }
}

export function realityOperatorQueueTokenClaims(
  telegramUserId: string,
  issuedAtMs: number,
  ttlMs: number,
): RealityOperatorQueueTokenClaims | null {
  if (!TELEGRAM_USER_ID_RE.test(telegramUserId)) return null
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0 || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) return null
  const expiresAt = issuedAtMs + ttlMs
  if (!Number.isSafeInteger(expiresAt)) return null
  return {
    kind: OPERATOR_QUEUE_TOKEN_KIND,
    telegramUserId,
    issuedAt: issuedAtMs,
    expiresAt,
  }
}

function parseClaims(payload: string): RealityOperatorQueueTokenClaims | null {
  let value: unknown
  try {
    value = JSON.parse(base64UrlDecode(payload))
  } catch {
    return null
  }
  return isRealityOperatorQueueTokenClaims(value) ? value : null
}

function isRealityOperatorQueueTokenClaims(value: unknown): value is RealityOperatorQueueTokenClaims {
  return isRecord(value) &&
    value.kind === OPERATOR_QUEUE_TOKEN_KIND &&
    typeof value.telegramUserId === 'string' &&
    TELEGRAM_USER_ID_RE.test(value.telegramUserId) &&
    Number.isSafeInteger(value.issuedAt) &&
    Number.isSafeInteger(value.expiresAt) &&
    value.expiresAt > value.issuedAt
}

function signPayload(payload: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(payload).digest())
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
