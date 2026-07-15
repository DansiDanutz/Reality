import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import { claimOverpassSlot } from './_overpassPg'

const queryMock = vi.fn(async (): Promise<unknown[]> => [{ refusal: null }])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: queryMock }),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  queryMock.mockReset()
  queryMock.mockResolvedValue([{ refusal: null }])
  resetDbForTest()
})

describe('cross-instance Overpass admission', () => {
  test('keeps local previews independent of Postgres', async () => {
    await expect(claimOverpassSlot('203.0.113.4', {})).resolves.toBeNull()
    expect(queryMock).not.toHaveBeenCalled()
  })

  test('hashes the IP and passes the server limits to the atomic function', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://test')
    await expect(claimOverpassSlot('203.0.113.4')).resolves.toBeNull()
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('reality_claim_overpass_slot'), [
      '5aa23fc6904a74c72a2a2a9067fc55d7',
      120,
      2000,
    ])
  })

  test('returns the database refusal scope without exposing the address', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://test')
    queryMock.mockResolvedValueOnce([{ refusal: 'global' }])
    await expect(claimOverpassSlot('198.51.100.7')).resolves.toBe('global')
    expect(queryMock.mock.calls[0][1]?.[0]).not.toBe('198.51.100.7')
  })
})
