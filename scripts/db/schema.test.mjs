import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

describe('ledger genesis schema contract', () => {
  test('enforces one citizen per verified Telegram identity', () => {
    expect(schema).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS citizens_telegram_user_id_key/)
    expect(schema).toMatch(/ON citizens \(telegram_user_id\) WHERE telegram_user_id IS NOT NULL/)
    expect(schema).toMatch(/duplicate preflight query/i)
  })

  test('derives regular and founder genesis from the citizens row', () => {
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_ensure_genesis\(/)
    expect(schema).toMatch(/CASE WHEN v_founder IS NULL THEN 2500 ELSE 200000 END/)
    expect(schema).toMatch(/'source', 'registration'/)
  })

  test('append locks and ensures genesis instead of assigning the client seed', () => {
    expect(schema).toMatch(/PERFORM reality_ensure_genesis\(p_citizen\)/)
    expect(schema).not.toMatch(/IF v_base IS NULL THEN v_base := p_seed/)
  })

  test('provides an atomic Founder Area snapshot revision boundary', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS founder_area_snapshots/)
    expect(schema).toMatch(/revision\s+bigint NOT NULL DEFAULT 0/)
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_save_founder_area\(/)
    expect(schema).toMatch(/founder_area_snapshots\.revision = p_expected_revision/)
    expect(schema).toMatch(/founder_area_revision_conflict/)
  })

  test('provides an atomic server-owned world placement boundary', () => {
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_place_asset\(/)
    expect(schema).toMatch(/PERFORM pg_advisory_xact_lock\(hashtext\(p_citizen::text\)\)/)
    expect(schema).toMatch(/INSERT INTO assets \(asset_id, citizen_id, item_id, kind, lat, lng, placed_at, raw\)/)
    expect(schema).toMatch(/'world.place'/)
    expect(schema).toMatch(/p_daily_limit integer/)
    expect(schema).toMatch(/daily_limit/)
  })
})
