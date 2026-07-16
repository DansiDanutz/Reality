import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

describe('Founder Area backfill preflight', () => {
  test('refuses non-dry-run writes without explicit migration opt-in', () => {
    const result = spawnSync(process.execPath, ['scripts/db-migrate-founder-areas.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, FOUNDER_AREA_MIGRATION_DRY_RUN: '', FOUNDER_AREA_MIGRATION_ALLOW_WRITE: '', POSTGRES_URL: '', DATABASE_URL: '', BLOB_READ_WRITE_TOKEN: '', VERCEL_OIDC_TOKEN: '' },
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain('FOUNDER_AREA_MIGRATION_ALLOW_WRITE=1')
  })

  test('reports missing Blob read authority before invoking the SDK', () => {
    const result = spawnSync(process.execPath, ['scripts/db-migrate-founder-areas.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, FOUNDER_AREA_MIGRATION_DRY_RUN: '1', POSTGRES_URL: '', DATABASE_URL: '', BLOB_READ_WRITE_TOKEN: '', VERCEL_OIDC_TOKEN: '' },
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain('BLOB_READ_WRITE_TOKEN (or VERCEL_OIDC_TOKEN) is required')
  })
})
