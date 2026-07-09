import { createHash } from 'node:crypto'
import { del, list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { citizenAgeDaysPg, dualWriteScore, maxPlausibleWorth } from './_scoresPg.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_NET_WORTH = 10_000_000_000
// Day-0 plausibility ceiling: founder grant ($200k) + one day's generous
// allowance ($100k). Used as the FAIL-CLOSED cap when a citizen's age can't
// be read — on uncertainty we clamp low, never accept the raw client number.
const FALLBACK_MAX_PLAUSIBLE = 300_000

async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}

/**
 * Net-worth leaderboard. One blob per citizen —
 * `scores/{citizenId}__{netWorth}__{name}.json` — pathname-encoded so the
 * GET pages through list() results with zero content reads. Blob list order
 * is not score order, so every score blob must be read before ranking —
 * 3 pages of 1,000 covers all 2,000 founder slots (same bound as register.ts).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const rows: { citizenId: string; name: string; netWorth: number }[] = []
      let cursor: string | undefined
      for (let page = 0; page < 3; page++) {
        const batch = await list({ prefix: 'scores/', cursor, limit: 1000 })
        for (const blob of batch.blobs) {
          const m = blob.pathname.match(/^scores\/([0-9a-f-]{36})__(\d+)__([a-z0-9-]{1,24})\.json$/)
          if (m) rows.push({ citizenId: m[1], name: m[3], netWorth: Number(m[2]) })
        }
        if (!batch.hasMore || !batch.cursor) break
        cursor = batch.cursor
      }
      rows.sort((a, b) => b.netWorth - a.netWorth)
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).json({ ok: true, top: rows.slice(0, 20), citizens: rows.length })
    } catch {
      res.status(503).json({
        ok: false,
        error: 'The leaderboard is briefly unavailable.',
        code: 'leaderboard_unavailable',
      })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { citizenId, token, name, netWorth } = (req.body ?? {}) as Record<string, unknown>
  const cleanName = String(name ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'citizen'
  const worth = Math.round(Number(netWorth))
  if (!Number.isFinite(worth) || worth < 0 || worth > MAX_NET_WORTH) {
    res.status(400).json({ ok: false, error: 'Invalid net worth.' })
    return
  }

  try {
    if (!(await verifyCitizen(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }

    // Plausibility cap until the server owns the simulation (Phase 1b):
    // founder grant + a generous $100k per day of citizenship. FAIL CLOSED —
    // start at the conservative day-0 ceiling and only RAISE it once we've
    // read a real citizen age. A transient read failure previously left
    // the raw client number (up to $10B) uncapped; now it clamps low instead.
    // Phase 1b.4 (issue #900): the age comes from Postgres first when the
    // flag is on; the Blob record is the fallback source.
    let cappedWorth = Math.min(worth, FALLBACK_MAX_PLAUSIBLE)
    const pgAgeDays = await citizenAgeDaysPg(String(citizenId))
    if (pgAgeDays !== null) {
      cappedWorth = Math.min(worth, maxPlausibleWorth(pgAgeDays))
    } else {
      try {
        const citizenBlob = await list({ prefix: `citizens/${citizenId}__`, limit: 1 })
        if (citizenBlob.blobs[0]) {
          const record = (await (await fetch(citizenBlob.blobs[0].downloadUrl)).json()) as { createdAt?: string }
          const ageDays = record.createdAt
            ? Math.max(0, (Date.now() - new Date(record.createdAt).getTime()) / 86_400_000)
            : 0
          cappedWorth = Math.min(worth, maxPlausibleWorth(ageDays))
        }
      } catch {
        /* keep the fail-closed day-0 cap set above */
      }
    }

    // Replace this citizen's previous score, then write the new one
    const old = await list({ prefix: `scores/${citizenId}__`, limit: 10 })
    if (old.blobs.length > 0) await del(old.blobs.map((b) => b.url))
    await put(`scores/${citizenId}__${cappedWorth}__${cleanName}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    // Phase 1b.4 (issue #900): mirror the score into Postgres and log any
    // capped (implausible) claim to the ledger. Blob stays authoritative —
    // dualWriteScore never throws and is a no-op with the flag off.
    await dualWriteScore({
      citizenId: String(citizenId),
      name: cleanName,
      netWorth: worth,
      cappedWorth,
      reportedAt: new Date(),
    })
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: 'The leaderboard is briefly unavailable.' })
  }
}
