import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const FOUNDER_SEAT_LIMIT = 2_000

const FOUNDER_WAITLIST_POLICY = {
  founderSeatLimit: FOUNDER_SEAT_LIMIT,
  founderSeatsFreeForFirstCohort: true,
  replacementWorkflowEnabled: false,
  waitlistHandoffEnabled: false,
  seatTransferEnabled: false,
  areaTransferEnabled: false,
  landTransferEnabled: false,
  payoutEligibility: 'none',
  profitPromise: false,
  cryptoPaymentRequired: false,
  tonSettlementEnabled: false,
  manualReviewRequired: true,
} as const

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
      res.status(200).json({ ok: true, count, policy: FOUNDER_WAITLIST_POLICY })
    } catch {
      res.status(200).json({ ok: true, count: 0, policy: FOUNDER_WAITLIST_POLICY })
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
      JSON.stringify(founderWaitlistRecord(clean, new Date())),
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    res.status(200).json({ ok: true, policy: FOUNDER_WAITLIST_POLICY })
  } catch {
    res.status(500).json({ ok: false, error: 'The waitlist is briefly unavailable. Try again in a minute.' })
  }
}

function founderWaitlistRecord(email: string, joinedAt: Date) {
  return {
    kind: 'founder_waitlist_signup',
    email,
    joinedAt: joinedAt.toISOString(),
    status: 'waiting',
    requestedFounderSeat: true,
    policy: FOUNDER_WAITLIST_POLICY,
    handoff: {
      replacementCandidate: false,
      replacementWorkflowEnabled: false,
      waitlistHandoffEnabled: false,
      seatTransferEnabled: false,
      areaTransferEnabled: false,
      landTransferEnabled: false,
      manualReviewRequired: true,
    },
    monetization: {
      payoutEligibility: 'none',
      profitPromise: false,
      cryptoPaymentRequired: false,
      tonSettlementEnabled: false,
    },
  }
}
