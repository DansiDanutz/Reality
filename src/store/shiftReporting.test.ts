import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { resetServerClockForTest } from '../lib/serverClock'
import { clearOutbox, outboxEntries, shiftIntentKey } from '../lib/intentOutbox'

const MIN = 60_000
const T0 = new Date('2026-03-02T08:00:00.000Z').getTime()
const g = () => useGame.getState()

let sent: Array<{ url: string; body: { intent: unknown; idempotencyKey: string } }>

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  sent = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url) === '/api/intent') {
      sent.push({ url, body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    throw new Error('offline')
  }))
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  g().createCitizen('Reporter', null)
  // Registered with the live world: only a citizen with a server identity can report.
  useGame.setState({ money: 2_500, clockTrusted: true, targetsSeen: true, citizen: { ...g().citizen!, citizenId: 'reporter-1', online: true } })
  clearOutbox()
})

afterEach(() => {
  g().reset()
  resetServerClockForTest()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const flushMicrotasks = () => vi.advanceTimersByTimeAsync(0)

describe('shift reporting (audit E4)', () => {
  test('a finished 8-hour shift is reported once, keyed by the shift itself', async () => {
    g().takeJob('barista')
    useGame.setState({ needs: { hunger: 90, hydration: 90, energy: 95, hygiene: 90, fun: 70 }, health: 100 })
    g().startShift()
    const startedAt = g().activity!.startedAt
    for (let i = 0; i < 49; i++) {
      vi.setSystemTime(Date.now() + 10 * MIN)
      g().tick()
    }
    await flushMicrotasks()
    expect(g().activity).toBeNull()
    const key = shiftIntentKey(g().citizen!.citizenId!, startedAt)
    expect(sent.map((s) => s.body)).toEqual([{ intent: { type: 'workShift', jobId: 'barista' }, idempotencyKey: key }])
    expect(outboxEntries()).toEqual([])
  })

  test('an unreachable server keeps the report queued instead of losing it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    g().takeJob('barista')
    useGame.setState({ needs: { hunger: 90, hydration: 90, energy: 95, hygiene: 90, fun: 70 }, health: 100 })
    g().startShift()
    for (let i = 0; i < 49; i++) {
      vi.setSystemTime(Date.now() + 10 * MIN)
      g().tick()
    }
    await flushMicrotasks()
    expect(outboxEntries()).toHaveLength(1)
    expect(outboxEntries()[0].intent).toEqual({ type: 'workShift', jobId: 'barista' })
  })
})
