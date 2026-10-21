import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { gameClockOffset } from '../game/time'
import {
  beginServerClock,
  offsetFromExchange,
  resetServerClockForTest,
  serverClockReady,
  serverTimeMeasured,
  syncServerClock,
} from './serverClock'

beforeEach(() => {
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
  test('measures the offset at the round-trip midpoint and rejects what it cannot trust', () => {
    expect(offsetFromExchange(10_000, 1_000, 1_200)).toBe(8_900)
    expect(offsetFromExchange('10000', 1_000, 1_200)).toBeNull()
    expect(offsetFromExchange(10_000, 1_000, 7_000)).toBeNull() // round trip too slow
    expect(offsetFromExchange(10_000, 1_200, 1_000)).toBeNull() // device clock moved mid-exchange
    expect(offsetFromExchange(1e15, 1_000, 1_200)).toBeNull()
  })

  test('adopts and remembers the measured offset, ignoring jitter after that', async () => {
    let device = 1_000_000
    const deviceNow = () => device
    const first = await syncServerClock(reply({ ok: true, now: device - 3_600_000 }) as never, deviceNow)
    expect(first).toEqual({ previous: 0, offset: -3_600_000 })
    expect(gameClockOffset()).toBe(-3_600_000)
    expect(serverTimeMeasured()).toBe(true)
    expect(JSON.parse(localStorage.getItem('reality-clock-v1')!)).toEqual({ offsetMs: -3_600_000 })

    device += 60_000
    await syncServerClock(reply({ ok: true, now: device - 3_600_000 + 1_500 }) as never, deviceNow)
    expect(gameClockOffset()).toBe(-3_600_000)
  })

  test('holds the tick at startup on the remembered offset until a measurement or the timeout', async () => {
    vi.useFakeTimers()
    localStorage.setItem('reality-clock-v1', JSON.stringify({ offsetMs: 42_000 }))
    beginServerClock(5_000)
    expect(gameClockOffset()).toBe(42_000)
    expect(serverClockReady()).toBe(false)
    vi.advanceTimersByTime(5_000)
    expect(serverClockReady()).toBe(true)
  })

  test('an unreachable or broken server releases the hold at once and keeps the last offset', async () => {
    localStorage.setItem('reality-clock-v1', JSON.stringify({ offsetMs: 42_000 }))
    beginServerClock(60_000)
    expect(await syncServerClock(vi.fn(async () => { throw new Error('offline') }) as never)).toBeNull()
    expect(serverClockReady()).toBe(true)
    beginServerClock(60_000)
    expect(await syncServerClock(reply('<html>', 200) as never)).toBeNull()
    expect(serverClockReady()).toBe(true)
    expect(gameClockOffset()).toBe(42_000)
    expect(serverTimeMeasured()).toBe(false)
  })
})
