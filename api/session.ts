import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { verifyCitizenPg } from './_registry.js'
import { sessionFromCookie } from './_session.js'

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/** Cookie-session bootstrap. It returns identity metadata, never the bearer token. */
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
    const rows = (await (db() as unknown as SqlClient).query(
      'SELECT citizen_id, name, founder_number, created_at FROM citizens WHERE citizen_id = $1',
      [session.citizenId],
    )) as Array<{ citizen_id: string; name: string; founder_number: number | null; created_at: string | Date }>
    const row = rows[0]
    if (!row) {
      res.status(401).json({ ok: false, error: 'Session is no longer valid.' })
      return
    }
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

