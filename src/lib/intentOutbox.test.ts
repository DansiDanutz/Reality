import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  backoffMs,
  classifyIntentResponse,
  clearOutbox,
  enqueueIntent,
  flushOutbox,
  OUTBOX_BACKOFF_MAX_MS,
  OUTBOX_MAX_AGE_MS,
  outboxEntries,
  sendIntent,
  shiftIntentKey,
  type OutboxEntry,
} from './intentOutbox'

const NOW = 1_800_000_000_000
const OWNER = 1_700_000_000_000
const entry = (n: number, over: Partial<Omit<OutboxEntry, 'attempts' | 'nextAttemptAt'>> = {}) => ({
  key: `shift-${OWNER}-${n}`,
  owner: OWNER,
  intent: { type: 'workShift' as const, jobId: 'barista' },
  createdAt: NOW - n,
  ...over,
})

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
})

describe('classifyIntentResponse', () => {
  test('maps server answers to what the outbox does next', () => {
    expect(classifyIntentResponse(200, { ok: true })).toBe('sent')
    expect(classifyIntentResponse(429, { code: 'shift_too_soon' })).toBe('retry')
    expect(classifyIntentResponse(429, { code: 'intent_rate_limited' })).toBe('retry')
    expect(classifyIntentResponse(401, {})).toBe('retry-later')
    expect(classifyIntentResponse(403, {})).toBe('retry-later')
    expect(classifyIntentResponse(422, { code: 'level_too_low' })).toBe('drop')
    expect(classifyIntentResponse(400, {})).toBe('drop')
    expect(classifyIntentResponse(500, null)).toBe('retry')
  })
})

describe('outbox queue', () => {
  test('the same shift is queued once, and survives a reload (localStorage)', () => {
    enqueueIntent(entry(1))
    enqueueIntent(entry(1))
    expect(outboxEntries()).toHaveLength(1)
  })

  test('shiftIntentKey is stable per shift, independent of registration, and accepted by the server key format', () => {
    expect(shiftIntentKey(OWNER, 123456)).toBe(shiftIntentKey(OWNER, 123456))
    expect(shiftIntentKey(OWNER, 123456)).not.toBe(shiftIntentKey(OWNER, 123457))
    expect(shiftIntentKey(OWNER, 1)).toMatch(/^[A-Za-z0-9_.:-]{1,128}$/)
  })

  test('delivers oldest-first and removes what was sent', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const order: string[] = []
    const n = await flushOutbox(async (e) => (order.push(e.key), 'sent'), OWNER, NOW)
    expect(n).toBe(2)
    expect(order).toEqual([`shift-${OWNER}-2`, `shift-${OWNER}-1`])
    expect(outboxEntries()).toEqual([])
  })

  test("never sends another citizen's report, and never when nobody is signed in", async () => {
    enqueueIntent(entry(1, { owner: 999 }))
    const send = vi.fn(async () => 'sent' as const)
    expect(await flushOutbox(send, OWNER, NOW)).toBe(0)
    expect(await flushOutbox(send, null, NOW)).toBe(0)
    expect(send).not.toHaveBeenCalled()
    expect(outboxEntries()).toHaveLength(1)
    // …but the owner's own entries still go while a stranger's wait.
    enqueueIntent(entry(2))
    expect(await flushOutbox(send, OWNER, NOW)).toBe(1)
    expect(outboxEntries().map((e) => e.owner)).toEqual([999])
  })

  test('a report queued while a send is in flight is not overwritten when the send completes', async () => {
    enqueueIntent(entry(2))
    let release: (v: 'sent') => void = () => {}
    const slow = flushOutbox(() => new Promise<'sent'>((r) => { release = r }), OWNER, NOW)
    await Promise.resolve()
    enqueueIntent(entry(1)) // a shift finishes while the first report is on the wire
    release('sent')
    expect(await slow).toBe(1)
    expect(outboxEntries().map((e) => e.key)).toEqual([`shift-${OWNER}-1`])
  })

  test('a cooldown backs the entry off and stops the flush; every queued shift is kept', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const send = vi.fn(async () => 'retry' as const)
    expect(await flushOutbox(send, OWNER, NOW)).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
    const kept = outboxEntries()
    expect(kept).toHaveLength(2)
    expect(kept[0].nextAttemptAt).toBe(NOW + backoffMs(1))
    // Not due yet: nothing is sent until the backoff passes…
    send.mockClear()
    await flushOutbox(send, OWNER, NOW + 1_000)
    expect(send).not.toHaveBeenCalled()
    // …then it is tried again, with no cap on attempts.
    await flushOutbox(send, OWNER, NOW + backoffMs(1) + 1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('a long outage never deletes a report: only age does', async () => {
    enqueueIntent(entry(1))
    let now = NOW
    for (let i = 0; i < 200; i++) {
      await flushOutbox(async () => 'retry', OWNER, now)
      now += OUTBOX_BACKOFF_MAX_MS
      if (now - (NOW - 1) > OUTBOX_MAX_AGE_MS - OUTBOX_BACKOFF_MAX_MS) break
    }
    expect(outboxEntries()).toHaveLength(1)
    expect(backoffMs(500)).toBe(OUTBOX_BACKOFF_MAX_MS)
  })

  test('a terminal rejection drops only that entry and the rest continue', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const outcomes = ['drop', 'sent'] as const
    let i = 0
    const n = await flushOutbox(async () => outcomes[i++], OWNER, NOW)
    expect(n).toBe(1)
    expect(outboxEntries()).toEqual([])
  })

  test('a thrown send is treated as a retry', async () => {
    enqueueIntent(entry(1))
    await flushOutbox(async () => { throw new Error('offline') }, OWNER, NOW)
    expect(outboxEntries()[0].attempts).toBe(1)
  })

  test('entries older than the max age are discarded unsent', async () => {
    enqueueIntent(entry(1, { createdAt: NOW - OUTBOX_MAX_AGE_MS - 1 }))
    const send = vi.fn(async () => 'sent' as const)
    await flushOutbox(send, OWNER, NOW)
    expect(send).not.toHaveBeenCalled()
    expect(outboxEntries()).toEqual([])
  })

  test('corrupt storage reads as empty instead of throwing', () => {
    localStorage.setItem('reality-outbox-v1', '{not json')
    expect(outboxEntries()).toEqual([])
    clearOutbox()
  })
})

describe('sendIntent', () => {
  test('posts the intent with the entry key as idempotency key and classifies the reply', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const outcome = await sendIntent({ ...entry(1), attempts: 0, nextAttemptAt: 0 }, fetchImpl as unknown as typeof fetch)
    expect(outcome).toBe('sent')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/intent')
    expect(JSON.parse(String(init.body))).toEqual({ intent: { type: 'workShift', jobId: 'barista' }, idempotencyKey: `shift-${OWNER}-1` })
  })

  test('a network error is a retry, not a loss', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down') })
    expect(await sendIntent({ ...entry(1), attempts: 0, nextAttemptAt: 0 }, fetchImpl as unknown as typeof fetch)).toBe('retry')
  })
})
