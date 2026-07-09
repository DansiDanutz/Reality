import { db, isPostgresEnabled } from './_db.js'

/**
 * Phase 1b.2 registry dual-write (issue #897). Underscore prefix keeps Vercel
 * from exposing this as an endpoint — shared helper for api/ only.
 *
 * Blob stays authoritative in this phase: registration writes to Blob first,
 * then mirrors the citizen into Postgres when POSTGRES_ENABLED is on. Reads
 * do not change. The cutover PR (Phase 1b.6) flips authority.
 */

const FOUNDER_SLOTS = 2_000
const CLAIM_RETRY_BUDGET = 8

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
 * ON CONFLICT DO NOTHING is the Postgres twin of Blob's allowOverwrite:false:
 * a citizen id can only ever be written once, so dual-write and the one-shot
 * migration script can both run against the same table safely.
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

/**
 * Best-effort mirror of a freshly registered citizen. Never throws: with Blob
 * authoritative, a Postgres outage must not fail a registration that already
 * succeeded — the miss is logged and the migration script backfills it.
 */
export async function dualWriteCitizenRow(row: CitizenRow, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isPostgresEnabled(env)) return
  try {
    await insertCitizenRow(db(env) as unknown as SqlClient, row)
  } catch (error) {
    console.error(`register: postgres dual-write failed for citizen ${row.citizenId} (blob remains authoritative)`, error)
  }
}

/**
 * Postgres founder race guard for the cutover (ships dark in this PR).
 * A single atomic UPDATE claims the lowest free slot; the partial unique
 * index citizens_founder_number_key guarantees two racers can never commit
 * the same number — the loser hits 23505 and retries against fresh state,
 * exactly the allowOverwrite:false semantics of the Blob registry.
 * Returns null once all slots are taken.
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
      return rows[0]?.founder_number ?? null
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error
      lastCollision = error // another racer committed our slot first — retry sees fresh state
    }
  }
  throw lastCollision
}
