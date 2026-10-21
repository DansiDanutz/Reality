import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { beginServerClock, resetServerClockForTest, syncServerClock } from '../lib/serverClock'

const SERVER_NOW = new Date('2026-10-21T12:00:00.000Z').getTime()
const HOUR = 3_600_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
})

afterEach(() => {
  useGame.getState().reset()
  resetServerClockForTest()
  vi.useRealTimers()
})

const serverSays = (now: number) => vi.fn(async () => new Response(JSON.stringify({ ok: true, now })))

describe('trusted time', () => {
  test('a citizen created on a fast device clock is moved onto server time, not frozen', async () => {
    vi.setSystemTime(SERVER_NOW + HOUR) // device one hour fast, server not yet measured
    useGame.getState().createCitizen('Ada', null)
    const workEndsAt = SERVER_NOW + HOUR + 30 * 60_000
    useGame.setState({ activity: { kind: 'gig', startedAt: SERVER_NOW + HOUR, endsAt: workEndsAt } as never })
    expect(useGame.getState().clockTrusted).toBe(false)

    const measurement = await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().adoptServerClock(measurement!)

    const s = useGame.getState()
    expect(s.clockTrusted).toBe(true)
    expect(s.lastSeenAt).toBe(SERVER_NOW)
    expect(s.citizen?.createdAt).toBe(SERVER_NOW)
    expect(s.activity?.endsAt).toBe(SERVER_NOW + 30 * 60_000)

    vi.setSystemTime(SERVER_NOW + HOUR + 10 * 60_000) // ten real minutes later, device still fast
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW + 10 * 60_000)
  })

  test('a citizen created after the measurement is trusted from the start and never rebased', async () => {
    vi.setSystemTime(SERVER_NOW + HOUR)
    const measurement = await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().createCitizen('Ada', null)
    expect(useGame.getState().clockTrusted).toBe(true)
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
    useGame.getState().adoptServerClock({ previous: 0, offset: measurement!.offset })
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
  })

  test('time played ahead of the real clock is paid back, not re-anchored away', () => {
    vi.setSystemTime(SERVER_NOW)
    useGame.getState().createCitizen('Ada', null)
    useGame.setState({ clockTrusted: true, lastSeenAt: SERVER_NOW + 2 * HOUR, money: 1_000 })
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW + 2 * HOUR)
    expect(useGame.getState().money).toBe(1_000)

    // A small backwards step is ordinary clock discipline.
    useGame.setState({ lastSeenAt: SERVER_NOW + 60_000 })
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
  })

  test('the tick waits for the first measurement at startup', async () => {
    vi.setSystemTime(SERVER_NOW)
    useGame.getState().createCitizen('Ada', null)
    useGame.setState({ clockTrusted: true, lastSeenAt: SERVER_NOW - 6 * HOUR })
    beginServerClock(5_000)
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW - 6 * HOUR)

    await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
  })
})
