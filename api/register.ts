import { createHash, randomUUID } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import {
  FOUNDER_SLOTS,
  citizenRowFromRegistration,
  claimFounderNumberPg,
  insertCitizenRow,
  updateCitizenAfterClaim,
} from './_registry.js'
import {
  telegramRealityAccountPath,
  telegramRealityAccountRecord,
  verifyTelegramMiniAppInitData,
  type TelegramRealityAccountRecord,
} from './telegram-auth.js'

const REGISTRATION_SAFETY_UNAVAILABLE_RESPONSE = {
  ok: false,
  error: 'Registration safety check is temporarily unavailable. Try again in a minute.',
  code: 'registration_safety_unavailable',
} as const

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * Citizen registration + the real founder registry — Postgres-authoritative
 * since the Phase 1b.6 cutover (issue #902):
 *
 *   - the citizens_name_slug_key unique index is the identity claim (first
 *     insert wins — the old names/<slug>.json allowOverwrite:false, in SQL)
 *   - the founder slot comes from claimFounderNumberPg, guarded by the
 *     partial unique index on founder_number — two citizens can never hold
 *     the same number, exactly 2,000, first come first served
 *
 * The citizens/ and telegram-users/ Blob records are still written AFTER the
 * authoritative commit, best-effort: endpoints outside this epic
 * (reality-area, avatar, cloud-save) authenticate against Blob until they
 * migrate. A mirror failure is logged, never surfaced.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { name, telegramInitData } = (req.body ?? {}) as { name?: string; telegramInitData?: unknown }
  const clean = String(name ?? '').trim()
  if (clean.length < 2 || clean.length > 24) {
    res.status(400).json({ ok: false, error: 'Name must be 2–24 characters.' })
    return
  }
  // The identity slug strips everything but letters and digits — a name made
  // only of punctuation would reduce to an empty slug and collide with every
  // other such name on citizens_name_slug_key. Reject it up front.
  if (!/[a-z0-9]/i.test(clean)) {
    res.status(400).json({ ok: false, error: 'Name must include at least one letter or number.' })
    return
  }

  const telegramInitDataInput = readOptionalTelegramInitData(telegramInitData)
  if (telegramInitDataInput === false) {
    res.status(400).json({
      ok: false,
      error: 'Telegram initData must be a signed Mini App string.',
      code: 'invalid_telegram_init_data',
    })
    return
  }

  const verifiedTelegram = telegramInitDataInput
    ? verifyTelegramMiniAppInitData(telegramInitDataInput, process.env.TELEGRAM_BOT_TOKEN)
    : null
  if (verifiedTelegram && !verifiedTelegram.ok) {
    const status = verifiedTelegram.error === 'missing_bot_token' ? 503 : 401
    res.status(status).json({
      ok: false,
      error: verifiedTelegram.error === 'missing_bot_token'
        ? 'Telegram auth is not configured.'
        : 'Invalid Telegram session.',
      code: verifiedTelegram.error,
    })
    return
  }

  try {
    const registeredAt = new Date()
    const verifiedTelegramSession = verifiedTelegram?.ok ? verifiedTelegram : null

    // Bot brake: a handful of citizens per IP per day is plenty for humans
    const ip = String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').split(',')[0].trim()
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
    const day = registeredAt.toISOString().slice(0, 10)
    const safetyPrefix = `regip/${ipHash}__${day}`
    let recent: Awaited<ReturnType<typeof list>>
    try {
      recent = await list({ prefix: safetyPrefix, limit: 6 })
    } catch {
      res.status(503).json(REGISTRATION_SAFETY_UNAVAILABLE_RESPONSE)
      return
    }
    if (recent.blobs.length >= 5) {
      res.status(429).json({ ok: false, error: 'Too many new citizens from this connection today. Try again tomorrow.' })
      return
    }
    try {
      await put(`${safetyPrefix}__${Date.now()}.json`, '1', {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      })
    } catch {
      res.status(503).json(REGISTRATION_SAFETY_UNAVAILABLE_RESPONSE)
      return
    }

    const citizenId = randomUUID()
    const token = randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
    const sql = db() as unknown as SqlClient

    // The identity claim: the name_slug unique index makes the first insert
    // win — a 23505 here means the name already belongs to a citizen.
    try {
      await insertCitizenRow(sql, citizenRowFromRegistration({
        citizenId,
        name: clean,
        tokenHash,
        founderNumber: null,
        registeredAt,
        record: citizenRecord(clean, registeredAt, null),
        telegram: null,
      }))
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ ok: false, code: 'name_taken', error: 'That name already belongs to a citizen.' })
        return
      }
      throw error
    }

    // First come, first served, exactly 2,000 — the partial unique index is
    // the race guard, and a repeat claim returns the already-held slot.
    const founderNumber = await claimFounderNumberPg(sql, citizenId)

    const telegramAccountRecord = verifiedTelegramSession
      ? telegramRealityAccountRecord(verifiedTelegramSession, registeredAt, null, {
        citizenId,
        founderNumber,
        citizenLinkedAt: registeredAt.toISOString(),
      })
      : null
    const record = citizenRecord(clean, registeredAt, telegramAccountRecord)
    const telegramId = telegramAccountRecord ? Number(telegramAccountRecord.telegramUserId) : Number.NaN
    await updateCitizenAfterClaim(sql, citizenId, record, Number.isSafeInteger(telegramId) ? telegramId : null)

    // Blob compatibility mirror — endpoints outside this epic still
    // authenticate against citizens/ and telegram-users/. Best-effort:
    // the registration above is already durable in Postgres.
    try {
      await put(
        `citizens/${citizenId}__${tokenHash}__${founderNumber ?? 0}.json`,
        JSON.stringify(record),
        { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
      )
      if (telegramAccountRecord && verifiedTelegramSession) {
        await put(
          telegramRealityAccountPath(verifiedTelegramSession.user),
          JSON.stringify(telegramAccountRecord),
          { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
        )
      }
    } catch (error) {
      console.error(`register: blob compatibility mirror failed for citizen ${citizenId} (postgres registration is durable)`, error)
    }

    res.status(200).json({
      ok: true,
      citizenId,
      token,
      founderNumber,
      slotsClaimed: founderNumber ?? FOUNDER_SLOTS,
      slotsTotal: FOUNDER_SLOTS,
      ...(telegramAccountRecord ? {
        telegramUserId: telegramAccountRecord.telegramUserId,
        telegramAccountId: telegramAccountRecord.realityAccountId,
        telegramUsername: telegramAccountRecord.username,
        telegramName: telegramDisplayName(telegramAccountRecord),
        telegramLinkedAt: registeredAt.getTime(),
      } : {}),
    })
  } catch (error) {
    console.error('register: registration failed', error)
    res.status(500).json({ ok: false, error: 'Registration is briefly unavailable. Try again in a minute.' })
  }
}

function citizenRecord(name: string, createdAt: Date, telegram: TelegramRealityAccountRecord | null) {
  return {
    name,
    createdAt: createdAt.toISOString(),
    ...(telegram ? {
      telegramUserId: telegram.telegramUserId,
      telegramAccountId: telegram.realityAccountId,
      telegramUsername: telegram.username,
      telegramName: telegramDisplayName(telegram),
      telegramLinkedAt: createdAt.toISOString(),
    } : {}),
  }
}

function readOptionalTelegramInitData(value: unknown): string | null | false {
  if (value === undefined) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : false
}

function telegramDisplayName(telegram: Pick<TelegramRealityAccountRecord, 'firstName' | 'lastName' | 'username'>): string {
  const fullName = [telegram.firstName, telegram.lastName].filter(Boolean).join(' ').trim()
  return fullName || (telegram.username ? `@${telegram.username}` : 'Telegram')
}
