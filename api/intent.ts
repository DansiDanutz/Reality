import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from './_vercel.js'
import { SHIFT_HOURS, XP_PER_SHIFT, applyXp } from '../src/game/engine.js'
import { itemById, jobById } from '../src/game/catalog.js'
import { db } from './_db.js'
import { verifyCitizenPg } from './_registry.js'
import { csrfMatches, sessionFromCookie } from './_session.js'

/**
 * Phase 1b.5 intent/ledger core (issue #904): the server-authoritative
 * economy. Every intent is validated against the SAME pure engine rules the
 * client runs (src/game/engine.ts + catalog.ts — imported directly, never
 * duplicated), then appended to the ledger in one atomic statement that
 * carries the running balance. The ledger IS the economy's source of truth.
 *
 *
 * The client predicts optimistically and sends predictedBalance only as a
 * drift hint; the database owns genesis and every subsequent balance.
 */

const MAX_BUY_QUANTITY = 10
const INTENTS_PER_HOUR = 120
const BALANCE_EPSILON = 0.01
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{1,128}$/

export type Intent =
  | { type: 'workShift'; jobId: string }
  | { type: 'buyItem'; itemId: string; quantity: number }
  | { type: 'placeAsset'; itemId: string }

type Rejection = { ok: false; code: string; error: string }
type Normalized = { ok: true; intent: Intent } | Rejection
type Evaluated = { ok: true; amount: number; meta: Record<string, unknown> } | Rejection

/** Exact allow-list per intent type — anything else is a smuggling attempt. */
const INTENT_FIELDS: Record<Intent['type'], ReadonlySet<string>> = {
  workShift: new Set(['type', 'jobId']),
  buyItem: new Set(['type', 'itemId', 'quantity']),
  placeAsset: new Set(['type', 'itemId']),
}

function reject(code: string, error: string): Rejection {
  return { ok: false, code, error }
}

/**
 * Shape validation: strict field allow-lists. The client names an intent
 * and its inputs — every economic value (wage, price, amount, balance) is
 * server-computed, so any extra field is rejected outright.
 */
export function normalizeIntent(input: unknown): Normalized {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return reject('unsupported_intent', 'Intent must be an object with a type.')
  }
  const raw = input as Record<string, unknown>
  const type = raw.type
  if (type !== 'workShift' && type !== 'buyItem' && type !== 'placeAsset') {
    return reject('unsupported_intent', 'Unknown intent type.')
  }
  if (Object.keys(raw).some((key) => !INTENT_FIELDS[type].has(key))) {
    return reject('client_controlled_server_field', 'Client-controlled server fields are not allowed.')
  }

  if (type === 'workShift') {
    const jobId = String(raw.jobId ?? '')
    if (!jobId) return reject('invalid_job', 'A job id is required.')
    return { ok: true, intent: { type, jobId } }
  }
  const itemId = String(raw.itemId ?? '')
  if (!itemId) return reject('invalid_item', 'An item id is required.')
  if (type === 'placeAsset') {
    return { ok: true, intent: { type, itemId } }
  }
  const quantity = raw.quantity === undefined ? 1 : raw.quantity
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BUY_QUANTITY) {
    return reject('invalid_quantity', `Quantity must be a whole number between 1 and ${MAX_BUY_QUANTITY}.`)
  }
  return { ok: true, intent: { type, itemId, quantity } }
}

/**
 * Rule validation: prices, wages and requirements come from the SAME catalog
 * and engine constants the client simulation uses — the server never trusts
 * a client number and never re-implements a rule.
 */
export function evaluateIntent(intent: Intent, citizenLevel: number): Evaluated {
  if (intent.type === 'workShift') {
    const job = jobById(intent.jobId)
    if (!job) return reject('unknown_job', 'That job does not exist.')
    if (citizenLevel < job.requiredLevel) {
      return reject('level_too_low', `${job.title} requires level ${job.requiredLevel}.`)
    }
    return {
      ok: true,
      amount: job.wage * SHIFT_HOURS,
      meta: { jobId: job.id, wage: job.wage, hours: SHIFT_HOURS, xp: XP_PER_SHIFT },
    }
  }
  const item = itemById(intent.itemId)
  if (!item) return reject('unknown_item', 'That item does not exist.')
  if (intent.type === 'placeAsset') {
    if (!item.placeable) return reject('not_placeable', 'That item cannot be placed in the world.')
    return { ok: true, amount: -item.price, meta: { itemId: item.id, price: item.price } }
  }
  return {
    ok: true,
    amount: -item.price * intent.quantity,
    meta: { itemId: item.id, quantity: intent.quantity, unitPrice: item.price },
  }
}

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

const RATE_COUNT_SQL = `
  SELECT count(*)::int AS count FROM ledger
  WHERE citizen_id = $1 AND intent LIKE 'intent.%' AND created_at > now() - interval '1 hour'
`.trim()

// The citizen's level is DERIVED from their earned ledger XP (issue #1010):
// successful intent rows carry meta.xp, the sum feeds the engine's own
// applyXp cascade. No stored level to drift; refusal rows (balance_after
// NULL) never count.
const CITIZEN_CONTEXT_SQL = `
  SELECT COALESCE((
      SELECT SUM((l.meta->>'xp')::int) FROM ledger l
      WHERE l.citizen_id = c.citizen_id
        AND l.intent LIKE 'intent.%'
        AND l.balance_after IS NOT NULL
        AND jsonb_typeof(l.meta->'xp') = 'number'
    ), 0) AS xp
  FROM citizens c
  WHERE c.citizen_id = $1
`.trim()

