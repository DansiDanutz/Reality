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
  GRANT_WORTH_TOLERANCE,
  SCORE_UPSERT_SQL,
  citizenAgeDaysPg,
  citizenScoreProfilePg,
  maxPlausibleWorth,
  maxReconciledWorth,
  CITIZEN_GRANT,
  CLIENT_FAUCET_BASE,
  CLIENT_FAUCET_PER_DAY,
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
  const DAY = 86_400_000
  const NOW = Date.UTC(2026, 10, 10)

  test('a day-0 founder cannot post more than the grant plus the small allowances', () => {
    // The grant is not labor: it gets the 10% till allowance, never the shift multiplier.
    expect(maxReconciledWorth({ ledgerCredits: FOUNDER_GRANT, founder: true, ageDays: 0 }, NOW))
      .toBe(Math.round(FOUNDER_GRANT * GRANT_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE)
  })

  test('only shift credits get the gear-and-education multiplier', () => {
    const cap = maxReconciledWorth({ ledgerCredits: 2_500 + 960, shiftCredits: 960, founder: false, ageDays: 0 }, NOW)
    expect(cap).toBe(Math.round(2_500 * GRANT_WORTH_TOLERANCE + 960 * LEDGER_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE)
  })

  test('shift credits can never exceed the credits they are part of', () => {
    expect(maxReconciledWorth({ ledgerCredits: 1_000, shiftCredits: 9_999_999, ageDays: 0 }, NOW))
      .toBe(Math.round(1_000 * LEDGER_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE)
  })

  test('server-recorded businesses raise the ceiling by what they could have earned', () => {
    const base = maxReconciledWorth({ ledgerCredits: FOUNDER_GRANT, ageDays: 2 }, NOW)
    const withCart = maxReconciledWorth({ ledgerCredits: FOUNDER_GRANT, ageDays: 2, businesses: [{ itemId: 'foodcart', placedAt: NOW - 2 * DAY }] }, NOW)
    // Food Cart $200/day × top level 10 × 2 days
    expect(withCart - base).toBe(4_000)
  })

  test('the client-only faucet allowance grows with real age', () => {
    const day0 = maxReconciledWorth({ ledgerCredits: 2_500, ageDays: 0 }, NOW)
    const day10 = maxReconciledWorth({ ledgerCredits: 2_500, ageDays: 10.9 }, NOW)
    expect(day10 - day0).toBe(10 * CLIENT_FAUCET_PER_DAY)
  })

  test('fails closed to the founder grant when the ledger has no accepted rows', () => {
    const grantBound = Math.round(FOUNDER_GRANT * GRANT_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE
    expect(maxReconciledWorth({ ledgerCredits: null }, NOW)).toBe(grantBound)
    expect(maxReconciledWorth({ ledgerCredits: Number.NaN }, NOW)).toBe(grantBound)
    // A silent ledger has no shifts to multiply, whatever the row claims.
    expect(maxReconciledWorth({ ledgerCredits: null, shiftCredits: 50_000 }, NOW)).toBe(grantBound)
  })

  test('a known non-founder with a silent ledger is bounded by the citizen grant, not the founder grant', () => {
    expect(maxReconciledWorth({ ledgerCredits: null, founder: false }, NOW)).toBe(Math.round(CITIZEN_GRANT * GRANT_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE)
    expect(maxReconciledWorth({ ledgerCredits: null, founder: true }, NOW)).toBe(Math.round(FOUNDER_GRANT * GRANT_WORTH_TOLERANCE) + CLIENT_FAUCET_BASE)
  })

  test('an unknown age earns no daily allowance, and corrupt sums never go negative', () => {
    expect(maxReconciledWorth({ ledgerCredits: -500, ageDays: null }, NOW)).toBe(CLIENT_FAUCET_BASE)
    expect(maxReconciledWorth({ ledgerCredits: 0, ageDays: Number.NaN }, NOW)).toBe(CLIENT_FAUCET_BASE)
  })
})

describe('citizenScoreProfilePg', () => {
  test('reads name, age, and accepted ledger credits in one round trip', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    queryMock.mockResolvedValueOnce([
      { name: 'water-maker', created_at: '2026-07-05T12:00:00.000Z', credited: '12500.00', shift_credited: '960.00', businesses: [{ itemId: 'foodcart', placedAt: '2026-07-06T12:00:00.000Z' }, { itemId: 3 }], founder: false },
    ])

    const profile = await citizenScoreProfilePg(CITIZEN_ID)

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [statement, params] = queryMock.mock.calls[0] as [string, unknown[]]
    expect(statement).toBe(CITIZEN_PROFILE_SQL)
    expect(statement).toMatch(/SUM\(amount\) FILTER \(WHERE amount > 0\)/i)
    expect(statement).toMatch(/balance_after IS NOT NULL/i)
    expect(params).toEqual([CITIZEN_ID])
    expect(statement).toMatch(/intent = 'intent\.workShift'/)
    expect(statement).toMatch(/FROM assets a WHERE a\.citizen_id = \$1 AND a\.kind = 'business'/)
    expect(profile).toEqual({
      ageDays: 5,
      name: 'water-maker',
      ledgerCredits: 12_500,
      founder: false,
      shiftCredits: 960,
      businesses: [{ itemId: 'foodcart', placedAt: Date.parse('2026-07-06T12:00:00.000Z') }],
    })
  })

  test('reports null ledger credits for a citizen with no accepted ledger rows', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    queryMock.mockResolvedValueOnce([
      { name: 'water-maker', created_at: '2026-07-05T12:00:00.000Z', credited: null },
    ])

    const profile = await citizenScoreProfilePg(CITIZEN_ID)

    expect(profile.ledgerCredits).toBeNull()
    expect(profile.shiftCredits).toBe(0)
    expect(profile.businesses).toEqual([])
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
