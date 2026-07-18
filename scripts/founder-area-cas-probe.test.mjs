import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const SCRIPT = fileURLToPath(new URL('./founder-area-cas-probe.mjs', import.meta.url))

describe('Founder Area CAS probe guard', () => {
  test('uses the Neon query API required by the installed driver', async () => {
    const source = await (await import('node:fs/promises')).readFile(SCRIPT, 'utf8')
    expect(source).toContain('sql.query(')
    expect(source).not.toMatch(/await sql\(/)
  })

  test('refuses to write without explicit dedicated-test opt-in', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, POSTGRES_URL: 'redacted', REALITY_CUTOVER_CITIZEN_ID: 'id', REALITY_CUTOVER_AREA_ID: 'area', REALITY_CUTOVER_STATE_JSON: '{}' } })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('REALITY_CUTOVER_ALLOW_WRITE=1')
    expect(result.stderr).not.toContain('redacted')
  })
})
