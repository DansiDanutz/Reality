import type { VercelRequest, VercelResponse } from './_vercel.js'
import { itemById } from '../src/game/catalog.js'
import { db } from './_db.js'
import { verifyCitizenPg } from './_registry.js'
import { assetRowFromPlacement, placementsTodayPg, writeWorldPlacement } from './_worldPg.js'
import { csrfMatches, sessionFromCookie } from './_session.js'

const WORLD_PLACEMENT_FIELDS = new Set(['assetId', 'itemId', 'kind', 'lat', 'lng'])

/**
 * Per-citizen daily placement cap. A citizen can place at most this many
 * assets per real day, counted from their world.place ledger entries.
 * Bounds how much one citizen can bloat the shared world without limiting
 * legitimate play (a citizen rarely places more than a few homes/businesses
 * a day).
 */
const PLACEMENTS_PER_DAY = 20

/** The old 3-page Blob list bound, kept as the world read ceiling. */
const WORLD_READ_LIMIT = 3_000

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

/**
 * The shared world map — served from the Postgres assets table since the
 * Phase 1b.6 cutover (issue #902). Placement metadata lives in structured
 * columns; the GET is two indexed queries instead of a Blob prefix scan.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (Object.keys(req.query ?? {}).length > 0) {
      res.status(400).json({ ok: false, error: 'Query parameters are not allowed.' })
      return
    }
    try {
      const sql = db() as unknown as SqlClient
      // Join the owner's display name (public — it's on the leaderboard) so the
      // map can say WHO owns each building (P6). LEFT JOIN keeps assets whose
      // citizen row is somehow missing; the client falls back to "a founder".
      const rows = (await sql.query(
        `SELECT a.citizen_id, a.item_id, a.kind, a.lat, a.lng, c.name
         FROM assets a LEFT JOIN citizens c ON c.citizen_id = a.citizen_id
         ORDER BY a.placed_at DESC LIMIT ${WORLD_READ_LIMIT}`,
      )) as Array<{ citizen_id: string; item_id: string; kind: string; lat: number; lng: number; name: string | null }>
      const founders = (await sql.query(
        'SELECT count(*)::int AS count FROM citizens WHERE founder_number IS NOT NULL',
      )) as Array<{ count: number }>
      const assets = rows.map((row) => ({
        cid: row.citizen_id.slice(0, 8),
        itemId: row.item_id,
        kind: row.kind,
        lat: Number(row.lat),
        lng: Number(row.lng),
        name: row.name ?? null,
      }))
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
      res.status(200).json({ ok: true, assets, stats: { assets: assets.length, founders: founders[0]?.count ?? 0 } })
    } catch (error) {
      // The map degrades to empty rather than erroring — the client renders
      // an empty world and retries on the next poll.
      console.error('world: read failed', error)
      res.status(200).json({ ok: true, assets: [], stats: { assets: 0, founders: 0 } })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const body = req.body ?? {}
  if (!isRecord(body)) {
    res.status(400).json({ ok: false, error: 'Invalid asset.' })
    return
  }
  if (hasUnexpectedWorldPlacementField(body)) {
    res.status(422).json({
      ok: false,
      error: 'Client-controlled world fields are not allowed.',
      code: 'client_controlled_server_field',
    })
    return
  }

  const cookieSession = sessionFromCookie(req)
  if (!cookieSession) {
    res.status(401).json({ ok: false, error: 'An active Reality session is required.', code: 'session_required' })
    return
  }
  if (!csrfMatches(req)) {
    res.status(403).json({ ok: false, error: 'A valid Reality CSRF token is required.', code: 'csrf_required' })
    return
  }
  const { citizenId, token } = cookieSession
  const { assetId, itemId, kind, lat, lng } = body
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

  const catalogItem = itemById(cleanItemId)
  if (!catalogItem?.placeable || catalogItem.category !== kind) {
    res.status(422).json({
      ok: false,
      error: 'This item is not a server-authorized placeable asset.',
      code: 'item_not_placeable',
    })
    return
  }

  try {
    if (!(await verifyCitizenPg(String(citizenId), String(token)))) {
      res.status(401).json({ ok: false, error: 'Not a registered citizen.' })
      return
    }
    // Per-citizen daily placement cap, counted from the ledger. Without
    // this, one citizen could spam the shared world with random asset ids.
    if ((await placementsTodayPg(String(citizenId))) >= PLACEMENTS_PER_DAY) {
      res.status(429).json({ ok: false, error: `You've placed ${PLACEMENTS_PER_DAY} things in the world today. Come back tomorrow.` })
      return
    }
    // Structured columns mirror the old pathname exactly (toFixed(2) coords).
    await writeWorldPlacement(assetRowFromPlacement({
      citizenId: String(citizenId),
      assetId: cleanAssetId,
      itemId: cleanItemId,
      kind,
      lat: Number(nLat.toFixed(2)),
      lng: Number(nLng.toFixed(2)),
      placedAt: new Date(),
      price: catalogItem.price,
      dailyLimit: PLACEMENTS_PER_DAY,
    }))
    res.status(200).json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'world_place_insufficient_funds') {
      res.status(422).json({ ok: false, error: 'Not enough server-authoritative funds for that asset.', code: 'insufficient_funds' })
      return
    }
    if (error instanceof Error && error.message === 'world_place_daily_limit') {
      res.status(429).json({ ok: false, error: `You've placed ${PLACEMENTS_PER_DAY} things in the world today. Come back tomorrow.` })
      return
    }
    if (error instanceof Error && error.message === 'world_place_asset_mismatch') {
      res.status(409).json({ ok: false, error: 'That asset id already belongs to a different catalog item.', code: 'asset_identity_conflict' })
      return
    }
    if (error instanceof Error && error.message === 'world_place_inventory_missing') {
      res.status(422).json({ ok: false, error: 'Buy this placeable asset before placing it.', code: 'inventory_required' })
      return
    }
    console.error('world: placement failed', {
      citizenId: String(citizenId),
      errorType: error instanceof Error ? error.name : typeof error,
    })
    res.status(500).json({ ok: false, error: 'The world is briefly unavailable.' })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasUnexpectedWorldPlacementField(body: Record<string, unknown>): boolean {
  return Object.keys(body).some((key) => !WORLD_PLACEMENT_FIELDS.has(key))
}
