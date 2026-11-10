import { db } from './_db.js'
import { maxBusinessEarnings, type ServerBusiness } from '../src/game/serverIncome.js'

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

// The profile read also reconciles against the authoritative economy. Three
// things about a citizen cannot be edited from a browser: the credits the
// ledger accepted (genesis, shifts, collected business income), the
// businesses the server charged for and when, and the citizen's age. Real
// worth is bounded by what those could have produced — spending only converts
// cash into assets valued at purchase price, it never mints new worth.
// `credited` is NULL when the citizen has no accepted ledger rows yet.
export const CITIZEN_PROFILE_SQL = `
  SELECT name, created_at, (founder_number IS NOT NULL) AS founder,
    (SELECT SUM(amount) FILTER (WHERE amount > 0)
       FROM ledger
      WHERE citizen_id = $1 AND balance_after IS NOT NULL) AS credited,
    (SELECT COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)
       FROM ledger
      WHERE citizen_id = $1 AND balance_after IS NOT NULL AND intent = 'intent.workShift') AS shift_credited,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('itemId', a.item_id, 'placedAt', a.placed_at))
       FROM assets a WHERE a.citizen_id = $1 AND a.kind = 'business'), '[]'::jsonb) AS businesses
  FROM citizens WHERE citizen_id = $1
`.trim()

// Founder registration grant — the largest worth a citizen can hold before
// their first ledger entry exists. The fail-closed bound when the ledger is
// silent about a citizen.
export const FOUNDER_GRANT = 200_000

// Registration grant of an ordinary (non-founder) citizen: what the ledger's genesis row holds.
export const CITIZEN_GRANT = 2_500

// The ledger records each shift at BASE wage × seniority. Gear (+46% max) and
// education (+30%) multiply it on the client (1.76× together); 1.9 covers
// both. It applies to SHIFT credits only — a registration grant is not labor
// and is never multiplied (a day-0 founder could otherwise post $380k).
export const LEDGER_WORTH_TOLERANCE = 1.9

// Everything else on the ledger (the grant, collected business income) gets
// a 10% allowance for client-only value such as income still in the till.
export const GRANT_WORTH_TOLERANCE = 1.1

// Faucets the ledger does not model yet (achievement and streak bounties,
// daily challenges, the windfall budget, gigs — docs/ECONOMY.md): a flat
// allowance that grows with the citizen's real age, 20× tighter than the
// plausibility cap's $100k/day.
export const CLIENT_FAUCET_BASE = 2_000
export const CLIENT_FAUCET_PER_DAY = 5_000

export type WorthEvidence = {
  /** Sum of accepted ledger credits; null when the ledger is silent. */
  ledgerCredits: number | null
  /** The part of those credits that came from reported shifts. */
  shiftCredits?: number
  /** Businesses the server charged for, and when. */
  businesses?: readonly ServerBusiness[]
  founder?: boolean | null
  ageDays?: number | null
}

/**
 * Server-reconciled ceiling on a claimed net worth, built only from evidence
 * the client cannot edit. FAIL CLOSED — a silent ledger never yields more
 * than the registration grant, an unknown age no daily allowance.
 */
export function maxReconciledWorth(evidence: WorthEvidence, now: number = Date.now()): number {
  const { ledgerCredits, founder = null, ageDays = null } = evidence
  // Only a citizen KNOWN not to be a founder gets the smaller grant; unknown stays at the founder ceiling.
  const credits = ledgerCredits === null || !Number.isFinite(ledgerCredits)
    ? (founder === false ? CITIZEN_GRANT : FOUNDER_GRANT)
    : Math.max(0, ledgerCredits)
  const rawShift = ledgerCredits === null ? 0 : Number(evidence.shiftCredits ?? 0)
  const shiftCredits = Number.isFinite(rawShift) ? Math.min(Math.max(0, rawShift), credits) : 0
  // Completed days only: the first day's faucets are what the flat base is for.
  const days = ageDays !== null && Number.isFinite(ageDays) ? Math.floor(Math.max(0, ageDays)) : 0
  return Math.round(
    (credits - shiftCredits) * GRANT_WORTH_TOLERANCE
    + shiftCredits * LEDGER_WORTH_TOLERANCE
    + maxBusinessEarnings(evidence.businesses ?? [], now)
    + CLIENT_FAUCET_BASE + CLIENT_FAUCET_PER_DAY * days,
  )
}

export type CitizenScoreProfile = {
  ageDays: number | null
  name: string | null
  ledgerCredits: number | null
  founder: boolean | null
  shiftCredits: number
  businesses: ServerBusiness[]
}

function serverBusinesses(raw: unknown): ServerBusiness[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const businesses: ServerBusiness[] = []
  for (const entry of list) {
    const itemId = (entry as { itemId?: unknown } | null)?.itemId
    const placedRaw = (entry as { placedAt?: unknown } | null)?.placedAt
    const placedAt = placedRaw instanceof Date ? placedRaw.getTime() : Date.parse(String(placedRaw))
    if (typeof itemId === 'string' && Number.isFinite(placedAt)) businesses.push({ itemId, placedAt })
  }
  return businesses
}

/** Read the authoritative display name, age, and reconciliation evidence in one database round trip. */
export async function citizenScoreProfilePg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<CitizenScoreProfile> {
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(CITIZEN_PROFILE_SQL, [citizenId])) as Array<{
    name?: string | null
    created_at?: string | Date | null
    credited?: string | number | null
    shift_credited?: string | number | null
    businesses?: unknown
    founder?: boolean | null
  }>
  const row = rows[0]
  if (!row) return { ageDays: null, name: null, ledgerCredits: null, founder: null, shiftCredits: 0, businesses: [] }
  const founder = typeof row.founder === 'boolean' ? row.founder : null
  const credited = row.credited === null || row.credited === undefined ? null : Number(row.credited)
  const ledgerCredits = credited !== null && Number.isFinite(credited) ? credited : null
  const shift = Number(row.shift_credited ?? 0)
  const evidence = { ledgerCredits, founder, shiftCredits: Number.isFinite(shift) ? shift : 0, businesses: serverBusinesses(row.businesses) }
  if (!row.created_at) return { ageDays: null, name: row.name ?? null, ...evidence }
  const createdAt = new Date(row.created_at).getTime()
  return {
    ageDays: Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : null,
    name: row.name ?? null,
    ...evidence,
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
