import type { VercelRequest, VercelResponse } from './_vercel.js'
import { db } from './_db.js'
import { renewCitizenTokenPg, verifyCitizenPg } from './_registry.js'
import { issueSessionCookies, sessionFromCookie } from './_session.js'

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * Cookie-session bootstrap. It returns identity metadata, never the bearer
 * token. It is also where the session slides: once the token is inside its
 * renewal window the expiry is extended and the cookies are re-issued with
 * a fresh Max-Age, so an active citizen never hits the 30-day cliff.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const session = sessionFromCookie(req)
  if (!session) {
    res.status(401).json({ ok: false, error: 'No active session.' })
    return
  }
  try {
    if (!(await verifyCitizenPg(session.citizenId, session.token))) {
      res.status(401).json({ ok: false, error: 'Session is no longer valid.' })
      return
    }
    const sql = db() as unknown as SqlClient
    const rows = (await sql.query(
      'SELECT citizen_id, name, founder_number, created_at FROM citizens WHERE citizen_id = $1',
      [session.citizenId],
    )) as Array<{ citizen_id: string; name: string; founder_number: number | null; created_at: string | Date }>
    const row = rows[0]
    if (!row) {
      res.status(401).json({ ok: false, error: 'Session is no longer valid.' })
      return
    }
    // Extend the row when it is inside its window, and re-issue the cookies on
    // EVERY successful bootstrap, not only when the row moved: a renewal
    // whose response was lost would otherwise leave the browser cookie on its
    // original date while the row sat outside the window. The token is never
    // rotated here, so re-issuing is always safe.
    await renewCitizenTokenPg(sql, session.citizenId)
    issueSessionCookies(res, session)
    res.status(200).json({
      ok: true,
      citizenId: row.citizen_id,
      name: row.name,
      founderNumber: row.founder_number ?? 0,
      createdAt: new Date(row.created_at).getTime(),
    })
  } catch (error) {
    console.error('session bootstrap failed', error)
    res.status(503).json({ ok: false, error: 'The session service is briefly unavailable.' })
  }
}

