import { db, isPostgresEnabled } from './_db.js'

/**
 * Phase 1b.3 world dual-write (issue #898). Underscore prefix keeps Vercel
 * from exposing this as an endpoint — shared helper for api/ only.
 *
 * Blob stays authoritative in this phase: a placement writes to Blob first,
 * then mirrors into Postgres when POSTGRES_ENABLED is on. Reads do not
 * change. Every placement ACTION also appends a `world.place` ledger entry —
 * the daily cap counts those, and Phase 1b.5's intent/ledger core builds on
 * the same rows.
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
 * Blob semantics twin: allowOverwrite:true within a citizen's own prefix
 * (re-placing an asset moves it). Asset ids are only unique per citizen —
 * Blob namespaces them as world/{citizenId}/{assetId} — so the conflict
 * target is the composite key: another citizen using the same asset id
 * keeps their own distinct row, exactly like Blob.
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

/**
 * Best-effort mirror of a placement that already committed to Blob. Never
 * throws: a Postgres outage must not fail a placement — the miss is logged
 * and scripts/db-migrate-world.mjs backfills it.
 */
export async function dualWriteWorldPlacement(row: WorldAssetRow, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isPostgresEnabled(env)) return
  try {
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
  } catch (error) {
    console.error(`world: postgres dual-write failed for asset ${row.assetId} (blob remains authoritative)`, error)
  }
}

/**
 * Postgres-side daily placement cap (issue #898 deliverable): counts today's
 * world.place ledger entries. Fails open — with Blob still authoritative, a
 * Postgres outage must throttle nothing; the Blob marker check that always
 * runs first remains the enforcement floor.
 */
export async function placementCapReachedPg(
  citizenId: string,
  limit: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!isPostgresEnabled(env)) return false
  try {
    const startOfDayUtc = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
    const sql = db(env) as unknown as SqlClient
    const rows = (await sql.query(PLACEMENT_COUNT_SQL, [citizenId, startOfDayUtc])) as Array<{ count: number }>
    return (rows[0]?.count ?? 0) >= limit
  } catch (error) {
    console.error(`world: postgres cap check failed for citizen ${citizenId} (falling back to blob cap)`, error)
    return false
  }
}
