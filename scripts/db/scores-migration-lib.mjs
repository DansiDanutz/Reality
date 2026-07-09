/**
 * Pure helpers for the one-shot scores migration (issue #900) — split from
 * scripts/db-migrate-scores.mjs so parsing and row-shaping are unit-testable
 * without Blob or Postgres.
 *
 * Blob pathname scheme being migrated (see api/leaderboard.ts): all score
 * data lives in the pathname, the blob body is just '1' —
 *   scores/<citizen-uuid>__<cappedWorth>__<name>.json
 */

const SCORE_PATHNAME =
  /^scores\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})__(\d+)__([a-z0-9-]{1,24})\.json$/

/**
 * Backfill uses DO NOTHING: if a row is already there, a live dual-write
 * put it there and is newer than the blob.
 */
export const SCORE_INSERT_SQL = `
  INSERT INTO scores (citizen_id, name, net_worth, capped_worth, reported_at)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (citizen_id) DO NOTHING
`.trim()

export function parseScorePathname(pathname) {
  const match = SCORE_PATHNAME.exec(pathname)
  if (!match) return null
  return {
    citizenId: match[1],
    cappedWorth: Number(match[2]),
    name: match[3],
  }
}

/**
 * The pathname worth is the already-capped value the leaderboard showed —
 * the raw claim was never persisted, so net_worth mirrors capped_worth.
 * reported_at comes from the blob's upload time.
 */
export function buildScoreRow(parsed, uploadedAt) {
  return {
    citizenId: parsed.citizenId,
    name: parsed.name,
    netWorth: parsed.cappedWorth,
    cappedWorth: parsed.cappedWorth,
    reportedAt: new Date(uploadedAt).toISOString(),
  }
}

export function scoreInsertParams(row) {
  return [row.citizenId, row.name, row.netWorth, row.cappedWorth, row.reportedAt]
}
