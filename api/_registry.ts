import { createHash } from 'node:crypto'
import { db } from './_db.js'

/**
 * Registry helpers (Phase 1b.2 dual-write, cut over to authoritative in
 * issue #902). Underscore prefix keeps Vercel from exposing this as an
 * endpoint — shared helper for api/ only.
 *
 * Since the cutover, the citizens table IS the registry: registration
 * inserts here first (the name_slug unique index is the identity claim),
 * the founder slot is claimed atomically against the partial unique index,
 * and citizen authentication reads the token hash from this table.
 */

export const FOUNDER_SLOTS = 2_000
const CLAIM_RETRY_BUDGET = 8
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type CitizenRow = {
  citizenId: string
  name: string
  tokenHash: string
  founderNumber: number | null
  telegramUserId: number | null
  createdAt: string
  raw: Record<string, unknown>
}

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * ON CONFLICT (citizen_id) DO NOTHING only absorbs id re-inserts — a
 * violation of citizens_name_slug_key (someone else holds the name) still
 * raises 23505, which the caller maps to name_taken. That unique index is
 * the race guard: first insert wins, exactly like the old Blob
 * names/<slug>.json allowOverwrite:false claim.
 */
export const CITIZEN_INSERT_SQL = `
  INSERT INTO citizens (citizen_id, name, token_hash, founder_number, telegram_user_id, created_at, raw)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
  ON CONFLICT (citizen_id) DO NOTHING
`.trim()

/** Shapes a citizens-table row from the values register.ts already computed. */
export function citizenRowFromRegistration(input: {
  citizenId: string
  name: string
  tokenHash: string
  founderNumber: number | null
  registeredAt: Date
  record: Record<string, unknown>
  telegram: { telegramUserId: string } | null
}): CitizenRow {
  const telegramId = input.telegram ? Number(input.telegram.telegramUserId) : Number.NaN
  return {
    citizenId: input.citizenId,
    name: input.name,
    tokenHash: input.tokenHash,
    founderNumber: input.founderNumber,
    telegramUserId: Number.isSafeInteger(telegramId) ? telegramId : null,
    createdAt: input.registeredAt.toISOString(),
    raw: input.record,
  }
}

export async function insertCitizenRow(sql: SqlClient, row: CitizenRow): Promise<void> {
  await sql.query(CITIZEN_INSERT_SQL, [
    row.citizenId,
    row.name,
    row.tokenHash,
    row.founderNumber,
    row.telegramUserId,
    row.createdAt,
    JSON.stringify(row.raw),
  ])
}

/** Refreshes raw and telegram linkage once the founder number is known. */
export async function updateCitizenAfterClaim(
  sql: SqlClient,
  citizenId: string,
  raw: Record<string, unknown>,
  telegramUserId: number | null,
): Promise<void> {
  await sql.query(
    'UPDATE citizens SET raw = $2::jsonb, telegram_user_id = $3 WHERE citizen_id = $1',
    [citizenId, JSON.stringify(raw), telegramUserId],
  )
}

/**
 * Citizen authentication from the citizens table — the cutover twin of the
 * old Blob pathname-prefix lookup. Only the sha256 token hash is stored,
 * exactly as before.
 */
export async function verifyCitizenPg(
  citizenId: string,
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(
    'SELECT 1 AS ok FROM citizens WHERE citizen_id = $1 AND token_hash = $2 LIMIT 1',
    [citizenId, tokenHash],
  )) as unknown[]
  return rows.length > 0
}

/**
 * The founder race guard. A single atomic UPDATE claims the lowest free
 * slot; the partial unique index citizens_founder_number_key guarantees two
 * racers can never commit the same number — the loser hits 23505 and
 * retries against fresh state. Returns null once all slots are taken.
 * A repeat claim by the same citizen (UPDATE matches no rows because
 * founder_number is already set) re-selects and returns the held slot.
 */
export async function claimFounderNumberPg(
  sql: SqlClient,
  citizenId: string,
  maxSlots: number = FOUNDER_SLOTS,
): Promise<number | null> {
  const statement = `
    UPDATE citizens SET founder_number = (
      SELECT n FROM generate_series(1, $2) AS n
      WHERE NOT EXISTS (SELECT 1 FROM citizens taken WHERE taken.founder_number = n)
      ORDER BY n LIMIT 1
    )
    WHERE citizen_id = $1 AND founder_number IS NULL
    RETURNING founder_number
  `.trim()

  let lastCollision: unknown = null
  for (let attempt = 0; attempt < CLAIM_RETRY_BUDGET; attempt++) {
    try {
      const rows = (await sql.query(statement, [citizenId, maxSlots])) as Array<{ founder_number: number | null }>
      if (rows.length === 0) {
        // Already claimed (or unknown citizen) — return what the row holds.
        const held = (await sql.query(
          'SELECT founder_number FROM citizens WHERE citizen_id = $1',
          [citizenId],
        )) as Array<{ founder_number: number | null }>
        return held[0]?.founder_number ?? null
      }
      return rows[0]?.founder_number ?? null
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error
      lastCollision = error // another racer committed our slot first — retry sees fresh state
    }
  }
  throw lastCollision
}
