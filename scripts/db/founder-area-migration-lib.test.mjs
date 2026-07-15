import { describe, expect, test } from 'vitest'
import { FOUNDER_AREA_SAVE_SQL, isRevisionConflict, migratableFounderAreaSnapshot } from './founder-area-migration-lib.mjs'

const base = {
  founderCitizenId: '12345678-1234-1234-1234-123456789abc', areaId: 'founder-area-0001', founderNumber: 1,
  balance: 200000, businesses: [], citizens: [], transactions: [], updatedAt: '2026-07-15T10:00:00.000Z',
}

describe('Founder Area migration boundary', () => {
  test('accepts a valid snapshot and preserves the simulation cursor', () => {
    expect(migratableFounderAreaSnapshot({ ...base, simulationAt: '2026-07-15T09:00:00.000Z' })).toMatchObject({
      citizenId: base.founderCitizenId, areaId: base.areaId, simulationAt: '2026-07-15T09:00:00.000Z',
    })
  })

  test('rejects malformed or non-founder snapshots before writing', () => {
    expect(migratableFounderAreaSnapshot({ ...base, founderCitizenId: 'not-a-uuid' })).toBeNull()
    expect(migratableFounderAreaSnapshot({ ...base, transactions: 'invalid' })).toBeNull()
  })

  test('uses the database CAS function and recognizes existing-row conflicts', () => {
    expect(FOUNDER_AREA_SAVE_SQL).toMatch(/reality_save_founder_area/)
    expect(isRevisionConflict(new Error('founder_area_revision_conflict'))).toBe(true)
    expect(isRevisionConflict(new Error('connection refused'))).toBe(false)
  })
})
