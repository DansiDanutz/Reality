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

// The profile read also reconciles against the authoritative economy: the sum
// of accepted ledger credits (genesis + every income event) is an upper bound
// on real net worth, because spending only converts cash into assets valued
// at purchase price — it never mints new worth. NULL when the citizen has no
// accepted ledger rows yet (genesis lands on the first intent).
export const CITIZEN_PROFILE_SQL = `
  SELECT name, created_at,
    (SELECT SUM(amount) FILTER (WHERE amount > 0)
       FROM ledger
      WHERE citizen_id = $1 AND balance_after IS NOT NULL) AS credited
  FROM citizens WHERE citizen_id = $1
`.trim()

// Founder registration grant — the largest worth a citizen can hold before
// their first ledger entry exists. The fail-closed bound when the ledger is
// silent about a citizen.
export const FOUNDER_GRANT = 200_000

// Client-only assets (uncollected pending income) are not in the ledger yet;
// a 10% allowance covers them without reopening the client-asserted hole.
export const LEDGER_WORTH_TOLERANCE = 1.1

/**
 * Server-reconciled ceiling on a claimed net worth: total accepted ledger
 * credits (or the founder grant when the ledger has no rows yet), plus a
 * small tolerance for client-only pending income. FAIL CLOSED — an unknown
 * ledger never yields more headroom than the registration grant.
 */
export function maxReconciledWorth(ledgerCredits: number | null): number {
  const known = ledgerCredits === null || !Number.isFinite(ledgerCredits) ? FOUNDER_GRANT : Math.max(0, ledgerCredits)
  return Math.round(known * LEDGER_WORTH_TOLERANCE)
}

export type CitizenScoreProfile = { ageDays: number | null; name: string | null; ledgerCredits: number | null }

/** Read the authoritative display name, age, and ledger credits in one database round trip. */
export async function citizenScoreProfilePg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<CitizenScoreProfile> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(CITIZEN_PROFILE_SQL, [citizenId])) as Array<{
    name?: string | null
    created_at?: string | Date | null
    credited?: string | number | null
  }>
  const row = rows[0]
  if (!row) return { ageDays: null, name: null, ledgerCredits: null }
  const credited = row.credited === null || row.credited === undefined ? null : Number(row.credited)
  const ledgerCredits = credited !== null && Number.isFinite(credited) ? credited : null
  if (!row.created_at) return { ageDays: null, name: row.name ?? null, ledgerCredits }
  const createdAt = new Date(row.created_at).getTime()
  return {
    ageDays: Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : null,
    name: row.name ?? null,
    ledgerCredits,
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
