import type { VercelRequest, VercelResponse } from './_vercel.js'
import { db } from './_db.js'
import { revokeCitizenTokenPg, verifyCitizenPg } from './_registry.js'
import { clearSessionCookies, csrfMatches, sessionFromCookie } from './_session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const cookieSession = sessionFromCookie(req)
  if (!cookieSession) {
    res.status(401).json({ ok: false, error: 'An active Reality session is required.', code: 'session_required' })
    return
  }
  if (!csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const { citizenId, token } = cookieSession
  try {
    if (!(await verifyCitizenPg(citizenId, token))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }
    const revoked = await revokeCitizenTokenPg(db() as never, citizenId)
    clearSessionCookies(res)
    res.status(200).json({ ok: true, revoked })
  } catch {
    res.status(503).json({ ok: false, error: 'Session revocation is briefly unavailable.', code: 'session_revoke_unavailable' })
  }
}
