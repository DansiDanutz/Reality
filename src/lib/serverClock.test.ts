import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { gameNow } from '../game/time'
import {
  beginServerClock,
  resetServerClockForTest,
  serverClockReady,
  serverTimeAtReceipt,
  serverTimeMeasured,
  syncServerClock,
} from './serverClock'

const DEVICE = 1_800_000_000_000
const HOUR = 3_600_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DEVICE)
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
})

afterEach(() => {
  resetServerClockForTest()
  vi.useRealTimers()
})

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('server clock', () => {
  test('takes the server time at the round-trip midpoint and rejects what it cannot trust', () => {
    expect(serverTimeAtReceipt(10_000, 1_000, 1_200)).toBe(10_100)
    expect(serverTimeAtReceipt('10000', 1_000, 1_200)).toBeNull()
    expect(serverTimeAtReceipt(10_000, 1_000, 7_000)).toBeNull() // round trip too slow
    expect(serverTimeAtReceipt(10_000, 1_200, 1_000)).toBeNull()
  })

  test('runs the game on the measured time, remembers the correction and ignores jitter', async () => {
    expect(await syncServerClock(reply({ ok: true, now: DEVICE - HOUR }) as never)).toBe(true)
    expect(gameNow()).toBe(DEVICE - HOUR)
    expect(serverTimeMeasured()).toBe(true)
    expect(JSON.parse(localStorage.getItem('reality-clock-v1')!)).toEqual({ offsetMs: -HOUR })

    vi.advanceTimersByTime(60_000)
    await syncServerClock(reply({ ok: true, now: DEVICE - HOUR + 60_000 + 1_500 }) as never)
    expect(gameNow()).toBe(DEVICE - HOUR + 60_000) // 1.5 s of jitter does not move the clock
  })

  test('a device clock moved mid-session moves nothing until the next measurement', async () => {
    await syncServerClock(reply({ ok: true, now: DEVICE }) as never)
    vi.setSystemTime(DEVICE + 8 * HOUR)
    vi.advanceTimersByTime(1_000)
    expect(gameNow()).toBe(DEVICE + 1_000)
  })

  test('holds the tick at startup on the remembered correction until a measurement or the timeout', () => {
    localStorage.setItem('reality-clock-v1', JSON.stringify({ offsetMs: 42_000 }))
    beginServerClock(5_000)
    expect(gameNow()).toBe(DEVICE + 42_000)
    expect(serverClockReady()).toBe(false)
    vi.advanceTimersByTime(5_000)
    expect(serverClockReady()).toBe(true)
    expect(gameNow()).toBe(DEVICE + 42_000 + 5_000)
  })

  test('an unreachable or broken server releases the hold at once and keeps the remembered correction', async () => {
    localStorage.setItem('reality-clock-v1', JSON.stringify({ offsetMs: 42_000 }))
    beginServerClock(60_000)
    expect(await syncServerClock(vi.fn(async () => { throw new Error('offline') }) as never)).toBe(false)
    expect(serverClockReady()).toBe(true)
    beginServerClock(60_000)
    expect(await syncServerClock(reply('<html>') as never)).toBe(false)
    expect(serverClockReady()).toBe(true)
    expect(gameNow()).toBe(DEVICE + 42_000)
    expect(serverTimeMeasured()).toBe(false)
  })
})
