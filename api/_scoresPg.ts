import { db } from './_db.js'

/**
 * Leaderboard score storage + anti-cheat (Phase 1b.4 dual-write, cut over to
 * authoritative in issue #902). Underscore prefix keeps Vercel from exposing
 * this as an endpoint — shared helper for api/ only.
 *
 * Since the cutover, the scores table IS the leaderboard. When the
 * plausibility cap bites, the rejected excess is recorded in the append-only
 * ledger in the SAME atomic statement as the score itself.
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
 * citizenship, partial days rounded up. Single source of truth for the cap.
 */
export function maxPlausibleWorth(ageDays: number): number {
  return 200_000 + Math.ceil(ageDays + 1) * 100_000
}

/**
 * One row per citizen — a new submission replaces the old score. The
 * capped-claim audit rides in the SAME statement (CTE): the Neon HTTP
 * driver autocommits per call, so fused they land atomically or not at all.
 * The WHERE gate skips the audit row whenever the claim was plausible.
 */
export const SCORE_UPSERT_SQL = `
  WITH upserted AS (
    INSERT INTO scores (citizen_id, name, net_worth, capped_worth, reported_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (citizen_id) DO UPDATE
      SET name = EXCLUDED.name,
          net_worth = EXCLUDED.net_worth,
          capped_worth = EXCLUDED.capped_worth,
          reported_at = EXCLUDED.reported_at
    RETURNING citizen_id
  )
  INSERT INTO ledger (citizen_id, intent, amount, meta)
  SELECT citizen_id, 'score.capped', 0, $6::jsonb FROM upserted
  WHERE $3::numeric > $4::numeric
`.trim()

const CITIZEN_PROFILE_SQL = 'SELECT name, created_at FROM citizens WHERE citizen_id = $1'

export type CitizenScoreProfile = { ageDays: number | null; name: string | null }

/** Read the authoritative display name and age in one database round trip. */
export async function citizenScoreProfilePg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<CitizenScoreProfile> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(CITIZEN_PROFILE_SQL, [citizenId])) as Array<{ name?: string | null; created_at?: string | Date | null }>
  const row = rows[0]
  if (!row) return { ageDays: null, name: null }
  if (!row.created_at) return { ageDays: null, name: row.name ?? null }
  const createdAt = new Date(row.created_at).getTime()
  return {
    ageDays: Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : null,
    name: row.name ?? null,
  }
}

/**
 * Citizen age in (fractional) days from the citizens table — the source for
 * the plausibility cap. Returns null for an unknown citizen or unreadable
 * timestamp (the caller falls back to the fail-closed day-0 cap). Database
 * errors propagate — there is no Blob fallback anymore.
 */
export async function citizenAgeDaysPg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<number | null> {
  return (await citizenScoreProfilePg(citizenId, env)).ageDays
}

/** Authoritative write: score upsert + capped-claim audit, one atomic statement. Throws on failure. */
export async function writeScore(row: ScoreRow, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const sql = db(env) as unknown as SqlClient
  await sql.query(SCORE_UPSERT_SQL, [
    row.citizenId,
    row.name,
    row.netWorth,
    row.cappedWorth,
    row.reportedAt.toISOString(),
    JSON.stringify({ reason: 'implausible_net_worth', claimed: row.netWorth, capped: row.cappedWorth }),
  ])
}
