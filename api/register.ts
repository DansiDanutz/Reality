import { createHash, randomUUID } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const FOUNDER_SLOTS = 2_000

async function claimedSlots(): Promise<number> {
  let count = 0
  let cursor: string | undefined
  for (let page = 0; page < 3; page++) {
    const batch = await list({ prefix: 'founders/', cursor, limit: 1000 })
    count += batch.blobs.length
    if (!batch.hasMore || !batch.cursor) break
    cursor = batch.cursor
  }
  return count
}

/**
 * Citizen registration + the real founder registry.
 * A slot blob can only be created once (allowOverwrite: false), so two
 * citizens can never hold the same founder number. First come, first served,
 * exactly 2,000.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { name } = (req.body ?? {}) as { name?: string }
  const clean = String(name ?? '').trim()
  if (clean.length < 2 || clean.length > 24) {
    res.status(400).json({ ok: false, error: 'Name must be 2–24 characters.' })
    return
  }

  try {
    // Bot brake: a handful of citizens per IP per day is plenty for humans
    const ip = String(req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown').split(',')[0].trim()
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)
    const day = new Date().toISOString().slice(0, 10)
    const recent = await list({ prefix: `regip/${ipHash}__${day}`, limit: 6 })
    if (recent.blobs.length >= 5) {
      res.status(429).json({ ok: false, error: 'Too many new citizens from this connection today. Try again tomorrow.' })
      return
    }
    await put(`regip/${ipHash}__${day}__${Date.now()}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    // Every citizen name in Reality is unique — a name is an identity claim
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    try {
      await put(`names/${slug}.json`, JSON.stringify({ at: new Date().toISOString() }), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
      })
    } catch {
      res.status(409).json({ ok: false, code: 'name_taken', error: 'That name already belongs to a citizen.' })
      return
    }

    const citizenId = randomUUID()
    const token = randomUUID()
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)

    // The allowOverwrite:false put is the real race guard — two citizens can
    // never win the same slot. But claimedSlots() is a list() scan and list()
    // is eventually consistent, so under a concurrent burst many requests can
    // compute the same stale starting `n`. A short probe budget then runs out
    // before finding a free slot, and a citizen who was ENTITLED to a founder
    // slot falls through with null. Probe further, and periodically re-scan to
    // jump past the contended region an undercount hid.
    let founderNumber: number | null = null
    let n = (await claimedSlots()) + 1
    for (let attempt = 0; attempt < 24 && n <= FOUNDER_SLOTS; attempt++) {
      try {
        await put(`founders/${String(n).padStart(4, '0')}.json`, JSON.stringify({ citizenId, at: new Date().toISOString() }), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/json',
        })
        founderNumber = n
        break
      } catch {
        n += 1 // someone claimed it a heartbeat before us — take the next slot
        // Every few collisions, re-scan: a fresh list() has likely caught up
        // and reveals the true high-water mark, so we stop re-colliding.
        if (attempt > 0 && attempt % 6 === 0) {
          const rescanned = (await claimedSlots()) + 1
          if (rescanned > n) n = rescanned
        }
      }
    }

    // Citizen record: identity + auth live in the pathname so later requests
    // can verify a token with a single prefix lookup.
    await put(
      `citizens/${citizenId}__${tokenHash}__${founderNumber ?? 0}.json`,
      JSON.stringify({ name: clean, createdAt: new Date().toISOString() }),
      { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' },
    )

    res.status(200).json({
      ok: true,
      citizenId,
      token,
      founderNumber,
      slotsClaimed: founderNumber ?? FOUNDER_SLOTS,
      slotsTotal: FOUNDER_SLOTS,
    })
  } catch {
    res.status(500).json({ ok: false, error: 'Registration is briefly unavailable. Try again in a minute.' })
  }
}
