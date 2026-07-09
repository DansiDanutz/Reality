import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  CITIZEN_INSERT_SQL,
  FOUNDER_SLOTS,
  citizenRowFromRegistration,
  claimFounderNumberPg,
  insertCitizenRow,
  updateCitizenAfterClaim,
  verifyCitizenPg,
} from './_registry'

const REGISTERED_AT = new Date('2026-07-09T12:00:00.000Z')
const CITIZEN = 'a5c9b0f4-9e21-4f7e-9a52-1c1c8f6d1234'

function registration(overrides: Partial<Parameters<typeof citizenRowFromRegistration>[0]> = {}) {
  return citizenRowFromRegistration({
    citizenId: CITIZEN,
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
      citizenId: CITIZEN,
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
    expect(registration({ telegram: { telegramUserId: '42424242' } }).telegramUserId).toBe(42424242)
  })

  test('drops a non-numeric Telegram id instead of poisoning the bigint column', () => {
    expect(registration({ telegram: { telegramUserId: 'not-a-number' } }).telegramUserId).toBeNull()
  })
})

describe('insertCitizenRow', () => {
  test('inserts with ON CONFLICT (citizen_id) DO NOTHING — name conflicts still raise 23505 for the caller', async () => {
    expect(CITIZEN_INSERT_SQL).toMatch(/INSERT INTO citizens/i)
    expect(CITIZEN_INSERT_SQL).toMatch(/ON CONFLICT \(citizen_id\) DO NOTHING/is)

    await insertCitizenRow({ query: queryMock } as never, registration())
    expect(queryMock).toHaveBeenCalledWith(CITIZEN_INSERT_SQL, [
      CITIZEN,
      'David',
      'abc123def456abc123def456',
      7,
      null,
      REGISTERED_AT.toISOString(),
      JSON.stringify({ name: 'David', createdAt: REGISTERED_AT.toISOString() }),
    ])
  })
})

describe('updateCitizenAfterClaim', () => {
  test('refreshes raw and telegram linkage once the founder number is known', async () => {
    await updateCitizenAfterClaim({ query: queryMock } as never, CITIZEN, { name: 'David' }, 42424242)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/UPDATE citizens/i)
    expect(statement).toMatch(/raw = \$2::jsonb/i)
    expect(params).toEqual([CITIZEN, JSON.stringify({ name: 'David' }), 42424242])
  })
})

describe('verifyCitizenPg', () => {
  test('authenticates via the citizens table token hash', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ ok: 1 }])
    const token = 'secret-token'
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24)

    expect(await verifyCitizenPg(CITIZEN, token)).toBe(true)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/FROM citizens/i)
    expect(params).toEqual([CITIZEN, tokenHash])
  })

  test('rejects malformed ids and oversized tokens before touching the db', async () => {
    expect(await verifyCitizenPg('not-a-uuid', 'token')).toBe(false)
    expect(await verifyCitizenPg(CITIZEN, 'x'.repeat(65))).toBe(false)
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('rejects unknown citizens', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([])
    expect(await verifyCitizenPg(CITIZEN, 'secret-token')).toBe(false)
  })
})

describe('claimFounderNumberPg', () => {
  test('claims the lowest free slot in a single atomic statement', async () => {
    queryMock.mockResolvedValueOnce([{ founder_number: 12 }])
    expect(await claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).toBe(12)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(String(statement)).toMatch(/UPDATE citizens/i)
    expect(String(statement)).toMatch(/NOT EXISTS/i)
    expect(params).toEqual([CITIZEN, FOUNDER_SLOTS])
  })

  test('retries on unique-violation (23505) — two racers can never share a slot', async () => {
    const collision = Object.assign(new Error('duplicate key'), { code: '23505' })
    queryMock.mockRejectedValueOnce(collision).mockResolvedValueOnce([{ founder_number: 13 }])
    expect(await claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).toBe(13)
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  test('returns null when all slots are taken', async () => {
    queryMock.mockResolvedValueOnce([{ founder_number: null }])
    expect(await claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).toBeNull()
  })

  test('re-selects the existing slot when the same citizen claims twice — never misreports "slots full"', async () => {
    queryMock
      .mockResolvedValueOnce([]) // UPDATE matched no rows: founder_number already set
      .mockResolvedValueOnce([{ founder_number: 12 }]) // re-select finds the held slot
    expect(await claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).toBe(12)
    const [reselect] = queryMock.mock.calls[1] as [string]
    expect(reselect).toMatch(/SELECT founder_number FROM citizens/i)
  })

  test('rethrows non-collision errors instead of eating them', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).rejects.toThrow('connection refused')
  })

  test('gives up after the retry budget under sustained collision', async () => {
    const collision = Object.assign(new Error('duplicate key'), { code: '23505' })
    queryMock.mockRejectedValue(collision)
    await expect(claimFounderNumberPg({ query: queryMock } as never, CITIZEN)).rejects.toThrow('duplicate key')
    expect(queryMock.mock.calls.length).toBeGreaterThanOrEqual(8)
  })
})
