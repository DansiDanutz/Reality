import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({ neon: () => ({ query: queryMock }) }))

import { resetDbForTest } from './_db'
import {
  FOUNDER_AREA_SAVE_SQL,
  FOUNDER_AREA_SELECT_SQL,
  founderAreaPgEnabled,
  readFounderAreaPg,
  saveFounderAreaPg,
} from './_founderAreaPg'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('Founder Area Postgres repository adapter', () => {
  test('is opt-in during the Blob-to-Postgres migration', () => {
    expect(founderAreaPgEnabled({ REALITY_FOUNDER_AREA_POSTGRES: '1' })).toBe(true)
    expect(founderAreaPgEnabled({ REALITY_FOUNDER_AREA_POSTGRES: '0' })).toBe(false)
  })

  test('reads a revisioned snapshot with normalized timestamps', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{
      citizen_id: 'citizen-1', area_id: 'founder-area-0001', revision: '4',
      simulation_at: '2026-07-15T10:00:00.000Z', updated_at: '2026-07-15T10:01:00.000Z', state: { balance: 10 },
    }])
    await expect(readFounderAreaPg('citizen-1')).resolves.toEqual({
      citizenId: 'citizen-1', areaId: 'founder-area-0001', revision: 4,
      simulationAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:01:00.000Z', state: { balance: 10 },
    })
    expect(queryMock).toHaveBeenCalledWith(FOUNDER_AREA_SELECT_SQL, ['citizen-1'])
  })

  test('saves through the database CAS function and returns the new revision', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ revision: '5' }])
    await expect(saveFounderAreaPg({
      citizenId: 'citizen-1', areaId: 'founder-area-0001', simulationAt: null,
      updatedAt: '2026-07-15T10:01:00.000Z', state: { balance: 11 },
    }, 4)).resolves.toBe(5)
    expect(queryMock).toHaveBeenCalledWith(FOUNDER_AREA_SAVE_SQL, [
      'citizen-1', 'founder-area-0001', 4, JSON.stringify({ balance: 11 }), null, '2026-07-15T10:01:00.000Z',
    ])
  })
})
