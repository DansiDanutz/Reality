import { describe, expect, test } from 'vitest'
import {
  SCORE_INSERT_SQL,
  buildScoreRow,
  parseScorePathname,
  scoreInsertParams,
} from './scores-migration-lib.mjs'

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'

describe('parseScorePathname', () => {
  test('extracts citizen id, capped worth and display name from the pathname scheme', () => {
    expect(parseScorePathname(`scores/${CITIZEN_ID}__750000__water-maker.json`)).toEqual({
      citizenId: CITIZEN_ID,
      cappedWorth: 750000,
      name: 'water-maker',
    })
  })

  test('rejects pathnames that do not match the scheme', () => {
    expect(parseScorePathname('scores/garbage.json')).toBeNull()
    expect(parseScorePathname(`scores/${CITIZEN_ID}__-5__x.json`)).toBeNull()
    expect(parseScorePathname(`world/${CITIZEN_ID}/a__b__home__1__2.json`)).toBeNull()
  })
})

describe('buildScoreRow', () => {
  test('shapes an insert-ready row — the pathname worth is already the capped value', () => {
    const parsed = { citizenId: CITIZEN_ID, cappedWorth: 750000, name: 'water-maker' }
    const row = buildScoreRow(parsed, new Date('2026-07-09T10:00:00.000Z'))
    expect(row).toEqual({
      citizenId: CITIZEN_ID,
      name: 'water-maker',
      netWorth: 750000,
      cappedWorth: 750000,
      reportedAt: '2026-07-09T10:00:00.000Z',
    })
    expect(scoreInsertParams(row)).toEqual([CITIZEN_ID, 'water-maker', 750000, 750000, '2026-07-09T10:00:00.000Z'])
  })

  test('insert statement is idempotent for backfill — never clobbers a newer dual-write', () => {
    expect(SCORE_INSERT_SQL).toMatch(/INSERT INTO scores/i)
    expect(SCORE_INSERT_SQL).toMatch(/ON CONFLICT \(citizen_id\) DO NOTHING/i)
  })
})
