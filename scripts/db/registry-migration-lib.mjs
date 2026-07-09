/**
 * Pure helpers for the one-shot registry migration (issue #897) — split from
 * scripts/db-migrate-registry.mjs so the parsing and row-shaping logic is
 * unit-testable without Blob or Postgres.
 *
 * Blob pathname schemes being migrated (see api/register.ts):
 *   citizens/<uuid>__<tokenHash>__<founderNumber>.json  (0 = no founder slot)
 *   founders/<NNNN>.json                                (the real registry)
 */

const CITIZEN_PATHNAME = /^citizens\/([0-9a-f-]{36})__([0-9a-f]+)__(\d+)\.json$/
const FOUNDER_PATHNAME = /^founders\/(\d+)\.json$/

/**
 * Mirrors api/_registry.ts CITIZEN_INSERT_SQL. ON CONFLICT DO NOTHING makes
 * re-runs (and overlap with live dual-writes) safe: first write wins, exactly
 * like Blob's allowOverwrite:false.
 */
export const CITIZEN_INSERT_SQL = `
  INSERT INTO citizens (citizen_id, name, token_hash, founder_number, telegram_user_id, created_at, raw)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
  ON CONFLICT (citizen_id) DO NOTHING
`.trim()

export function parseCitizenPathname(pathname) {
  const match = CITIZEN_PATHNAME.exec(pathname)
  if (!match) return null
  const founderNumber = Number(match[3])
  return {
    citizenId: match[1],
    tokenHash: match[2],
    founderNumber: founderNumber > 0 ? founderNumber : null,
  }
}

export function parseFounderPathname(pathname) {
  const match = FOUNDER_PATHNAME.exec(pathname)
  return match ? Number(match[1]) : null
}

/**
 * Builds an insert-ready row. founders/ blobs are the authoritative registry,
 * so when the map disagrees with the citizen pathname the map wins.
 */
export function buildCitizenRow(parsed, record, founderByCitizen) {
  const telegramId = Number(record?.telegramUserId)
  return {
    citizenId: parsed.citizenId,
    name: String(record?.name ?? ''),
    tokenHash: parsed.tokenHash,
    founderNumber: founderByCitizen.get(parsed.citizenId) ?? parsed.founderNumber,
    telegramUserId: Number.isSafeInteger(telegramId) ? telegramId : null,
    createdAt: String(record?.createdAt ?? new Date(0).toISOString()),
    raw: record ?? {},
  }
}

export function citizenInsertParams(row) {
  return [
    row.citizenId,
    row.name,
    row.tokenHash,
    row.founderNumber,
    row.telegramUserId,
    row.createdAt,
    JSON.stringify(row.raw),
  ]
}
