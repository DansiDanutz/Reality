import { db } from './_db.js'

/**
 * World placement storage (Phase 1b.3 dual-write, cut over to authoritative
 * in issue #902). Underscore prefix keeps Vercel from exposing this as an
 * endpoint — shared helper for api/ only.
 *
 * Since the cutover, the assets table IS the world: placements insert here
 * (plus a world.place ledger entry — the daily cap counts those), and the
 * shared map is read from it. Failures propagate to the handler; there is
 * no Blob fallback anymore.
 */

type SqlClient = { query: (statement: string, params?: unknown[]) => Promise<unknown> }

export type WorldAssetRow = {
  assetId: string
  citizenId: string
  itemId: string
  kind: 'home' | 'business'
  lat: number
  lng: number
  placedAt: string
}

/**
 * Asset ids are only unique per citizen (the old Blob scheme namespaced them
 * as world/{citizenId}/{assetId}), so the conflict target is the composite
 * key: re-placing your own asset moves it, another citizen using the same
 * asset id keeps their own distinct row.
 */
export const ASSET_UPSERT_SQL = `
  INSERT INTO assets (asset_id, citizen_id, item_id, kind, lat, lng, placed_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (citizen_id, asset_id) DO UPDATE
    SET item_id = EXCLUDED.item_id,
        kind = EXCLUDED.kind,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        placed_at = EXCLUDED.placed_at
`.trim()

export const LEDGER_PLACE_INSERT_SQL = `
  INSERT INTO ledger (citizen_id, intent, amount, meta)
  VALUES ($1, 'world.place', 0, $2::jsonb)
`.trim()

const PLACEMENT_COUNT_SQL = `
  SELECT count(*)::int AS count FROM ledger
  WHERE citizen_id = $1 AND intent = 'world.place' AND created_at >= $2
`.trim()

/** Shapes an assets-table row from the values world.ts already validated. */
export function assetRowFromPlacement(input: {
  citizenId: string
  assetId: string
  itemId: string
  kind: 'home' | 'business'
  lat: number
  lng: number
  placedAt: Date
}): WorldAssetRow {
  return {
    assetId: input.assetId,
    citizenId: input.citizenId,
    itemId: input.itemId,
    kind: input.kind,
    lat: input.lat,
    lng: input.lng,
    placedAt: input.placedAt.toISOString(),
  }
}

/** Authoritative write: assets upsert + world.place ledger entry. Throws on failure. */
export async function writeWorldPlacement(row: WorldAssetRow, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const sql = db(env) as unknown as SqlClient
  await sql.query(ASSET_UPSERT_SQL, [
    row.assetId,
    row.citizenId,
    row.itemId,
    row.kind,
    row.lat,
    row.lng,
    row.placedAt,
  ])
  await sql.query(LEDGER_PLACE_INSERT_SQL, [
    row.citizenId,
    JSON.stringify({ assetId: row.assetId, itemId: row.itemId, kind: row.kind, lat: row.lat, lng: row.lng }),
  ])
}

/** Today's placement actions, counted from the world.place ledger entries. Throws on failure. */
export async function placementsTodayPg(citizenId: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const startOfDayUtc = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
  const sql = db(env) as unknown as SqlClient
  const rows = (await sql.query(PLACEMENT_COUNT_SQL, [citizenId, startOfDayUtc])) as Array<{ count: number }>
  return rows[0]?.count ?? 0
}
