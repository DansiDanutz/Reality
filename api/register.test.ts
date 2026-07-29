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
    .mockResolvedValueOnce([{ allowed: true }]) // atomic IP/day reservation
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
    const body = res.body as { citizenId: string; token?: string }
    const cookies = res.headers['Set-Cookie'] as unknown as string[]
    expect(cookies.join('\n')).toContain('reality_session=')
    expect(cookies.join('\n')).toContain('HttpOnly')
    expect(cookies.join('\n')).toContain('SameSite=Lax')

    // Postgres is authoritative: insert, claim, post-claim update
    expect(pgQueryMock).toHaveBeenCalledTimes(4)
    const [reservationSql, reservationParams] = pgQueryMock.mock.calls[0] as [string, unknown[]]
    expect(reservationSql).toMatch(/reality_claim_registration_slot/i)
    expect(reservationParams).toEqual([REGISTER_IP_HASH, REGISTER_DAY, 5])
    const [insertSql, insertParams] = pgQueryMock.mock.calls[1] as [string, unknown[]]
    expect(insertSql).toMatch(/INSERT INTO citizens/i)
    expect(insertParams[0]).toBe(body.citizenId)
    expect(insertParams[1]).toBe('David')
    expect(insertParams[4]).toBeNull()
    const [claimSql] = pgQueryMock.mock.calls[2] as [string]
    expect(claimSql).toMatch(/UPDATE citizens SET founder_number/i)
    const [updateSql] = pgQueryMock.mock.calls[3] as [string]

    // Registration also ensures the server-owned genesis ledger row in the
    // same post-claim statement; repeated execution is idempotent.
    expect(updateSql).toMatch(/INSERT INTO ledger/i)
    expect(updateSql).toMatch(/NOT EXISTS.*ledger/i)

    // Postgres owns the whole registry now — the only Blob write left is
    // the regip/ throttle marker (and telegram-users/ for linked accounts)
    expect(body.token).toBeUndefined()
    const paths = vi.mocked(put).mock.calls.map(([pathname]) => String(pathname))
    expect(paths.some((p) => p.startsWith('citizens/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('names/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('founders/'))).toBe(false)
  })

  test('keys the registration brake on the trusted/rightmost forwarding hop', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    mockHappyPg(1)
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: {
        'x-vercel-forwarded-for': `spoofed-prefix, ${REGISTER_IP}`,
        'x-forwarded-for': 'attacker-controlled-ip',
      },
      body: { name: 'David' },
    } as never, res as never)

    expect(pgQueryMock.mock.calls[0]?.[1]?.[0]).toBe(REGISTER_IP_HASH)
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
    const [updateSql, updateParams] = pgQueryMock.mock.calls[3] as [string, unknown[]]
    expect(updateSql).toMatch(/UPDATE citizens SET raw/i)
    expect(updateParams[2]).toBe(42424242)
    const [, linkedInsertParams] = pgQueryMock.mock.calls[1] as [string, unknown[]]
    expect(linkedInsertParams[4]).toBe(42424242)
    expect(JSON.parse(String(updateParams[1]))).toMatchObject({ name: 'David', telegramUserId: '42424242' })
    // Telegram account mirror still written for the Telegram auth endpoints
    expect(vi.mocked(put).mock.calls.some(([p]) => p === 'telegram-users/42424242.json')).toBe(true)
  })

  test('rejects bot Telegram initData before reserving registration capacity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    const initData = signedInitData({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 42424242, first_name: 'Reality Bot', is_bot: true }),
    })
    const res = responseRecorder()
    await handler({ method: 'POST', headers: { 'x-forwarded-for': REGISTER_IP }, body: { name: 'Bot', telegramInitData: initData } } as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, code: 'bot_user' })
    expect(pgQueryMock).not.toHaveBeenCalled()
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
    pgQueryMock.mockResolvedValueOnce([{ allowed: true }])
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

  test('returns 409 telegram_already_linked before claiming a founder slot', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    stubPg()
    pgQueryMock.mockResolvedValueOnce([{ allowed: true }])
    pgQueryMock.mockRejectedValueOnce(Object.assign(new Error('duplicate telegram key'), { code: '23505' }))
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: {
        name: 'Another David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David' }),
        }),
      },
    } as never, res as never)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({
      ok: false,
      code: 'telegram_already_linked',
      error: 'That Telegram account is already linked to a citizen.',
    })
    expect(pgQueryMock).toHaveBeenCalledTimes(2)
  })

  test('fails the registration when Postgres is down — the registry is authoritative now', async () => {
    stubPg()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(503)
    expect(vi.mocked(put).mock.calls.some(([p]) => String(p).startsWith('citizens/'))).toBe(false)
  })

  test('a Telegram mirror failure never fails a registration that already committed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    vi.stubEnv('TELEGRAM_BOT_TOKEN', BOT_TOKEN)
    stubPg()
    mockHappyPg(1)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(list).mockResolvedValueOnce(blobList([]))
    vi.mocked(put)
      .mockRejectedValueOnce(new Error('blob unavailable')) // telegram-users/ mirror
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: {
        name: 'David',
        telegramInitData: signedInitData({
          auth_date: String(NOW_SECONDS),
          user: JSON.stringify({ id: 42424242, first_name: 'David' }),
        }),
      },
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
  })

  test('rejects names with no letters or digits — they would reduce to an empty identity slug', async () => {
    stubPg()
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: '!!!???' },
    } as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ ok: false, error: 'Name must include at least one letter or number.' })
    expect(list).not.toHaveBeenCalled()
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('returns structured storage failure when registration safety scan is unavailable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    pgQueryMock.mockRejectedValueOnce(new Error('registration safety reservation unavailable'))
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
    expect(pgQueryMock).toHaveBeenCalledTimes(1)
  })

  test('throttles registrations from one connection', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_SECONDS * 1000))
    stubPg()
    pgQueryMock.mockResolvedValueOnce([{ allowed: false }])
    const res = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': REGISTER_IP },
      body: { name: 'David' },
    } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(pgQueryMock).toHaveBeenCalledTimes(1)
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
  headers: Record<string, string>
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => { json: (body: unknown) => void }
} {
  const recorder = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      recorder.headers[name] = value
    },
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
