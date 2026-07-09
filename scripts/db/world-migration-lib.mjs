/**
 * Pure helpers for the one-shot world migration (issue #898) — split from
 * scripts/db-migrate-world.mjs so parsing and row-shaping are unit-testable
 * without Blob or Postgres.
 *
 * Blob pathname scheme being migrated (see api/world.ts): all asset metadata
 * lives in the pathname, the blob body is just '1' —
 *   world/<citizen-uuid>/<assetId>__<itemId>__<kind>__<lat>__<lng>.json
 */

const WORLD_PATHNAME =
  /^world\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([a-zA-Z0-9-]+)__([a-z_]+)__(home|business)__(-?\d+\.?\d*)__(-?\d+\.?\d*)\.json$/

/**
 * Backfill uses DO NOTHING (not the live path's DO UPDATE): if a row is
 * already there, a live dual-write put it there and is newer than the blob.
 */
export const ASSET_INSERT_SQL = `
  INSERT INTO assets (asset_id, citizen_id, item_id, kind, lat, lng, placed_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (citizen_id, asset_id) DO NOTHING
`.trim()

export function parseWorldPathname(pathname) {
  const match = WORLD_PATHNAME.exec(pathname)
  if (!match) return null
  return {
    citizenId: match[1],
    assetId: match[2],
    itemId: match[3],
    kind: match[4],
    lat: Number(match[5]),
    lng: Number(match[6]),
  }
}

/** placed_at comes from the blob's upload time — the only timestamp Blob kept. */
export function buildAssetRow(parsed, uploadedAt) {
  return {
    ...parsed,
    placedAt: new Date(uploadedAt).toISOString(),
  }
}

export function assetInsertParams(row) {
  return [row.assetId, row.citizenId, row.itemId, row.kind, row.lat, row.lng, row.placedAt]
}
