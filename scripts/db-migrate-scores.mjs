#!/usr/bin/env node
/**
 * One-shot scores backfill (issue #900): copies every leaderboard score from
 * Vercel Blob into the Postgres scores table. All data is encoded in the
 * blob pathname, so no blob content is read. Idempotent — inserts are
 * ON CONFLICT DO NOTHING, so re-runs and overlap with live dual-writes are
 * safe (an existing row means a live dual-write already put fresher data
 * there). Reads stay on Blob until the Phase 1b.6 cutover.
 *
 * Usage (after `vercel env pull` or with env exported):
 *   POSTGRES_URL=postgres://... BLOB_READ_WRITE_TOKEN=... node scripts/db-migrate-scores.mjs
 */
import { list } from '@vercel/blob'
import { neon } from '@neondatabase/serverless'
import {
  SCORE_INSERT_SQL,
  buildScoreRow,
  parseScorePathname,
  scoreInsertParams,
} from './db/scores-migration-lib.mjs'

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('POSTGRES_URL (or DATABASE_URL) is required.')
  process.exit(1)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is required to read the scores prefix.')
  process.exit(1)
}

const sql = neon(url)

async function listAll(prefix) {
  const blobs = []
  let cursor
  do {
    const batch = await list({ prefix, cursor, limit: 1000 })
    blobs.push(...batch.blobs)
    cursor = batch.hasMore ? batch.cursor : undefined
  } while (cursor)
  return blobs
}

// scores.citizen_id has a FK to citizens — run db-migrate-registry.mjs first.
const knownCitizens = new Set(
  (await sql.query('SELECT citizen_id FROM citizens')).map((row) => row.citizen_id),
)
console.log(`citizens table: ${knownCitizens.size} known citizens`)

const scoreBlobs = await listAll('scores/')
let inserted = 0
let skipped = 0
let malformed = 0
let orphaned = 0
let errored = 0
for (const blob of scoreBlobs) {
  // One bad blob must not kill the run: log it, keep going, report at the end.
  try {
    const parsed = parseScorePathname(blob.pathname)
    if (!parsed) {
      malformed += 1
      console.error(`skipping malformed pathname: ${blob.pathname}`)
      continue
    }
    if (!knownCitizens.has(parsed.citizenId)) {
      orphaned += 1
      console.error(`skipping ${blob.pathname}: citizen ${parsed.citizenId} not in Postgres (run db-migrate-registry.mjs first)`)
      continue
    }
    const row = buildScoreRow(parsed, blob.uploadedAt)
    const rows = await sql.query(`${SCORE_INSERT_SQL} RETURNING citizen_id`, scoreInsertParams(row))
    if (rows.length > 0) inserted += 1
    else skipped += 1 // already present — a re-run or a live dual-write beat us
  } catch (error) {
    errored += 1
    console.error(`failed on ${blob.pathname}:`, error)
  }
}

console.log(
  `scores/: ${scoreBlobs.length} blobs → ${inserted} inserted, ${skipped} already present, ` +
  `${malformed} malformed, ${orphaned} orphaned, ${errored} errored`,
)
if (errored > 0) process.exitCode = 1

const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM scores')
console.log(`scores table now holds ${count} rows`)
