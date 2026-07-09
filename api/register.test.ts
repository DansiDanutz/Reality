import { createHash, createHmac } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetDbForTest } from './_db'
import { FOUNDER_SLOTS } from './_registry'
import handler from './register'

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(async () => ({ url: 'blob://written' })),
}))

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const BOT_TOKEN = '123456:telegram-secret'
const NOW_SECONDS = 1_783_307_000
const REGISTER_IP = '203.0.113.42'
const REGISTER_IP_HASH = createHash('sha256').update(REGISTER_IP).digest('hex').slice(0, 16)
const REGISTER_DAY = new Date(NOW_SECONDS * 1000).toISOString().slice(0, 10)

function stubPg() {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
}

/** insert ok → founder slot claimed → post-claim update ok */
function mockHappyPg(founderNumber: number | null = 1) {
  pgQueryMock
    .mockResolvedValueOnce([]) // citizen insert
    .mockResolvedValueOnce([{ founder_number: founderNumber }]) // claim
    .mockResolvedValueOnce([]) // post-claim raw/telegram update
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.mocked(list).mockReset()
  vi.mocked(put).mockClear()
  vi.mocked(put).mockResolvedValue({ url: 'blob://written' } as never)
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('register API (Postgres-authoritative since Phase 1b.6)', () => {
  test('registers a citizen: Postgres row + founder slot, Blob compatibility mirror after', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    mockHappyPg(1)
    vi.mocked(list).mockResolvedValueOnce(blobList([])) // IP throttle scan
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, founderNumber: 1, slotsClaimed: 1, slotsTotal: FOUNDER_SLOTS })
    const body = res.body as { citizenId: string; token: string }

    // Postgres is authoritative: insert, claim, post-claim update
    expect(pgQueryMock).toHaveBeenCalledTimes(3)
    const [insertSql, insertParams] = pgQueryMock.mock.calls[0] as [string, unknown[]]
    expect(insertSql).toMatch(/INSERT INTO citizens/i)
    expect(insertParams[0]).toBe(body.citizenId)
    expect(insertParams[1]).toBe('David')
    const [claimSql] = pgQueryMock.mock.calls[1] as [string]
    expect(claimSql).toMatch(/UPDATE citizens SET founder_number/i)

    // The Blob mirror keeps legacy endpoints (reality-area, avatar,
    // cloud-save) authenticating until they migrate — no names/ or
    // founders/ blobs anymore, Postgres owns those claims
    const tokenHash = createHash('sha256').update(body.token).digest('hex').slice(0, 24)
    const paths = vi.mocked(put).mock.calls.map(([pathname]) => String(pathname))
    expect(paths).toContain(`citizens/${body.citizenId}__${tokenHash}__1.json`)
    expect(paths.some((p) => p.startsWith('names/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('founders/'))).toBe(false)
  })

  test('verifies Telegram initData and links the account in Postgres and the mirror', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    stubPg()
    mockHappyPg(1)
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const initData = signedInitData({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 42424242, first_name: 'David', last_name: 'Reality', username: 'davidreality' }),
    })
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David', telegramInitData: initData },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      founderNumber: 1,
      telegramUserId: '42424242',
      telegramAccountId: 'telegram:42424242',
      telegramName: 'David Reality',
    })
    // Post-claim update carries the full record and the bigint telegram id
    const [updateSql, updateParams] = pgQueryMock.mock.calls[2] as [string, unknown[]]
    expect(updateSql).toMatch(/UPDATE citizens SET raw/i)
    expect(updateParams[2]).toBe(42424242)
    expect(JSON.parse(String(updateParams[1]))).toMatchObject({ name: 'David', telegramUserId: '42424242' })
    // Telegram account mirror still written for the Telegram auth endpoints
    expect(vi.mocked(put).mock.calls.some(([p]) => p === 'telegram-users/42424242.json')).toBe(true)
  })

  test('rejects supplied Telegram initData when the signature is not valid', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: {
        name: 'David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David' }),
        }).replace('David', 'Attacker'),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ ok: false, error: 'Invalid Telegram session.', code: 'invalid_hash' })
    expect(list).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('returns 409 name_taken when another citizen holds the name slug', async () => {
    stubPg()
    pgQueryMock.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ ok: false, code: 'name_taken', error: 'That name already belongs to a citizen.' })
    // No citizen blob may be written when the identity claim failed
    expect(vi.mocked(put).mock.calls.some(([p]) => String(p).startsWith('citizens/'))).toBe(false)
  })

  test('fails the registration when Postgres is down — the registry is authoritative now', async () => {
    stubPg()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(500)
    expect(vi.mocked(put).mock.calls.some(([p]) => String(p).startsWith('citizens/'))).toBe(false)
    expect(consoleError).toHaveBeenCalled()
  })

  test('a Blob mirror failure never fails a registration that already committed', async () => {
    stubPg()
    mockHappyPg(1)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    vi.mocked(put)
      .mockResolvedValueOnce({ url: 'blob://regip' } as never) // throttle marker
      .mockRejectedValueOnce(new Error('blob unavailable')) // citizens/ mirror
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, founderNumber: 1 })
    expect(consoleError).toHaveBeenCalled()
  })

  test('registers without a founder slot once all slots are taken', async () => {
    stubPg()
    mockHappyPg(null)
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, founderNumber: null, slotsClaimed: FOUNDER_SLOTS })
    const paths = vi.mocked(put).mock.calls.map(([pathname]) => String(pathname))
    expect(paths.some((p) => p.startsWith('citizens/') && p.endsWith('__0.json'))).toBe(true)
  })

  test('returns structured storage failure when registration safety scan is unavailable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    vi.mocked(list).mockRejectedValueOnce(new Error('registration safety list unavailable'))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      ok: false,
      error: 'Registration safety check is temporarily unavailable. Try again in a minute.',
      code: 'registration_safety_unavailable',
    })
    expect(list).toHaveBeenCalledWith({ prefix: `regip/${REGISTER_IP_HASH}__${REGISTER_DAY}`, limit: 6 })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('throttles registrations from one connection', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    vi.mocked(list).mockResolvedValueOnce(blobList(Array.from({ length: 5 }, (_, index) =>
      `regip/${REGISTER_IP_HASH}__${REGISTER_DAY}__${index}.json`
    )))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(pgQueryMock).not.toHaveBeenCalled()
  })
})

function signedInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

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
