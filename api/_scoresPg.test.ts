import { afterEach, describe, expect, test, vi } from 'vitest'

const queryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

import { resetDbForTest } from './_db'
import {
  CITIZEN_PROFILE_SQL,
  FOUNDER_GRANT,
  LEDGER_WORTH_TOLERANCE,
  SCORE_UPSERT_SQL,
  citizenAgeDaysPg,
  citizenScoreProfilePg,
  maxPlausibleWorth,
  maxReconciledWorth,
  writeScore,
} from './_scoresPg'

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

describe('maxReconciledWorth', () => {
  test('bounds a claim by the accepted ledger credits plus the pending-income tolerance', () => {
    expect(maxReconciledWorth(2_500)).toBe(2_750)
    expect(maxReconciledWorth(1_000_000)).toBe(1_100_000)
  })

  test('fails closed to the founder grant when the ledger has no accepted rows', () => {
    expect(maxReconciledWorth(null)).toBe(Math.round(FOUNDER_GRANT * LEDGER_WORTH_TOLERANCE))
    expect(maxReconciledWorth(Number.NaN)).toBe(Math.round(FOUNDER_GRANT * LEDGER_WORTH_TOLERANCE))
  })

  test('never goes negative on a corrupt credit sum', () => {
    expect(maxReconciledWorth(-500)).toBe(0)
  })
})

describe('citizenScoreProfilePg', () => {
  test('reads name, age, and accepted ledger credits in one round trip', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    queryMock.mockResolvedValueOnce([
      { name: 'water-maker', created_at: '2026-07-05T12:00:00.000Z', credited: '12500.00' },
    ])

    const profile = await citizenScoreProfilePg(CITIZEN_ID)

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toBe(CITIZEN_PROFILE_SQL)
    expect(statement).toMatch(/SUM\(amount\) FILTER \(WHERE amount > 0\)/i)
    expect(statement).toMatch(/balance_after IS NOT NULL/i)
    expect(params).toEqual([CITIZEN_ID])
    expect(profile).toEqual({ ageDays: 5, name: 'water-maker', ledgerCredits: 12_500 })
  })

  test('reports null ledger credits for a citizen with no accepted ledger rows', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([
      { name: 'water-maker', created_at: '2026-07-05T12:00:00.000Z', credited: null },
    ])

    const profile = await citizenScoreProfilePg(CITIZEN_ID)

    expect(profile.ledgerCredits).toBeNull()
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
    expect(statement).toBe(CITIZEN_PROFILE_SQL)
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
