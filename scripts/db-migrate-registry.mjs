#!/usr/bin/env node
/**
 * One-shot registry backfill (issue #897): copies every citizen from Vercel
 * Blob into Postgres. Idempotent — inserts are ON CONFLICT DO NOTHING, so
 * re-runs and overlap with live dual-writes are safe (first write wins).
 * Reads stay on Blob until the Phase 1b.6 cutover; this only backfills.
 *
 * Usage (after `vercel env pull` or with env exported):
 *   POSTGRES_URL=postgres://... BLOB_READ_WRITE_TOKEN=... node scripts/db-migrate-registry.mjs
 */
import { get, list } from '@vercel/blob'
import { neon } from '@neondatabase/serverless'
import {
  CITIZEN_INSERT_SQL,
  buildCitizenRow,
  citizenInsertParams,
  parseCitizenPathname,
  parseFounderPathname,
} from './db/registry-migration-lib.mjs'

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('POSTGRES_URL (or DATABASE_URL) is required.')
  process.exit(1)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is required to read the Blob registry.')
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

async function readJson(blob) {
  // get() signs the request — required because registry blobs are access:private.
  const result = await get(blob.url, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Failed to read ${blob.pathname}: ${result ? `HTTP ${result.statusCode}` : 'not found'}`)
  }
  return new Response(result.stream).json()
}

// The founders/ prefix is the authoritative slot registry — build
// citizenId -> founderNumber from it so drifted citizen pathnames are healed.
const founderByCitizen = new Map()
for (const blob of await listAll('founders/')) {
  const founderNumber = parseFounderPathname(blob.pathname)
  if (founderNumber === null) continue
  const record = await readJson(blob)
  if (record?.citizenId) founderByCitizen.set(String(record.citizenId), founderNumber)
}
console.log(`founders/: ${founderByCitizen.size} claimed slots`)

const citizenBlobs = await listAll('citizens/')
let inserted = 0
let skipped = 0
let malformed = 0
let errored = 0
for (const blob of citizenBlobs) {
  // One bad blob must not kill the run: log it, keep going, report at the end.
  // Re-runs stay safe either way (ON CONFLICT DO NOTHING).
  try {
    const parsed = parseCitizenPathname(blob.pathname)
    if (!parsed) {
      malformed += 1
      console.error(`skipping malformed pathname: ${blob.pathname}`)
      continue
    }
    const record = await readJson(blob)
    const row = buildCitizenRow(parsed, record, founderByCitizen)
    if (!row) {
      malformed += 1
      console.error(`skipping ${blob.pathname}: record has no usable name`)
      continue
    }
    const rows = await sql.query(`${CITIZEN_INSERT_SQL} RETURNING citizen_id`, citizenInsertParams(row))
    if (rows.length > 0) inserted += 1
    else skipped += 1 // already present — a re-run or a live dual-write beat us
  } catch (error) {
    errored += 1
    console.error(`failed on ${blob.pathname}:`, error)
  }
}

console.log(`citizens/: ${citizenBlobs.length} blobs → ${inserted} inserted, ${skipped} already present, ${malformed} malformed, ${errored} errored`)
if (errored > 0) process.exitCode = 1

const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM citizens')
console.log(`citizens table now holds ${count} rows`)
