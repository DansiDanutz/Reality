import { normalizeTelegramInitData, telegramMiniAppInitData } from './telegram'

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

export async function requestRealityOperatorQueueToken(
  fetchImpl: typeof fetch = fetch,
  initData = telegramMiniAppInitData(),
): Promise<RealityOperatorQueueAuthResult> {
  const normalizedInitData = normalizeTelegramInitData(initData)
  if (!normalizedInitData) return { ok: false, reason: 'not_in_telegram' }

  try {
    const response = await fetchImpl('/api/reality-operator-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: normalizedInitData }),
    })
    const data = await response.json() as Record<string, unknown>
    const queueAuth = parseRealityOperatorQueueAuthResponse(data)
    if (response.ok && data.ok === true && queueAuth) {
      return {
        ok: true,
        operator: queueAuth.operator,
        operatorToken: queueAuth.operatorToken,
        expiresAt: queueAuth.expiresAt,
        expiresInSeconds: queueAuth.expiresInSeconds,
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
  if (status === 401 || code === 'invalid_hash' || code === 'expired_auth_date' || code === 'missing_hash') {
    return 'invalid_session'
  }
  return 'server_rejected'
}

function parseRealityOperatorQueueAuthResponse(value: Record<string, unknown>): {
  operator: RealityOperatorQueueAuthOperator
  operatorToken: string
  expiresAt: number
  expiresInSeconds: number
} | null {
  if (
    typeof value.operatorToken !== 'string' ||
    !Number.isSafeInteger(value.expiresAt) ||
    !Number.isSafeInteger(value.expiresInSeconds)
  ) {
    return null
  }

  const operator = parseRealityOperatorQueueAuthOperator(value.operator)
  const operatorToken = value.operatorToken.trim()
  const expiresAt = Number(value.expiresAt)
  const expiresInSeconds = Number(value.expiresInSeconds)
  if (!operator || operatorToken.length === 0 || expiresInSeconds <= 0) return null

  return {
    operator,
    operatorToken,
    expiresAt,
    expiresInSeconds,
  }
}

function parseRealityOperatorQueueAuthOperator(value: unknown): RealityOperatorQueueAuthOperator | null {
  if (
    !isRecord(value) ||
    value.role !== 'founder_covenant_reviewer' ||
    typeof value.telegramUserId !== 'string' ||
    typeof value.realityAccountId !== 'string' ||
    value.scope !== 'founder_covenant_queue'
  ) {
    return null
  }

  const telegramUserId = value.telegramUserId.trim()
  const realityAccountId = value.realityAccountId.trim()
  if (
    telegramUserId.length === 0 ||
    !realityAccountId.startsWith('telegram:') ||
    realityAccountId !== `telegram:${telegramUserId}`
  ) {
    return null
  }

  return {
    role: 'founder_covenant_reviewer',
    telegramUserId,
    realityAccountId,
    scope: 'founder_covenant_queue',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
