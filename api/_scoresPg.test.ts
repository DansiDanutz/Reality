import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import { SCORE_UPSERT_SQL, citizenAgeDaysPg, maxPlausibleWorth, writeScore } from './_scoresPg'

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const REPORTED_AT = new Date('2026-07-10T12:00:00.000Z')

function score(overrides: Partial<Parameters<typeof writeScore>[0]> = {}) {
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
    expect(maxPlausibleWorth(0)).toBe(300_000)
    expect(maxPlausibleWorth(5)).toBe(800_000)
  })

  test('rounds partial days up — the cap only ever raises with age', () => {
    expect(maxPlausibleWorth(2.3)).toBe(200_000 + Math.ceil(3.3) * 100_000)
  })
})

describe('writeScore (authoritative since Phase 1b.6)', () => {
  test('upserts the score and audits the cap in ONE atomic statement', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await writeScore(score())

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toBe(SCORE_UPSERT_SQL)
    expect(statement).toMatch(/ON CONFLICT \(citizen_id\) DO UPDATE/i)
    expect(statement).toMatch(/INSERT INTO ledger/i)
    expect(statement).toMatch(/WHERE \$3::numeric > \$4::numeric/i)
    expect(params).toEqual([
      CITIZEN_ID,
      'water-maker',
      750_000,
      750_000,
      REPORTED_AT.toISOString(),
      JSON.stringify({ reason: 'implausible_net_worth', claimed: 750_000, capped: 750_000 }),
    ])
  })

  test('carries the capped-claim audit meta when the cap bit — still a single call', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')

    await writeScore(score({ netWorth: 9_000_000, cappedWorth: 800_000 }))

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(JSON.parse(String(params[5]))).toEqual({
      reason: 'implausible_net_worth',
      claimed: 9_000_000,
      capped: 800_000,
    })
  })

  test('throws on failure — the handler owns the 500, there is no Blob to fall back to', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(writeScore(score())).rejects.toThrow('connection refused')
  })
})

describe('citizenAgeDaysPg', () => {
  test('computes whole-and-fractional days from citizens.created_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z' }])

    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBe(5)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toMatch(/SELECT name, created_at FROM citizens/i)
    expect(params).toEqual([CITIZEN_ID])
  })

  test('returns null for an unknown citizen — the caller fails closed to the day-0 cap', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([])
    expect(await citizenAgeDaysPg(CITIZEN_ID)).toBeNull()
  })

  test('propagates database errors — there is no Blob fallback anymore', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockRejectedValueOnce(new Error('connection refused'))
    await expect(citizenAgeDaysPg(CITIZEN_ID)).rejects.toThrow('connection refused')
  })
})
