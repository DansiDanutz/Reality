import { execFileSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

describe('database migration preflight', () => {
  test('dry-run parses authority migrations without credentials or network access', () => {
    const output = execFileSync(process.execPath, ['scripts/db-migrate.mjs', '--dry-run'], {
      cwd: process.cwd(),
      env: { ...process.env, POSTGRES_URL: '', DATABASE_URL: '' },
      encoding: 'utf8',
    })

    expect(output).toMatch(/Dry run: \d+ idempotent statements/)
    expect(output).toContain('reality_save_founder_area')
    expect(output).toContain('reality_claim_registration_slot')
    expect(output).toContain('token_expires_at')
  })
})
