#!/usr/bin/env node
/**
 * Applies scripts/db/schema.sql to the database in POSTGRES_URL.
 * The schema is fully idempotent (IF NOT EXISTS everywhere), so this is
 * safe to re-run. Usage:
 *
 *   POSTGRES_URL=postgres://... node scripts/db-migrate.mjs
 *   # or after `vercel env pull`:
 *   export $(grep '^POSTGRES_URL=' .vercel/.env.*.local | tr -d '"') && node scripts/db-migrate.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const dryRun = process.argv.includes('--dry-run')
const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL
if (!url && !dryRun) {
  console.error('POSTGRES_URL (or DATABASE_URL) is required.')
  process.exit(1)
}

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'db', 'schema.sql')
const schema = readFileSync(schemaPath, 'utf8')

// The Neon HTTP driver executes one statement per call — split on statement
// boundaries (this schema contains no string literals with semicolons).
// Comment LINES are stripped inside each chunk; a chunk that begins with a
// comment still carries its statement.
const statements = schema
  .split(/;\s*\n/)
  .map((chunk) =>
    chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim(),
  )
  .filter((s) => s.length > 0)

if (dryRun) {
  const requiredObjects = [
    'reality_save_founder_area',
    'reality_place_asset',
    'reality_claim_registration_slot',
    'token_revoked_at',
    'token_expires_at',
  ]
  const missing = requiredObjects.filter((object) => !schema.includes(object))
  if (missing.length > 0) {
    console.error(`Dry run failed; missing authority objects: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log(`Dry run: ${statements.length} idempotent statements; authority objects present: ${requiredObjects.join(', ')}`)
  process.exit(0)
}

const sql = neon(url)
let applied = 0
for (const statement of statements) {
  await sql.query(statement)
  applied += 1
}

// neon()'s query() resolves to the row array itself.
const tables = await sql.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
)
console.log(`Applied ${applied} statements. Tables now present: ${tables.map((r) => r.table_name).join(', ')}`)
