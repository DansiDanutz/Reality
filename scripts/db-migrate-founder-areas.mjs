#!/usr/bin/env node
/**
 * Resumable Blob-to-Postgres Founder Area backfill (issue #542).
 * Existing database rows are never overwritten: the database CAS function is
 * called with expected revision 0 and conflicts are reported as skipped.
 * Use FOUNDER_AREA_MIGRATION_DRY_RUN=1 to inspect without writes.
 */
import { list } from '@vercel/blob'
import { neon } from '@neondatabase/serverless'
import { FOUNDER_AREA_SAVE_SQL, areaStatePathFromBlob, isRevisionConflict, migratableFounderAreaSnapshot } from './db/founder-area-migration-lib.mjs'

const dryRun = process.env.FOUNDER_AREA_MIGRATION_DRY_RUN === '1'
const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL
if (!dryRun && !url) throw new Error('POSTGRES_URL (or DATABASE_URL) is required unless FOUNDER_AREA_MIGRATION_DRY_RUN=1.')
if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN (or VERCEL_OIDC_TOKEN) is required to read Founder Area snapshots, including dry runs.')
}

const sql = dryRun ? null : neon(url)
let cursor
let scanned = 0
let migrated = 0
let skipped = 0
let invalid = 0
do {
  const batch = await list({ prefix: 'reality-areas/', ...(cursor ? { cursor } : {}), limit: 1000 })
  for (const blob of batch.blobs) {
    scanned += 1
    const response = await fetch(blob.downloadUrl)
    if (!response.ok) {
      invalid += 1
      console.error(`Unreadable Founder Area blob: ${areaStatePathFromBlob(blob)}`)
      continue
    }
    const candidate = migratableFounderAreaSnapshot(await response.json())
    if (!candidate) {
      invalid += 1
      console.error(`Rejected malformed Founder Area blob: ${areaStatePathFromBlob(blob)}`)
      continue
    }
    if (dryRun) {
      migrated += 1
      continue
    }
    try {
      await sql.query(FOUNDER_AREA_SAVE_SQL, [
        candidate.citizenId,
        candidate.areaId,
        0,
        JSON.stringify(candidate.state),
        candidate.simulationAt,
        candidate.updatedAt,
      ])
      migrated += 1
    } catch (error) {
      if (isRevisionConflict(error)) skipped += 1
      else throw error
    }
  }
  cursor = batch.hasMore ? batch.cursor : undefined
} while (cursor)

console.log(JSON.stringify({ dryRun, scanned, migrated, skipped, invalid }))
