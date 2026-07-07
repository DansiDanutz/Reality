import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  isRealityOperatorTelegramUser,
  realityOperatorQueueTokenClaims,
  signRealityOperatorQueueToken,
} from './reality-operator-token'
import { verifyTelegramMiniAppInitData } from './telegram-auth'

const OPERATOR_QUEUE_TOKEN_TTL_MS = 15 * 60 * 1000

function readInitData(req: VercelRequest): string | null {
  const body = req.body as { initData?: unknown } | undefined
  return typeof body?.initData === 'string' && body.initData.trim().length > 0 ? body.initData : null
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

  if (!isRealityOperatorTelegramUser(verified.user.id, process.env.REALITY_OPERATOR_TELEGRAM_IDS)) {
    res.status(403).json({
      ok: false,
      error: 'Telegram account is not approved for Reality operator review.',
      code: 'operator_not_allowed',
    })
    return
  }

  const issuedAt = Date.now()
  const claims = realityOperatorQueueTokenClaims(verified.user.id, issuedAt, OPERATOR_QUEUE_TOKEN_TTL_MS)
  const operatorToken = claims
    ? signRealityOperatorQueueToken(claims, process.env.REALITY_OPERATOR_AUTH_SECRET)
    : null
  if (!claims || !operatorToken) {
    res.status(503).json({
      ok: false,
      error: 'Reality operator auth is not configured.',
      code: 'operator_auth_not_configured',
    })
    return
  }

  res.status(200).json({
    ok: true,
    operator: {
      role: 'founder_covenant_reviewer',
      telegramUserId: verified.user.id,
      realityAccountId: verified.realityAccountId,
      scope: 'founder_covenant_queue',
    },
    operatorToken,
    expiresAt: claims.expiresAt,
    expiresInSeconds: Math.floor(OPERATOR_QUEUE_TOKEN_TTL_MS / 1000),
  })
}
