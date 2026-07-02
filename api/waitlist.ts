import { createHash } from 'node:crypto'
import { put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Founder waitlist signup. Each email is stored as one blob keyed by its
 * hash — idempotent, race-free, and never exposes the address in the key.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { email, website } = (req.body ?? {}) as { email?: string; website?: string }

  // Honeypot: real users never fill this hidden field
  if (website) {
    res.status(200).json({ ok: true })
    return
  }

  const clean = (email ?? '').trim().toLowerCase()
  if (!clean || clean.length > 254 || !EMAIL_RE.test(clean)) {
    res.status(400).json({ ok: false, error: 'That email address does not look right.' })
    return
  }

  try {
    const key = createHash('sha256').update(clean).digest('hex').slice(0, 32)
    await put(
      `waitlist/${key}.json`,
      JSON.stringify({ email: clean, joinedAt: new Date().toISOString() }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: 'The waitlist is briefly unavailable. Try again in a minute.' })
  }
}
