import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  SCORE_UPSERT_SQL,
  citizenAgeDaysPg,
  dualWriteScore,
  maxPlausibleWorth,
} from './_scoresPg'

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const REPORTED_AT = new Date('2026-07-10T12:00:00.000Z')

function score(overrides: Partial<Parameters<typeof dualWriteScore>[0]> = {}) {
  return {
    citizenId: CITIZEN_ID,
    name: 'water-maker',
    netWorth: 750_000,
    cappedWorth: 750_000,
    reportedAt: REPORTED_AT,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('maxPlausibleWorth', () => {
  test('is the founder grant plus a generous daily allowance', () => {
    expect(maxPlausibleWorth(0)).toBe(300_000) // day 0: 200k + 1 * 100k
    expect(maxPlausibleWorth(5)).toBe(800_000) // 200k + 6 * 100k
  })

  test('rounds partial days up — the cap only ever raises with age', () => {
    expect(maxPlausibleWorth(2.3)).toBe(200_000 + Math.ceil(3.3) * 100_000)
  })
})

describe('dualWriteScore', () => {
  test('does nothing when POSTGRES_ENABLED is off', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '')
    await dualWriteScore(score())
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('upserts the score row — one row per citizen, replaced on conflict', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await dualWriteScore(score())

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toBe(SCORE_UPSERT_SQL)
    expect(statement).toMatch(/INSERT INTO scores/i)
    expect(statement).toMatch(/ON CONFLICT \(citizen_id\) DO UPDATE/i)
    expect(params).toEqual([CITIZEN_ID, 'water-maker', 750_000, 750_000, REPORTED_AT.toISOString()])
  })

  test('logs a capped claim to the ledger with the reason when the cap bit', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await dualWriteScore(score({ netWorth: 9_000_000, cappedWorth: 800_000 }))

    expect(queryMock).toHaveBeenCalledTimes(2)
    const [ledgerSql, ledgerParams] = queryMock.mock.calls[1] as [string, unknown[]]
    expect(ledgerSql).toMatch(/INSERT INTO ledger/i)
    expect(ledgerParams[0]).toBe(CITIZEN_ID)
    expect(JSON.parse(String(ledgerParams[1]))).toEqual({
      reason: 'implausible_net_worth',
      claimed: 9_000_000,
      capped: 800_000,
    })
  })

  test('never throws — a Postgres failure is logged, Blob stays authoritative', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused'))

    await expect(dualWriteScore(score())).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('dual-write'),
      expect.any(Error),
    )
  })
})

describe('citizenAgeDaysPg', () => {
  test('returns null when POSTGRES_ENABLED is off, without touching the db', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '')
    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBeNull()
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('computes whole-and-fractional days from citizens.created_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z' }])

    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBe(5)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/SELECT created_at FROM citizens/i)
    expect(params).toEqual([CITIZEN_ID])
  })

  test('returns null for an unknown citizen — caller falls back to Blob or fail-closed', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([])
    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBeNull()
  })

  test('returns null and logs on a Postgres error — never throws into the handler', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryMock.mockRejectedValueOnce(new Error('connection refused'))

    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })
})
