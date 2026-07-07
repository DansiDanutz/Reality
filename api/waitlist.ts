import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Founder waitlist. POST {email} signs up — each address is stored as one
 * blob keyed by its hash (idempotent, race-free, address never in the key).
 * GET returns the signup count for social proof.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      let count = 0
      let cursor: string | undefined
      // Paginate defensively; 10 pages = 10k signups is plenty for the beta
      for (let page = 0; page < 10; page++) {
        const batch = await list({ prefix: 'waitlist/', cursor, limit: 1000 })
        count += batch.blobs.length
        if (!batch.hasMore || !batch.cursor) break
        cursor = batch.cursor
      }
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).json({ ok: true, count })
    } catch {
      res.setHeader('Cache-Control', 'no-store')
      res.status(503).json({
        ok: false,
        code: 'waitlist_count_unavailable',
        error: 'The waitlist count is briefly unavailable. Try again in a minute.',
      })
    }
    return
  }

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
    res.status(503).json({
      ok: false,
      code: 'waitlist_write_unavailable',
      error: 'The waitlist is briefly unavailable. Try again in a minute.',
    })
  }
}
