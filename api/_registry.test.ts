import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  CITIZEN_INSERT_SQL,
  citizenRowFromRegistration,
  claimFounderNumberPg,
  dualWriteCitizenRow,
  insertCitizenRow,
} from './_registry'

const REGISTERED_AT = new Date('2026-07-09T12:00:00.000Z')

function registration(overrides: Partial<Parameters<typeof citizenRowFromRegistration>[0]> = {}) {
  return citizenRowFromRegistration({
    citizenId: 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234',
    name: 'David',
    tokenHash: 'abc123def456abc123def456',
    founderNumber: 7,
    registeredAt: REGISTERED_AT,
    record: { name: 'David', createdAt: REGISTERED_AT.toISOString() },
    telegram: null,
    ...overrides,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('citizenRowFromRegistration', () => {
  test('shapes a citizens table row mirroring the Blob record', () => {
    const row = registration()
    expect(row).toEqual({
      citizenId: 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234',
      name: 'David',
      tokenHash: 'abc123def456abc123def456',
      founderNumber: 7,
      telegramUserId: null,
      createdAt: REGISTERED_AT.toISOString(),
      raw: { name: 'David', createdAt: REGISTERED_AT.toISOString() },
    })
  })

  test('maps missing founder slot (null) through unchanged, never 0', () => {
    expect(registration({ founderNumber: null }).founderNumber).toBeNull()
  })

  test('converts a linked Telegram account id to a bigint-safe number', () => {
    const row = registration({
      telegram: { telegramUserId: '42424242' },
    })
    expect(row.telegramUserId).toBe(42424242)
  })

  test('drops a non-numeric Telegram id instead of poisoning the bigint column', () => {
    const row = registration({ telegram: { telegramUserId: 'not-a-number' } })
    expect(row.telegramUserId).toBeNull()
  })
})

describe('insertCitizenRow', () => {
  test('inserts with ON CONFLICT DO NOTHING — the Postgres twin of allowOverwrite:false', async () => {
    expect(CITIZEN_INSERT_SQL).toMatch(/INSERT INTO citizens/i)
    expect(CITIZEN_INSERT_SQL).toMatch(/ON CONFLICT.*DO NOTHING/is)

    const sql = { query: queryMock }
    await insertCitizenRow(sql as never, registration())
    expect(queryMock).toHaveBeenCalledWith(CITIZEN_INSERT_SQL, [
      'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234',
      'David',
      'abc123def456abc123def456',
      7,
      null,
      REGISTERED_AT.toISOString(),
      JSON.stringify({ name: 'David', createdAt: REGISTERED_AT.toISOString() }),
    ])
  })
})

describe('dualWriteCitizenRow', () => {
  test('does nothing when POSTGRES_ENABLED is off', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '')
    await dualWriteCitizenRow(registration())
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('writes the citizen row when the flag is on', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    await dualWriteCitizenRow(registration())
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0][0]).toBe(CITIZEN_INSERT_SQL)
  })

  test('never throws — a Postgres failure is logged, Blob stays authoritative', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused'))

    await expect(dualWriteCitizenRow(registration())).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('dual-write'),
      expect.any(Error),
    )
  })
})

describe('claimFounderNumberPg', () => {
  const CITIZEN = 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234'

  test('claims the lowest free slot in a single atomic statement', async () => {
    queryMock.mockResolvedValueOnce([{ founder_number: 12 }])
    const sql = { query: queryMock }

    const claimed = await claimFounderNumberPg(sql as never, CITIZEN)

    expect(claimed).toBe(12)
    expect(queryMock).toHaveBeenCalledTimes(1)
    const [statement, params] = queryMock.mock.calls[0]
    expect(String(statement)).toMatch(/UPDATE citizens/i)
    expect(String(statement)).toMatch(/NOT EXISTS/i)
    expect(params).toEqual([CITIZEN, 2000])
  })

  test('retries on unique-violation (23505) — two racers can never share a slot', async () => {
    const collision = Object.assign(new Error('duplicate key'), { code: '23505' })
    queryMock
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce([{ founder_number: 13 }])
    const sql = { query: queryMock }

    const claimed = await claimFounderNumberPg(sql as never, CITIZEN)

    expect(claimed).toBe(13)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  test('returns null when all 2000 slots are taken', async () => {
    queryMock.mockResolvedValueOnce([{ founder_number: null }])
    const sql = { query: queryMock }
    expect(await claimFounderNumberPg(sql as never, CITIZEN)).toBeNull()
  })

  test('rethrows non-collision errors instead of eating them', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    const sql = { query: queryMock }
    await expect(claimFounderNumberPg(sql as never, CITIZEN)).rejects.toThrow('connection refused')
  })

  test('gives up after the retry budget under sustained collision', async () => {
    const collision = Object.assign(new Error('duplicate key'), { code: '23505' })
    queryMock.mockRejectedValue(collision)
    const sql = { query: queryMock }
    await expect(claimFounderNumberPg(sql as never, CITIZEN)).rejects.toThrow('duplicate key')
    expect(queryMock.mock.calls.length).toBeGreaterThanOrEqual(8)
  })
})
