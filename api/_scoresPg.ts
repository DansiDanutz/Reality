import { db, isPostgresEnabled } from './_db.js'

/**
 * Phase 1b.4 leaderboard dual-write + anti-cheat (issue #900). Underscore
 * prefix keeps Vercel from exposing this as an endpoint — shared helper for
 * api/ only.
 *
 * Blob stays authoritative in this phase: a score submission writes to Blob
 * first, then mirrors into Postgres when POSTGRES_ENABLED is on. Reads do
 * not change. When the plausibility cap bites, the rejected excess is
 * recorded in the append-only ledger — an audit trail of every implausible
 * claim, ready for Phase 1b.5's server-side validation.
 */

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

export type ScoreRow = {
  citizenId: string
  name: string
  netWorth: number
  cappedWorth: number
  reportedAt: Date
}

/**
 * Plausibility ceiling: founder grant ($200k) + a generous $100k per day of
 * citizenship, partial days rounded up. Single source of truth for both the
 * Postgres-age path and the Blob-age fallback in api/leaderboard.ts.
 */
export function maxPlausibleWorth(ageDays: number): number {
  return 200_000 + Math.ceil(ageDays + 1) * 100_000
}

/** One row per citizen — a new submission replaces the old score, like Blob's del+put. */
export const SCORE_UPSERT_SQL = `
  INSERT INTO scores (citizen_id, name, net_worth, capped_worth, reported_at)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (citizen_id) DO UPDATE
    SET name = EXCLUDED.name,
        net_worth = EXCLUDED.net_worth,
        capped_worth = EXCLUDED.capped_worth,
        reported_at = EXCLUDED.reported_at
`.trim()

const LEDGER_CAPPED_INSERT_SQL = `
  INSERT INTO ledger (citizen_id, intent, amount, meta)
  VALUES ($1, 'score.capped', 0, $2::jsonb)
`.trim()

const CITIZEN_AGE_SQL = 'SELECT created_at FROM citizens WHERE citizen_id = $1'

/**
 * Citizen age in (fractional) days from Postgres — the server-side source
 * for the plausibility cap. Returns null when the flag is off, the citizen
 * is not mirrored yet, or Postgres errors: the caller falls back to the
 * Blob record, and past that to the fail-closed day-0 cap. Never throws.
 */
export async function citizenAgeDaysPg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<number | null> {
  if (!isPostgresEnabled(env)) return null
  try {
    const sql = db(env) as unknown as SqlClient
    const rows = (await sql.query(CITIZEN_AGE_SQL, [citizenId])) as Array<{ created_at: string | Date }>
    if (!rows[0]?.created_at) return null
    const createdAt = new Date(rows[0].created_at).getTime()
    if (!Number.isFinite(createdAt)) return null
    return Math.max(0, (Date.now() - createdAt) / 86_400_000)
  } catch (error) {
    console.error(`leaderboard: postgres age lookup failed for citizen ${citizenId} (falling back to blob)`, error)
    return null
  }
}

/**
 * Best-effort mirror of a score that already committed to Blob. When the
 * plausibility cap reduced the claim, the excess is logged to the ledger
 * with the reason (issue #900 deliverable). Never throws: a Postgres outage
 * must not fail a submission — the miss is logged and re-mirrored on the
 * citizen's next submission.
 */
export async function dualWriteScore(row: ScoreRow, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isPostgresEnabled(env)) return
  try {
    const sql = db(env) as unknown as SqlClient
    await sql.query(SCORE_UPSERT_SQL, [
      row.citizenId,
      row.name,
      row.netWorth,
      row.cappedWorth,
      row.reportedAt.toISOString(),
    ])
    if (row.cappedWorth < row.netWorth) {
      await sql.query(LEDGER_CAPPED_INSERT_SQL, [
        row.citizenId,
        JSON.stringify({ reason: 'implausible_net_worth', claimed: row.netWorth, capped: row.cappedWorth }),
      ])
    }
  } catch (error) {
    console.error(`leaderboard: postgres dual-write failed for citizen ${row.citizenId} (blob remains authoritative)`, error)
  }
}
