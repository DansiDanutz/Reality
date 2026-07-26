import { createHash } from 'node:crypto'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SHIFT_HOURS, XP_PER_SHIFT, applyXp } from '../src/game/engine.js'
import { resetDbForTest } from './_db'
import handler, { evaluateIntent, normalizeIntent } from './intent'

const pgQueryMock = vi.fn(async (): Promise<unknown[]> => [])

vi.mock('@neondatabase/serverless', () => ({
  neon: () => ({ query: pgQueryMock }),
}))

const CITIZEN_ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'intent-token'

function pgOn() {
  vi.stubEnv('POSTGRES_URL', 'postgres://reality-test')
}

// Citizen auth is a citizens-table lookup since the Phase 1b.6 cutover
function mockVerifyOk() {
  pgQueryMock.mockResolvedValueOnce([{ ok: 1 }])
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  pgQueryMock.mockReset()
  pgQueryMock.mockResolvedValue([])
  resetDbForTest()
})

describe('normalizeIntent', () => {
  test('accepts the three core intents with exact field allow-lists', () => {
    expect(normalizeIntent({ type: 'workShift', jobId: 'barista' }))
      .toEqual({ ok: true, intent: { type: 'workShift', jobId: 'barista' } })
    expect(normalizeIntent({ type: 'buyItem', itemId: 'noodles', quantity: 3 }))
      .toEqual({ ok: true, intent: { type: 'buyItem', itemId: 'noodles', quantity: 3 } })
    expect(normalizeIntent({ type: 'placeAsset', itemId: 'microstudio' }))
      .toEqual({ ok: true, intent: { type: 'placeAsset', itemId: 'microstudio' } })
  })

  test('buyItem quantity defaults to 1 and must be an integer between 1 and 10', () => {
    expect(normalizeIntent({ type: 'buyItem', itemId: 'noodles' }))
      .toEqual({ ok: true, intent: { type: 'buyItem', itemId: 'noodles', quantity: 1 } })
    for (const quantity of [0, 11, 2.5, 'many']) {
      expect(normalizeIntent({ type: 'buyItem', itemId: 'noodles', quantity })).toMatchObject({
        ok: false,
        code: 'invalid_quantity',
      })
    }
  })

  test('rejects unknown intent types', () => {
    expect(normalizeIntent({ type: 'printMoney' })).toMatchObject({ ok: false, code: 'unsupported_intent' })
    expect(normalizeIntent(null)).toMatchObject({ ok: false, code: 'unsupported_intent' })
  })

  test('rejects client attempts to smuggle server-controlled fields', () => {
    for (const extra of [{ wage: 9999 }, { amount: 9999 }, { balance: 9999 }, { anything: 1 }]) {
      expect(normalizeIntent({ type: 'workShift', jobId: 'barista', ...extra })).toMatchObject({
        ok: false,
        code: 'client_controlled_server_field',
      })
    }
  })
})

describe('evaluateIntent — engine rules, no duplication', () => {
  test('workShift pays the canonical catalog wage for a full engine shift', () => {
    const result = evaluateIntent({ type: 'workShift', jobId: 'barista' }, 1)
    expect(result).toEqual({
      ok: true,
      amount: 15 * SHIFT_HOURS,
      meta: { jobId: 'barista', wage: 15, hours: SHIFT_HOURS, xp: XP_PER_SHIFT },
    })
  })

  test('workShift enforces the job level requirement server-side', () => {
    expect(evaluateIntent({ type: 'workShift', jobId: 'pilot' }, 1)).toMatchObject({
      ok: false,
      code: 'level_too_low',
    })
    expect(evaluateIntent({ type: 'workShift', jobId: 'pilot' }, 4)).toMatchObject({ ok: true })
  })

  test('buyItem charges the canonical catalog price times quantity', () => {
    expect(evaluateIntent({ type: 'buyItem', itemId: 'noodles', quantity: 3 }, 1)).toEqual({
      ok: true,
      amount: -6,
      meta: { itemId: 'noodles', quantity: 3, unitPrice: 2 },
    })
  })

  test('placeAsset charges the catalog price and requires a placeable item', () => {
    expect(evaluateIntent({ type: 'placeAsset', itemId: 'microstudio' }, 1)).toEqual({
      ok: true,
      amount: -45_000,
      meta: { itemId: 'microstudio', price: 45_000 },
    })
    expect(evaluateIntent({ type: 'placeAsset', itemId: 'noodles' }, 1)).toMatchObject({
      ok: false,
      code: 'not_placeable',
    })
  })

  test('rejects unknown jobs and items', () => {
    expect(evaluateIntent({ type: 'workShift', jobId: 'astronaut' }, 1)).toMatchObject({ ok: false, code: 'unknown_job' })
    expect(evaluateIntent({ type: 'buyItem', itemId: 'unobtainium', quantity: 1 }, 1)).toMatchObject({ ok: false, code: 'unknown_item' })
  })
})

