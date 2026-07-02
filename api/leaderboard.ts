import { createHash } from 'node:crypto'
import { del, list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_NET_WORTH = 10_000_000_000

async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}

/**
 * Net-worth leaderboard. One blob per citizen —
 * `scores/{citizenId}__{netWorth}__{name}.json` — pathname-encoded so the
 * GET is a single list() with zero content reads.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const rows: { name: string; netWorth: number }[] = []
      const batch = await list({ prefix: 'scores/', limit: 1000 })
      for (const blob of batch.blobs) {
        const m = blob.pathname.match(/^scores\/[0-9a-f-]{36}__(\d+)__([a-z0-9-]{1,24})\.json$/)
        if (m) rows.push({ name: m[2], netWorth: Number(m[1]) })
      }
      rows.sort((a, b) => b.netWorth - a.netWorth)
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).json({ ok: true, top: rows.slice(0, 20), citizens: rows.length })
    } catch {
      res.status(200).json({ ok: true, top: [], citizens: 0 })
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
    // Replace this citizen's previous score, then write the new one
    const old = await list({ prefix: `scores/${citizenId}__`, limit: 10 })
    if (old.blobs.length > 0) await del(old.blobs.map((b) => b.url))
    await put(`scores/${citizenId}__${worth}__${cleanName}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: 'The leaderboard is briefly unavailable.' })
  }
}
