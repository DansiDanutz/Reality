import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/**
 * Per-citizen daily placement cap. A citizen can place at most this many assets
 * per real day. Bounds how much one citizen can bloat the shared `world/`
 * prefix (which every player's GET scans), without limiting legitimate play
 * (a citizen rarely places more than a few homes/businesses a day). Stateless:
 * the counter is the set of `worldrate/{cid}__{day}__{ts}.json` blobs — same
 * idiom as avatar.ts's per-citizen daily generation cap.
 */
const PLACEMENTS_PER_DAY = 20
async function verifyCitizen(citizenId: string, token: string): Promise<boolean> {
  if (!UUID_RE.test(citizenId) || typeof token !== 'string' || token.length > 64) return false
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)
  const batch = await list({ prefix: `citizens/${citizenId}__${tokenHash}`, limit: 1 })
  return batch.blobs.length > 0
}
 * The shared world map. Asset data is encoded in the blob pathname —
 * `world/{cid}/{assetId}__{itemId}__{kind}__{lat}__{lng}.json` — so one
 * list() call returns the whole planet with zero content reads.
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
    res.status(405).json({ ok: false, error: 'Method not allowed', code: 'method_not_allowed' })
  const { citizenId, token, assetId, itemId, kind, lat, lng } = (req.body ?? {}) as Record<string, unknown>
  const cleanCitizenId = String(citizenId)
  const cleanAssetId = String(assetId ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60)
  const cleanItemId = String(itemId ?? '').replace(/[^a-z_]/g, '').slice(0, 30)
  const cleanKind = kind === 'home' || kind === 'business' ? kind : null
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (
    !cleanAssetId ||
    !cleanItemId ||
    !cleanKind ||
    !Number.isFinite(nLat) || nLat < -90 || nLat > 90 ||
    !Number.isFinite(nLng) || nLng < -180 || nLng > 180
  ) {
    res.status(400).json({ ok: false, error: 'Invalid asset.', code: 'invalid_asset' })
  try {
    if (!(await verifyCitizen(cleanCitizenId, String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.', code: 'not_registered' })
      return
    // Per-citizen daily placement cap. Without this, one citizen can spam the
    // shared `world/` prefix with random asset ids, slowing every player's GET.
    // The list() of dated markers IS the counter — same idiom as avatar.ts.
    const day = new Date().toISOString().slice(0, 10)
    const used = await list({ prefix: `worldrate/${citizenId}__${day}`, limit: PLACEMENTS_PER_DAY + 1 })
    if (used.blobs.length >= PLACEMENTS_PER_DAY) {
      res.status(429).json({ ok: false, error: `You've placed ${PLACEMENTS_PER_DAY} things in the world today. Come back tomorrow.` })
    const storedLat = Number(nLat.toFixed(2))
    const storedLng = Number(nLng.toFixed(2))
    const pathname = `world/${cleanCitizenId}/${cleanAssetId}__${cleanItemId}__${cleanKind}__${storedLat.toFixed(2)}__${storedLng.toFixed(2)}.json`
    await put(
      pathname,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    // Record against the per-citizen daily cap. allowOverwrite:false is not
    // needed — the {ts} suffix makes each marker unique within the day.
    await put(`worldrate/${citizenId}__${day}__${Date.now()}.json`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
    res.status(200).json({ ok: true })
    res.status(200).json({
      ok: true,
      code: 'asset_placed',
      asset: {
        citizenId: cleanCitizenId,
        assetId: cleanAssetId,
        itemId: cleanItemId,
        kind: cleanKind,
        lat: storedLat,
        lng: storedLng,
        pathname,
      },
  } catch {
    res.status(500).json({ ok: false, error: 'The world is briefly unavailable.', code: 'world_unavailable' })
