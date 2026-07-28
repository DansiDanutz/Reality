import type { VercelRequest, VercelResponse } from './_vercel.js'
import { db } from './_db.js'
import { verifyCitizenPg } from './_registry.js'
import { citizenScoreProfilePg, maxPlausibleWorth, maxReconciledWorth, writeScore } from './_scoresPg.js'
import { csrfMatches, sessionFromCookie } from './_session.js'

const MAX_NET_WORTH = 10_000_000_000
// Day-0 plausibility ceiling — the FAIL-CLOSED cap when a citizen's age is
// unknown: on uncertainty we clamp low, never accept the raw client number.
// Derived from the shared formula so the floor can never drift.
const FALLBACK_MAX_PLAUSIBLE = maxPlausibleWorth(0)
const TOP_SIZE = 20

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * Net-worth leaderboard — served from the Postgres scores table since the
 * Phase 1b.6 cutover (issue #902). One row per citizen, server-validated,
 * ranked by the plausibility-capped worth.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (Object.keys(req.query ?? {}).length > 0) {
      res.status(400).json({ ok: false, error: 'Query parameters are not allowed.' })
      return
    }
    try {
      const sql = db() as unknown as SqlClient
      const rows = (await sql.query(
        `SELECT citizen_id, name, capped_worth FROM scores ORDER BY capped_worth DESC LIMIT ${TOP_SIZE}`,
      )) as Array<{ citizen_id: string; name: string; capped_worth: string | number }>
      const total = (await sql.query('SELECT count(*)::int AS count FROM scores')) as Array<{ count: number }>
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).json({
        ok: true,
        top: rows.map((row) => ({
          citizenId: row.citizen_id,
          name: row.name,
          netWorth: Number(row.capped_worth),
        })),
        citizens: total[0]?.count ?? 0,
      })
    } catch (error) {
      console.error('leaderboard: read failed', error)
      res.status(503).json({
        ok: false,
        error: 'The leaderboard is briefly unavailable.',
        code: 'leaderboard_unavailable',
      })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const cookieSession = sessionFromCookie(req)
  const bodyToken = typeof body.token === 'string' && body.token.length > 0 ? body.token : null
  if (!bodyToken && cookieSession && !csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const citizenId = body.citizenId ?? cookieSession?.citizenId
  const token = bodyToken ?? cookieSession?.token
  const { netWorth } = body
  const worth = Math.round(Number(netWorth))
  if (!Number.isFinite(worth) || worth < 0 || worth > MAX_NET_WORTH) {
    res.status(400).json({ ok: false, error: 'Invalid net worth.' })
    return
  }

  try {
    if (!(await verifyCitizenPg(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    // Two independent server-side ceilings, both FAIL CLOSED:
    // 1. Age plausibility: founder grant + a generous $100k per day of
    //    citizenship, from the citizen's authoritative created_at. Unknown
    //    age means the day-0 ceiling, never the raw client number.
    // 2. Ledger reconciliation: real worth can never exceed the citizen's
    //    accepted ledger credits (plus a small pending-income tolerance) —
    //    spending converts cash into assets, it never mints new worth.
    const profile = await citizenScoreProfilePg(String(citizenId))
    const cleanName = String(profile.name ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'citizen'
    const ageDays = profile.ageDays
    const ageCap = ageDays !== null ? maxPlausibleWorth(ageDays) : FALLBACK_MAX_PLAUSIBLE
    const ledgerCap = maxReconciledWorth(profile.ledgerCredits)
    const cappedWorth = Math.min(worth, ageCap, ledgerCap)

    // One atomic statement: replace the score, audit the cap if it bit.
    await writeScore({
      citizenId: String(citizenId),
      name: cleanName,
      netWorth: worth,
      cappedWorth,
      reportedAt: new Date(),
    })
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('leaderboard: submission failed', {
      citizenId: String(citizenId),
      errorType: error instanceof Error ? error.name : typeof error,
    })
    res.status(500).json({ ok: false, error: 'The leaderboard is briefly unavailable.' })
  }
}