/**
 * The append runs inside reality_append_intent (scripts/db/schema.sql): an
 * advisory lock serializes all appends for one citizen, then a FRESH-snapshot
 * read (plpgsql re-snapshots per statement — a bare CTE cannot) feeds the
 * cooldown and overdraft gates before the insert. One call, no double-spend,
 * no double-seed, no shift replay. Refusals come back with the authoritative
 * balance and are themselves recorded as NULL-balance ledger rows, so failed
 * attempts consume rate budget and leave an audit trail.
 */
const APPEND_SQL = `
  SELECT new_balance, refusal
  FROM reality_append_intent($1, $2, $3::numeric, $4::numeric, $5::jsonb, $6::interval, $7)
`.trim()

/** A shift pays out at most once per real shift window — Rule #1, real time. */
function cooldownFor(intent: Intent): string | null {
  return intent.type === 'workShift' ? `${SHIFT_HOURS} hours` : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const { citizenId: rawCitizenId, token: rawToken, intent: rawIntent, predictedBalance, idempotencyKey: rawIdempotencyKey } = (req.body ?? {}) as Record<string, unknown>
  const cookieSession = sessionFromCookie(req)
  const bodyToken = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : null
  const cookieAuth = !bodyToken && cookieSession
  if (cookieAuth && !csrfMatches(req)) {
    res.status(403).json({ ok: false, code: 'csrf_required', error: 'A valid Reality CSRF token is required.' })
    return
  }
  const citizenId = String(rawCitizenId ?? cookieSession?.citizenId ?? '')
  const token = bodyToken ?? cookieSession?.token ?? ''
  const normalized = normalizeIntent(rawIntent)
  if (!normalized.ok) {
    res.status(normalized.code === 'unsupported_intent' ? 400 : 422).json(normalized)
    return
  }
  const suppliedIdempotencyKey = rawIdempotencyKey === undefined ? null : String(rawIdempotencyKey)
  if (suppliedIdempotencyKey !== null && !IDEMPOTENCY_KEY_RE.test(suppliedIdempotencyKey)) {
    res.status(422).json({ ok: false, code: 'invalid_idempotency_key', error: 'Idempotency keys must be 1–128 safe characters.' })
    return
  }
  const idempotencyKey = suppliedIdempotencyKey ?? randomUUID()

  try {
    if (!(await verifyCitizenPg(citizenId, String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    const sql = db() as unknown as SqlClient

    const rate = (await sql.query(RATE_COUNT_SQL, [citizenId])) as Array<{ count: number }>
    // A caller retrying a known key must reach the atomic function so it can
    // replay the original result instead of being hidden by this fast gate.
    if (suppliedIdempotencyKey === null && (rate[0]?.count ?? 0) >= INTENTS_PER_HOUR) {
      res.status(429).json({ ok: false, code: 'intent_rate_limited', error: 'Too many intents this hour. Slow down.' })
      return
    }

    const context = (await sql.query(CITIZEN_CONTEXT_SQL, [citizenId])) as Array<{ xp: string | number | null }>
    // SUM() is a bigint aggregate — Neon returns it as a string
    const totalXp = Number(context[0]?.xp ?? 0)
    const level = applyXp(1, 0, Number.isFinite(totalXp) ? totalXp : 0).level

    const evaluated = evaluateIntent(normalized.intent, level)
    if (!evaluated.ok) {
      res.status(422).json(evaluated)
      return
    }

    const appended = (await sql.query(APPEND_SQL, [
      citizenId,
      `intent.${normalized.intent.type}`,
      evaluated.amount,
      0,
      JSON.stringify(evaluated.meta),
      cooldownFor(normalized.intent),
      idempotencyKey,
    ])) as Array<{ new_balance: string | number | null; refusal: string | null }>

    const outcome = appended[0]
    if (outcome?.refusal === 'cooldown') {
      res.status(429).json({
        ok: false,
        code: 'shift_too_soon',
        error: `A shift takes ${SHIFT_HOURS} real hours — the next one has not opened yet.`,
      })
      return
    }
    if (outcome?.refusal === 'rate_limited') {
      res.status(429).json({ ok: false, code: 'intent_rate_limited', error: 'Too many intents this hour. Slow down.' })
      return
    }
    if (!outcome || outcome.refusal === 'insufficient_funds') {
      const balance = outcome?.new_balance !== null && outcome?.new_balance !== undefined ? Number(outcome.new_balance) : 0
      res.status(422).json({
        ok: false,
        code: 'insufficient_funds',
        error: 'Not enough money for that.',
        correction: { balance },
      })
      return
    }

    const balance = Number(outcome.new_balance)
    const body: Record<string, unknown> = {
      ok: true,
      intent: normalized.intent.type,
      amount: evaluated.amount,
      level,
      balance,
    }
    if (normalized.intent.type === 'workShift') body.xp = XP_PER_SHIFT
    // Correction frame: the client predicted a post-intent balance; when the
    // authoritative number disagrees, the client must snap to the server's.
    if (typeof predictedBalance === 'number' && Math.abs(predictedBalance - balance) > BALANCE_EPSILON) {
      body.correction = { balance, predicted: predictedBalance, drift: balance - predictedBalance }
    }
    res.status(200).json(body)
  } catch (error) {
    console.error('intent: append failed', {
      citizenId,
      intent: normalized.intent.type,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    res.status(500).json({ ok: false, error: 'The economy is briefly unavailable.' })
  }
}
