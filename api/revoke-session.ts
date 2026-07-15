import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_db.js'
import { revokeCitizenTokenPg, verifyCitizenPg } from './_registry.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const { citizenId, token } = (req.body ?? {}) as Record<string, unknown>
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
    res.status(200).json({ ok: true, revoked })
  } catch {
    res.status(503).json({ ok: false, error: 'Session revocation is briefly unavailable.', code: 'session_revoke_unavailable' })
  }
}
