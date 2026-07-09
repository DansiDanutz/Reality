import { createHash } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import handler from './world'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'world-token'
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex').slice(0, 24)
const NOW = new Date('2026-07-07T12:34:56.000Z')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('world API placement writes', () => {
  test('stores a valid authenticated world placement and daily rate marker', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.451,
        lng: 26.082,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(put).toHaveBeenCalledWith(
      `world/${CITIZEN_ID}/starter-home-1__small_home__home__44.45__26.08.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
    expect(put).toHaveBeenCalledWith(
      `worldrate/${CITIZEN_ID}__2026-07-07__${NOW.getTime()}.json`,
      '1',
      { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
    )
  })

  test('rejects client-owned fields before citizen verification or writes', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.45,
        lng: 26.08,
        money: 999_999,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toEqual({
      ok: false,
      error: 'Client-controlled world fields are not allowed.',
      code: 'client_controlled_server_field',
    })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('rejects invalid coordinates before citizen verification or writes', async () => {
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 91,
        lng: 26.08,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'Invalid asset.' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  test('blocks placements once the daily citizen cap is reached', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList(Array.from({ length: 20 }, (_, index) =>
        `worldrate/${CITIZEN_ID}__2026-07-07__${index}.json`
      )))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        citizenId: CITIZEN_ID,
        token: TOKEN,
        assetId: 'starter-home-1',
        itemId: 'small_home',
        kind: 'home',
        lat: 44.45,
        lng: 26.08,
      },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      ok: false,
      error: "You've placed 20 things in the world today. Come back tomorrow.",
    })
    expect(put).not.toHaveBeenCalled()
  })
})

describe('world API Postgres dual-write (Phase 1b.3)', () => {
  const VALID_BODY = {
    citizenId: CITIZEN_ID,
    token: TOKEN,
    assetId: 'starter-home-1',
    itemId: 'small_home',
    kind: 'home',
    lat: 44.451,
    lng: 26.082,
  }

  function mockHappyBlobPath() {
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList([]))
  }

  test('leaves Postgres untouched when POSTGRES_ENABLED is off', async () => {
    mockHappyBlobPath()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('dual-writes the asset row and a world.place ledger entry when the flag is on', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    pgQueryMock.mockResolvedValueOnce([{ count: 0 }]) // cap check
    mockHappyBlobPath()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(pgQueryMock).toHaveBeenCalledTimes(3)
    const [upsertSql, upsertParams] = pgQueryMock.mock.calls[1] as [string, unknown[]]
    expect(upsertSql).toMatch(/INSERT INTO assets/i)
    // Structured columns mirror the blob pathname exactly (toFixed(2) coords)
    expect(upsertParams).toEqual([
      'starter-home-1',
      CITIZEN_ID,
      'small_home',
      'home',
      44.45,
      26.08,
      NOW.toISOString(),
    ])
    const [ledgerSql] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(ledgerSql).toMatch(/INSERT INTO ledger/i)
  })

  test('enforces the daily cap from Postgres when the flag is on', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    pgQueryMock.mockResolvedValueOnce([{ count: 20 }]) // pg already at cap
    vi.mocked(list)
      .mockResolvedValueOnce(blobList([`citizens/${CITIZEN_ID}__${TOKEN_HASH}__1.json`]))
      .mockResolvedValueOnce(blobList([])) // blob counter is behind
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      ok: false,
      error: "You've placed 20 things in the world today. Come back tomorrow.",
    })
    // No world/ or worldrate/ blob may be written once the cap says no
    expect(put).not.toHaveBeenCalled()
    expect(pgQueryMock).toHaveBeenCalledTimes(1)
  })

  test('placement still succeeds when the Postgres dual-write fails', async () => {
    vi.stubEnv('POSTGRES_ENABLED', '1')
    vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }]) // cap check ok
      .mockRejectedValueOnce(new Error('connection refused')) // upsert fails
    mockHappyBlobPath()
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...VALID_BODY } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(consoleError).toHaveBeenCalled()
  })
})

function blobList(pathnames: string[]): { blobs: { pathname: string }[]; hasMore: boolean } {
  return {
    blobs: pathnames.map((pathname) => ({ pathname })),
    hasMore: false,
  }
}

function responseRecorder(): {
  statusCode: number
  body: unknown
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    status(statusCode: number) {
      recorder.statusCode = statusCode
      return {
        json(body: unknown) {
          recorder.body = body
        },
      }
    },
  }
  return recorder
}
