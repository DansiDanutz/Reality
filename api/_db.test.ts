import { afterEach, describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { databaseUrl, db, isPostgresEnabled, resetDbForTest } from './_db'

afterEach(() => {
  resetDbForTest()
})

describe('postgres feature flag', () => {
  test('is OFF by default — no flag, no database access', () => {
    expect(isPostgresEnabled({} as NodeJS.ProcessEnv)).toBe(false)
    expect(isPostgresEnabled({ POSTGRES_URL: 'postgres://x' } as NodeJS.ProcessEnv)).toBe(false)
  })

  test('requires BOTH the flag and a connection string', () => {
    expect(isPostgresEnabled({ POSTGRES_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(false)
    expect(isPostgresEnabled({ POSTGRES_ENABLED: '1', POSTGRES_URL: 'postgres://x' } as NodeJS.ProcessEnv)).toBe(true)
    expect(isPostgresEnabled({ POSTGRES_ENABLED: 'true', DATABASE_URL: 'postgres://x' } as NodeJS.ProcessEnv)).toBe(true)
    expect(isPostgresEnabled({ POSTGRES_ENABLED: 'no', POSTGRES_URL: 'postgres://x' } as NodeJS.ProcessEnv)).toBe(false)
  })

  test('POSTGRES_URL wins over DATABASE_URL', () => {
    expect(databaseUrl({ POSTGRES_URL: 'postgres://pooled', DATABASE_URL: 'postgres://direct' } as NodeJS.ProcessEnv))
      .toBe('postgres://pooled')
  })

  test('db() throws while the flag is off — flag-off deployments cannot connect', () => {
    expect(() => db({} as NodeJS.ProcessEnv)).toThrow(/not enabled/)
  })
})

describe('schema DDL', () => {
  const schema = readFileSync(new URL('../scripts/db/schema.sql', import.meta.url), 'utf8')

  test('creates all four Phase 1b tables', () => {
    for (const table of ['citizens', 'assets', 'ledger', 'scores']) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))
    }
  })

  test('is idempotent — every CREATE carries IF NOT EXISTS, and nothing destructive', () => {
    const creates = schema.match(/CREATE (TABLE|INDEX|UNIQUE INDEX)/g) ?? []
    const guarded = schema.match(/CREATE (TABLE|INDEX|UNIQUE INDEX)( CONCURRENTLY)? IF NOT EXISTS/g) ?? []
    expect(creates.length).toBeGreaterThan(0)
    expect(guarded.length).toBe(creates.length)
    // ON DELETE CASCADE is fine — destructive STATEMENTS are not.
    expect(schema).not.toMatch(/DROP TABLE|DROP INDEX|TRUNCATE|DELETE FROM/)
  })

  test('assets are keyed per citizen — asset ids are only unique within world/{citizenId}/ in Blob', () => {
    expect(schema).toMatch(/PRIMARY KEY \(citizen_id, asset_id\)/)
  })

  test('the ledger is append-only by shape: identity PK and no updated_at', () => {
    expect(schema).toMatch(/entry_id\s+bigint GENERATED ALWAYS AS IDENTITY/)
    expect(schema).not.toMatch(/ledger[\s\S]*updated_at/)
  })
})
