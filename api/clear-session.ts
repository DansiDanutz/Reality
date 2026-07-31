import type { VercelRequest, VercelResponse } from './_vercel.js'
import { clearSessionCookies, csrfMatches } from './_session.js'

/**
 * Clear only this browser's session transport.
 *
 * This intentionally does not revoke the citizen credential: account-switch
 * cleanup must not sign an unrelated citizen out on every device.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  if (!csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  clearSessionCookies(res)
  res.status(200).json({ ok: true })
}
