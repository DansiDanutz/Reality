import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const SCRIPT = fileURLToPath(new URL('./cutover-preflight.mjs', import.meta.url))

function run(env) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

describe('Founder Area cutover preflight', () => {
  test('reports missing authority without exposing values', () => {
    const result = run({ POSTGRES_URL: '', DATABASE_URL: '', BLOB_READ_WRITE_TOKEN: '', VERCEL_OIDC_TOKEN: '' })
    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(false)
    expect(parsed.missing).toEqual(['POSTGRES_URL or DATABASE_URL', 'BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN'])
    expect(result.stdout).not.toContain('postgres://')
  })

  test('passes presence checks without contacting external services', () => {
    const result = run({ POSTGRES_URL: 'redacted-db', BLOB_READ_WRITE_TOKEN: 'redacted-blob', REALITY_FOUNDER_AREA_POSTGRES: '1' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({ ok: true, checks: { databaseCredentialPresent: true, blobCredentialPresent: true, founderAreaPostgresFlagEnabled: true } })
    expect(result.stdout).not.toContain('redacted-db')
    expect(result.stdout).not.toContain('redacted-blob')
  })
})
