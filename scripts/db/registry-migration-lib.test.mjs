import { describe, expect, test } from 'vitest'
import {
  CITIZEN_INSERT_SQL,
  buildCitizenRow,
  parseCitizenPathname,
  parseFounderPathname,
} from './registry-migration-lib.mjs'

describe('parseCitizenPathname', () => {
  test('extracts id, token hash and founder number from the Blob pathname scheme', () => {
    expect(parseCitizenPathname('citizens/a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234__abc123def456abc123def456__7.json')).toEqual({
      citizenId: 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234',
      tokenHash: 'abc123def456abc123def456',
      founderNumber: 7,
    })
  })

  test('maps the 0 sentinel (no founder slot) to null', () => {
    expect(
      parseCitizenPathname('citizens/a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234__abc123def456abc123def456__0.json')?.founderNumber,
    ).toBeNull()
  })

  test('rejects pathnames that do not match the scheme', () => {
    expect(parseCitizenPathname('citizens/garbage.json')).toBeNull()
    expect(parseCitizenPathname('names/david.json')).toBeNull()
  })
})

describe('parseFounderPathname', () => {
  test('extracts the slot number from founders/NNNN.json', () => {
    expect(parseFounderPathname('founders/0007.json')).toBe(7)
    expect(parseFounderPathname('founders/2000.json')).toBe(2000)
  })

  test('rejects non-registry pathnames', () => {
    expect(parseFounderPathname('founders/README.md')).toBeNull()
    expect(parseFounderPathname('citizens/0007.json')).toBeNull()
  })
})

describe('buildCitizenRow', () => {
  const parsed = {
    citizenId: 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234',
    tokenHash: 'abc123def456abc123def456',
    founderNumber: null,
  }
  const record = { name: 'David', createdAt: '2026-07-09T12:00:00.000Z' }

  test('shapes an insert-ready row from the parsed pathname and blob record', () => {
    expect(buildCitizenRow(parsed, record, new Map())).toEqual({
      citizenId: parsed.citizenId,
      name: 'David',
      tokenHash: parsed.tokenHash,
      founderNumber: null,
      telegramUserId: null,
      createdAt: '2026-07-09T12:00:00.000Z',
      raw: record,
    })
  })

  test('prefers the founders/ registry over the pathname when they disagree', () => {
    const founderByCitizen = new Map([[parsed.citizenId, 42]])
    expect(buildCitizenRow(parsed, record, founderByCitizen).founderNumber).toBe(42)
  })

  test('carries a linked Telegram id into the bigint column', () => {
    const row = buildCitizenRow(parsed, { ...record, telegramUserId: '42424242' }, new Map())
    expect(row.telegramUserId).toBe(42424242)
  })

  test('refuses a missing or nameless record — a bad row must not land and block self-healing forever', () => {
    expect(buildCitizenRow(parsed, null, new Map())).toBeNull()
    expect(buildCitizenRow(parsed, {}, new Map())).toBeNull()
    expect(buildCitizenRow(parsed, { name: '   ' }, new Map())).toBeNull()
  })

  test('insert statement is idempotent (ON CONFLICT DO NOTHING) so re-runs are safe', () => {
    expect(CITIZEN_INSERT_SQL).toMatch(/INSERT INTO citizens/i)
    expect(CITIZEN_INSERT_SQL).toMatch(/ON CONFLICT.*DO NOTHING/is)
  })
})
