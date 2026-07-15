/**
 * Credential-free operational gate for Founder Area cutover.
 *
 * This intentionally checks presence only. It never prints credential values
 * and never contacts Postgres or Blob; the live backfill and contention tests
 * remain separate, explicit operations.
 */
const hasDatabase = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL)
const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN)
const flagEnabled = process.env.REALITY_FOUNDER_AREA_POSTGRES === '1'
const missing = [
  ...(!hasDatabase ? ['POSTGRES_URL or DATABASE_URL'] : []),
  ...(!hasBlob ? ['BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN'] : []),
]

const result = {
  ok: missing.length === 0,
  checks: {
    databaseCredentialPresent: hasDatabase,
    blobCredentialPresent: hasBlob,
    founderAreaPostgresFlagEnabled: flagEnabled,
  },
  missing,
  next: missing.length === 0
    ? 'Run the Founder Area backfill dry-run, then the live concurrent Postgres evidence script before enabling broad authority.'
    : 'Provide the missing credentials through the deployment secret manager; do not commit or print them.',
}

console.log(JSON.stringify(result))
if (missing.length > 0) process.exitCode = 1
