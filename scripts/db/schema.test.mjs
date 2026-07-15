import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

describe('ledger genesis schema contract', () => {
  test('derives regular and founder genesis from the citizens row', () => {
    expect(schema).toMatch(/CREATE OR REPLACE FUNCTION reality_ensure_genesis\(/)
    expect(schema).toMatch(/CASE WHEN v_founder IS NULL THEN 2500 ELSE 200000 END/)
    expect(schema).toMatch(/'source', 'registration'/)
  })

  test('append locks and ensures genesis instead of assigning the client seed', () => {
    expect(schema).toMatch(/PERFORM reality_ensure_genesis\(p_citizen\)/)
    expect(schema).not.toMatch(/IF v_base IS NULL THEN v_base := p_seed/)
  })
})
