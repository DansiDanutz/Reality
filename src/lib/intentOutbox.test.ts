import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  classifyIntentResponse,
  clearOutbox,
  enqueueIntent,
  flushOutbox,
  OUTBOX_MAX_AGE_MS,
  OUTBOX_MAX_ATTEMPTS,
  outboxEntries,
  sendIntent,
  shiftIntentKey,
  type OutboxEntry,
} from './intentOutbox'

const NOW = 1_800_000_000_000
const entry = (n: number, over: Partial<OutboxEntry> = {}) => ({
  key: `shift-c-${n}`,
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
    expect(classifyIntentResponse(429, { code: 'shift_too_soon' })).toBe('retry-later')
    expect(classifyIntentResponse(429, { code: 'intent_rate_limited' })).toBe('retry-later')
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
    expect(outboxEntries()[0].key).toBe('shift-c-1')
  })

  test('shiftIntentKey is stable per shift and accepted by the server key format', () => {
    expect(shiftIntentKey('abc', 123456)).toBe(shiftIntentKey('abc', 123456))
    expect(shiftIntentKey('abc', 123456)).not.toBe(shiftIntentKey('abc', 123457))
    expect(shiftIntentKey('a b/c', 1)).toMatch(/^[A-Za-z0-9_.:-]{1,128}$/)
  })

  test('delivers oldest-first and removes what was sent', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const order: string[] = []
    const n = await flushOutbox(async (e) => (order.push(e.key), 'sent'), NOW)
    expect(n).toBe(2)
    expect(order).toEqual(['shift-c-2', 'shift-c-1'])
    expect(outboxEntries()).toEqual([])
  })

  test('a cooldown stops the flush and keeps every queued shift for later', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const send = vi.fn(async () => 'retry-later' as const)
    expect(await flushOutbox(send, NOW)).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(outboxEntries()).toHaveLength(2)
    expect(outboxEntries()[0].attempts).toBe(0) // waiting is not failing
  })

  test('a terminal rejection drops only that entry and the rest continue', async () => {
    enqueueIntent(entry(2))
    enqueueIntent(entry(1))
    const outcomes = ['drop', 'sent'] as const
    let i = 0
    const n = await flushOutbox(async () => outcomes[i++], NOW)
    expect(n).toBe(1)
    expect(outboxEntries()).toEqual([])
  })

  test('network failures count attempts and give up eventually', async () => {
    enqueueIntent(entry(1))
    await flushOutbox(async () => { throw new Error('offline') }, NOW)
    expect(outboxEntries()[0].attempts).toBe(1)
    localStorage.setItem('reality-outbox-v1', JSON.stringify([{ ...entry(1), attempts: OUTBOX_MAX_ATTEMPTS }]))
    await flushOutbox(async () => 'sent', NOW)
    expect(outboxEntries()).toEqual([])
  })

  test('entries older than the max age are discarded unsent', async () => {
    enqueueIntent(entry(1, { createdAt: NOW - OUTBOX_MAX_AGE_MS - 1 }))
    const send = vi.fn(async () => 'sent' as const)
    await flushOutbox(send, NOW)
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
    const outcome = await sendIntent({ ...entry(1), attempts: 0 }, fetchImpl as unknown as typeof fetch)
    expect(outcome).toBe('sent')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/intent')
    expect(JSON.parse(String(init.body))).toEqual({ intent: { type: 'workShift', jobId: 'barista' }, idempotencyKey: 'shift-c-1' })
  })

  test('a network error is a retry, not a loss', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down') })
    expect(await sendIntent({ ...entry(1), attempts: 0 }, fetchImpl as unknown as typeof fetch)).toBe('retry')
  })
})
