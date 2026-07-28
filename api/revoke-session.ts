import type { VercelRequest, VercelResponse } from './_vercel.js'
import { db } from './_db.js'
import { revokeCitizenTokenPg, verifyCitizenPg } from './_registry.js'
import { clearSessionCookies, csrfMatches, sessionFromCookie } from './_session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  if (typeof citizenId !== 'string' || typeof token !== 'string') {
    res.status(400).json({ ok: false, error: 'citizenId and token are required.' })
    return
  }
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
