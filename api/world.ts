import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}

/**
 * The shared world map. Asset data is encoded in the blob pathname —
 * `world/{cid}/{assetId}__{itemId}__{kind}__{lat}__{lng}.json` — so one
 * list() call returns the whole planet with zero content reads.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const assets: { cid: string; itemId: string; kind: string; lat: number; lng: number }[] = []
      let cursor: string | undefined
      for (let page = 0; page < 3; page++) {
        const batch = await list({ prefix: 'world/', cursor, limit: 1000 })
        for (const blob of batch.blobs) {
          const m = blob.pathname.match(/^world\/([0-9a-f]{8})[0-9a-f-]*\/[\w-]+__([a-z_]+)__(home|business)__(-?\d+\.?\d*)__(-?\d+\.?\d*)\.json$/)
          if (m) assets.push({ cid: m[1], itemId: m[2], kind: m[3], lat: Number(m[4]), lng: Number(m[5]) })
        }
        if (!batch.hasMore || !batch.cursor) break
        cursor = batch.cursor
      }
      const founders = await list({ prefix: 'founders/', limit: 1000 })
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
      res.status(200).json({ ok: true, assets, stats: { assets: assets.length, founders: founders.blobs.length } })
    } catch {
      res.status(200).json({ ok: true, assets: [], stats: { assets: 0, founders: 0 } })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const { citizenId, token, assetId, itemId, kind, lat, lng } = (req.body ?? {}) as Record<string, unknown>
  const cleanAssetId = String(assetId ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)
  const cleanItemId = String(itemId ?? '').replace(/[^a-z_]/g, '').slice(0, 30)
  const nLat = Number(lat)
  const nLng = Number(lng)

  if (
    !cleanAssetId ||
    !cleanItemId ||
    (kind !== 'home' && kind !== 'business') ||
    !Number.isFinite(nLat) || nLat < -90 || nLat > 90 ||
    !Number.isFinite(nLng) || nLng < -180 || nLng > 180
  ) {
    res.status(400).json({ ok: false, error: 'Invalid asset.' })
    return
  }

  try {
    if (!(await verifyCitizen(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }
    await put(
      `world/${citizenId}/${cleanAssetId}__${cleanItemId}__${kind}__${nLat.toFixed(2)}__${nLng.toFixed(2)}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    res.status(200).json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: 'The world is briefly unavailable.' })
  }
}
