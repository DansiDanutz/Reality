import { telegramMiniAppInitData } from './telegram'

export interface RealityOperatorQueueAuthOperator {
  role: 'founder_covenant_reviewer'
  telegramUserId: string
  realityAccountId: string
  scope: 'founder_covenant_queue'
}

export type RealityOperatorQueueAuthResult =
  | {
    ok: true
    operator: RealityOperatorQueueAuthOperator
    operatorToken: string
    expiresAt: number
    expiresInSeconds: number
  }
  | {
    ok: false
    reason: 'not_in_telegram' | 'request_failed' | 'invalid_session' | 'not_allowed' | 'not_configured' | 'server_rejected'
    error?: string
    code?: string
  }

const TELEGRAM_SESSION_ERROR_CODES = new Set([
  'invalid_init_data',
  'missing_hash',
  'invalid_hash',
  'missing_auth_date',
  'auth_date_expired',
  'auth_date_from_future',
  'missing_user',
  'invalid_user',
  'bot_user_not_allowed',
])

export async function requestRealityOperatorQueueToken(
  fetchImpl: typeof fetch = fetch,
  initData = telegramMiniAppInitData(),
): Promise<RealityOperatorQueueAuthResult> {
  if (!initData || initData.trim().length === 0) return { ok: false, reason: 'not_in_telegram' }

  try {
    const response = await fetchImpl('/api/reality-operator-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    const data = await response.json() as Record<string, unknown>
    if (response.ok && data.ok === true && isRealityOperatorQueueAuthResponse(data)) {
      return {
        ok: true,
        operator: data.operator,
        operatorToken: data.operatorToken,
        expiresAt: data.expiresAt,
        expiresInSeconds: data.expiresInSeconds,
      }
    }

    const code = typeof data.code === 'string' ? data.code : undefined
    return {
      ok: false,
      reason: operatorAuthFailureReason(response.status, code),
      error: typeof data.error === 'string' ? data.error : 'Reality operator auth was rejected.',
      code,
    }
  } catch {
    return { ok: false, reason: 'request_failed', error: 'Reality operator auth is unavailable.' }
  }
}

function operatorAuthFailureReason(
  status: number,
  code: string | undefined,
): Exclude<RealityOperatorQueueAuthResult, { ok: true }>['reason'] {
  if (status === 403 || code === 'operator_not_allowed') return 'not_allowed'
  if (status === 503 || code === 'missing_bot_token' || code === 'operator_auth_not_configured') return 'not_configured'
  if (status === 401 || (code !== undefined && TELEGRAM_SESSION_ERROR_CODES.has(code))) {
    return 'invalid_session'
  }
  return 'server_rejected'
}

function isRealityOperatorQueueAuthResponse(value: Record<string, unknown>): value is Record<string, unknown> & {
  operator: RealityOperatorQueueAuthOperator
  operatorToken: string
  expiresAt: number
  expiresInSeconds: number
} {
  const { expiresAt, expiresInSeconds } = value
  return isRealityOperatorQueueAuthOperator(value.operator) &&
    typeof value.operatorToken === 'string' &&
    value.operatorToken.trim().length > 0 &&
    typeof expiresAt === 'number' &&
    Number.isSafeInteger(expiresAt) &&
    typeof expiresInSeconds === 'number' &&
    Number.isSafeInteger(expiresInSeconds) &&
    expiresInSeconds > 0
}

function isRealityOperatorQueueAuthOperator(value: unknown): value is RealityOperatorQueueAuthOperator {
  if (!isRecord(value) || typeof value.telegramUserId !== 'string') return false
  const telegramUserId = value.telegramUserId.trim()
  return value.role === 'founder_covenant_reviewer' &&
    telegramUserId.length > 0 &&
    value.realityAccountId === `telegram:${telegramUserId}` &&
    value.scope === 'founder_covenant_queue'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
