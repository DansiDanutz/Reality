import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

describe('ledger genesis schema contract', () => {
  test('enforces one citizen per verified Telegram identity', () => {
    expect(schema).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS citizens_telegram_user_id_key/)
    expect(schema).toMatch(/ON citizens \(telegram_user_id\) WHERE telegram_user_id IS NOT NULL/)
    expect(schema).toMatch(/duplicate preflight query/i)
  })

  test('stores a server-side token revocation timestamp', () => {
    expect(schema).toMatch(/ALTER TABLE citizens ADD COLUMN IF NOT EXISTS token_revoked_at timestamptz/)
  })

  test('gives newly issued tokens a bounded expiry while preserving legacy rows', () => {
    expect(schema).toMatch(/ALTER TABLE citizens ADD COLUMN IF NOT EXISTS token_expires_at timestamptz/)
    expect(schema).toMatch(/ALTER COLUMN token_expires_at SET DEFAULT \(now\(\) \+ interval '30 days'\)/)
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
    expect(schema).toMatch(/asset_mismatch/)
  })

  test('provides an atomic registration IP/day reservation boundary', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS registration_rate_limits/)
    expect(schema).toMatch(/PRIMARY KEY \(ip_hash, day\)/)
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_claim_registration_slot\(/)
    expect(schema).toMatch(/WHERE registration_rate_limits\.attempts < p_limit/)
  })

  test('provides an atomic per-citizen and global avatar quota boundary', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS avatar_rate_limits/)
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_claim_avatar_slot\(/)
    expect(schema).toMatch(/pg_advisory_xact_lock\(hashtext\('avatar:'/)
    expect(schema).toMatch(/p_citizen_limit integer/)
    expect(schema).toMatch(/p_global_limit integer/)
  })
})