describe('intent API handler', () => {
  const BODY = { citizenId: CITIZEN_ID, token: TOKEN, intent: { type: 'workShift', jobId: 'barista' } }

  test('rejects non-POST methods', async () => {
    const res = responseRecorder()
    await handler({ method: 'GET' } as never, res as never)
    expect(res.statusCode).toBe(405)
  })

  test('fails loudly (500) when no database is configured — Postgres IS the economy now', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = responseRecorder()
    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)
    expect(res.statusCode).toBe(500)
    expect(pgQueryMock).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
  })

  test('rejects an invalid intent before any storage call', async () => {
    pgOn()
    const res = responseRecorder()
    await handler({ method: 'POST', body: { ...BODY, intent: { type: 'workShift', jobId: 'barista', wage: 9999 } } } as never, res as never)
    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({ ok: false, code: 'client_controlled_server_field' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('rejects unverified citizens', async () => {
    pgOn()
    pgQueryMock.mockResolvedValueOnce([]) // token hash not found
    const res = responseRecorder()
    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)
    expect(res.statusCode).toBe(401)
    expect(pgQueryMock).toHaveBeenCalledTimes(1)
  })

  test('requires CSRF proof when authenticating an intent from the session cookie', async () => {
    pgOn()
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: { cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1` },
      body: { intent: BODY.intent },
    } as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, code: 'csrf_required' })
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('accepts a CSRF-protected cookie session without a body bearer token', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '420.00', refusal: null }])
    const res = responseRecorder()
    await handler({
      method: 'POST',
      headers: {
        cookie: `reality_session=${CITIZEN_ID}.cookie-token; reality_csrf=csrf-1`,
        'x-reality-csrf': 'csrf-1',
      },
      body: { intent: BODY.intent },
    } as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, intent: 'workShift', balance: 420 })
    expect((pgQueryMock.mock.calls[0][1] as unknown[])[1]).toBe(createHash('sha256').update('cookie-token').digest('hex').slice(0, 24))
  })

  test('applies a validated workShift: ledger row appended atomically, balance returned', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }]) // hourly rate guard
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }]) // citizen context
      .mockResolvedValueOnce([{ new_balance: '420.00', refusal: null }]) // serialized append
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, predictedBalance: 420 } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      intent: 'workShift',
      amount: 15 * SHIFT_HOURS,
      xp: XP_PER_SHIFT,
      level: 1,
      balance: 420,
    })
    const [insertSql, insertParams] = pgQueryMock.mock.calls[3] as [string, unknown[]]
    // The append goes through the serialized plpgsql function: advisory lock
    // + fresh-snapshot read + cooldown + overdraft gate, atomically.
    expect(insertSql).toMatch(/reality_append_intent/)
    expect(insertParams[0]).toBe(CITIZEN_ID)
    expect(insertParams[1]).toBe('intent.workShift')
    expect(insertParams[2]).toBe(15 * SHIFT_HOURS)
    expect(JSON.parse(String(insertParams[4]))).toMatchObject({ jobId: 'barista', wage: 15 })
    expect(insertParams[5]).toBe(`${SHIFT_HOURS} hours`) // a shift can be worked at most once per real shift
  })

  test('returns a correction frame when the client prediction diverges', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '420.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, predictedBalance: 9_000 } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      balance: 420,
      correction: { balance: 420, predicted: 9_000, drift: -8_580 },
    })
  })

  test('passes no client-controlled seed to the server-owned genesis function', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: null, xp: 0 }]) // unknown age → day-0 cap
      .mockResolvedValueOnce([{ new_balance: '120.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, predictedBalance: 9_000_000 } } as never, res as never)

    const [insertSql, insertParams] = pgQueryMock.mock.calls[3] as [string, unknown[]]
    expect(insertParams[3]).toBe(0) // the SQL function ignores this compatibility slot and owns genesis
    expect(insertSql).toMatch(/reality_append_intent/)
  })

  test('rejects with the server balance as a correction when funds are insufficient', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '10.00', refusal: 'insufficient_funds' }]) // refused, current balance returned
    const res = responseRecorder()

    await handler({
      method: 'POST',
      body: { ...BODY, intent: { type: 'placeAsset', itemId: 'microstudio' } },
    } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({
      ok: false,
      code: 'insufficient_funds',
      correction: { balance: 10 },
    })
    expect(pgQueryMock).toHaveBeenCalledTimes(4) // refusal carries the balance — no follow-up read
  })

  test('refuses a second shift inside the engine shift window', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: null, refusal: 'cooldown' }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({ ok: false, code: 'shift_too_soon' })
  })

  test('returns the atomic database rate refusal as a 429', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 119 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '120.00', refusal: 'rate_limited' }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({ ok: false, code: 'intent_rate_limited' })
  })

  test('buyItem has no cooldown — the interval param is null', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '494.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, intent: { type: 'buyItem', itemId: 'noodles' } } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const [, params] = pgQueryMock.mock.calls[3] as [string, unknown[]]
    expect(params[5]).toBeNull()
  })

  test('passes a caller idempotency key through the atomic append boundary', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 120 }]) // bypassed for supplied retry key
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
      .mockResolvedValueOnce([{ new_balance: '420.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, idempotencyKey: 'shift-2026-07-16-1' } } as never, res as never)

    expect(res.statusCode).toBe(200)
    const [, params] = pgQueryMock.mock.calls[3] as [string, unknown[]]
    expect(params[6]).toBe('shift-2026-07-16-1')
  })

  test('rejects unsafe idempotency keys before any database call', async () => {
    pgOn()
    mockVerifyOk()
    const res = responseRecorder()
    await handler({ method: 'POST', body: { ...BODY, idempotencyKey: 'bad key with spaces' } } as never, res as never)
    expect(res.statusCode).toBe(422)
    expect(pgQueryMock).not.toHaveBeenCalled()
  })

  test('logs the error context when Postgres fails instead of swallowing it', async () => {
    pgOn()
    mockVerifyOk()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    pgQueryMock.mockRejectedValueOnce(new Error('connection refused'))
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(500)
    expect(consoleError).toHaveBeenCalledWith(
      'intent: append failed',
      { citizenId: CITIZEN_ID, intent: 'workShift', errorType: 'Error' },
    )
  })

  test('throttles a citizen flooding intents', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock.mockResolvedValueOnce([{ count: 120 }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY } } as never, res as never)

    expect(res.statusCode).toBe(429)
    expect(pgQueryMock).toHaveBeenCalledTimes(2) // verify + rate count only
  })

  test('level gate: a level-1 citizen cannot fly the plane', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 0 }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, intent: { type: 'workShift', jobId: 'pilot' } } } as never, res as never)

    expect(res.statusCode).toBe(422)
    expect(res.body).toMatchObject({ ok: false, code: 'level_too_low' })
    expect(pgQueryMock).toHaveBeenCalledTimes(3) // no ledger append
    // The level comes from summed ledger XP — the engine's own rule, and
    // the clauses below are what make it exploit-resistant: refusal rows
    // never count, and a non-numeric meta.xp can never poison the cast.
    const [contextSql] = pgQueryMock.mock.calls[2] as [string]
    expect(contextSql).toMatch(/FROM ledger/i)
    expect(contextSql).toMatch(/balance_after IS NOT NULL/i)
    expect(contextSql).toMatch(/jsonb_typeof\(l\.meta->'xp'\) = 'number'/i)
  })

  test('handles the Neon driver returning SUM() as a string', async () => {
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: '600' }]) // bigint SUM → string
      .mockResolvedValueOnce([{ new_balance: '1000.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, intent: { type: 'workShift', jobId: 'pilot' } } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, level: 4 })
  })

  test('falls back to level 1 on a missing or garbage xp value', async () => {
    for (const xp of [undefined, 'not-a-number']) {
      pgOn()
      mockVerifyOk()
      pgQueryMock
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp }])
      const res = responseRecorder()

      await handler({ method: 'POST', body: { ...BODY, intent: { type: 'workShift', jobId: 'pilot' } } } as never, res as never)

      expect(res.statusCode).toBe(422)
      expect(res.body).toMatchObject({ ok: false, code: 'level_too_low' })
      pgQueryMock.mockReset()
      pgQueryMock.mockResolvedValue([])
    }
  })

  test('level gate opens with earned ledger XP — 600 xp is level 4, pilot cleared', async () => {
    expect(applyXp(1, 0, 600).level).toBe(4) // the engine cascade this test leans on
    pgOn()
    mockVerifyOk()
    pgQueryMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ created_at: '2026-07-05T12:00:00.000Z', xp: 600 }])
      .mockResolvedValueOnce([{ new_balance: '1000.00', refusal: null }])
    const res = responseRecorder()

    await handler({ method: 'POST', body: { ...BODY, intent: { type: 'workShift', jobId: 'pilot' } } } as never, res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, intent: 'workShift', amount: 60 * SHIFT_HOURS, level: 4 })
  })
})

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
