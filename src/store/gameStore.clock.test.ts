import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useGame } from './gameStore'
import { beginServerClock, resetServerClockForTest, syncServerClock } from '../lib/serverClock'

const SERVER_NOW = new Date('2026-10-21T12:00:00.000Z').getTime()
const MIN = 60_000
const HOUR = 60 * MIN

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

/** An eight-hour shift in progress, started `startedAt`. */
const shift = (startedAt: number) => ({ kind: 'shift' as const, startedAt, endsAt: startedAt + 8 * HOUR, wage: 15, title: 'Barista' })

describe('trusted time', () => {
  test('a citizen created on a fast device clock resumes on server time, not frozen', async () => {
    vi.setSystemTime(SERVER_NOW + HOUR) // device one hour fast, server not yet measured
    useGame.getState().createCitizen('Ada', null)
    useGame.setState({ activity: shift(SERVER_NOW + HOUR) })
    expect(useGame.getState().clockTrusted).toBe(false)

    await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().tick()

    const s = useGame.getState()
    expect(s.clockTrusted).toBe(true)
    expect(s.lastSeenAt).toBe(SERVER_NOW)
    expect(s.citizen?.createdAt).toBe(SERVER_NOW)
    expect(s.activity?.endsAt).toBe(SERVER_NOW + 8 * HOUR)

    vi.advanceTimersByTime(10 * MIN) // ten real minutes later
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW + 10 * MIN)
  })

  test('an accurately stamped old save is not moved when the phone clock changed since', async () => {
    for (const deviceSkew of [8 * HOUR, -8 * HOUR]) {
      vi.setSystemTime(SERVER_NOW - MIN)
      useGame.getState().createCitizen('Ada', null)
      useGame.setState({ clockTrusted: false, lastSeenAt: SERVER_NOW - MIN, activity: shift(SERVER_NOW - HOUR), money: 1_000 })

      vi.setSystemTime(SERVER_NOW + deviceSkew) // the phone was moved before reopening
      await syncServerClock(serverSays(SERVER_NOW) as never)
      useGame.getState().tick()

      const s = useGame.getState()
      expect(s.clockTrusted).toBe(true)
      expect(s.lastSeenAt).toBe(SERVER_NOW)
      expect(s.activity?.endsAt).toBe(SERVER_NOW + 7 * HOUR) // the shift still has seven real hours to go
      useGame.getState().reset()
      resetServerClockForTest()
    }
  })

  test('a fast-stamped save restored after the measurement is handed off on the next tick', async () => {
    vi.setSystemTime(SERVER_NOW + HOUR)
    await syncServerClock(serverSays(SERVER_NOW) as never)
    // A save written by a device one hour fast, restored after the clock was measured.
    useGame.setState({
      citizen: { name: 'Ada', founderNumber: 3, createdAt: SERVER_NOW + HOUR },
      clockTrusted: false,
      lastSeenAt: SERVER_NOW + HOUR,
      activity: shift(SERVER_NOW + HOUR),
    })
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
    expect(useGame.getState().activity?.endsAt).toBe(SERVER_NOW + 8 * HOUR)

    vi.advanceTimersByTime(31 * MIN)
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW + 31 * MIN)
  })

  test('moving the phone forward mid-session does not finish a shift', async () => {
    vi.setSystemTime(SERVER_NOW)
    await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().createCitizen('Ada', null)
    useGame.setState({ activity: shift(SERVER_NOW) })

    vi.setSystemTime(SERVER_NOW + 8 * HOUR) // the phone jumps eight hours ahead
    vi.advanceTimersByTime(1_000) // one real second
    useGame.getState().tick()

    const s = useGame.getState()
    expect(s.activity?.kind).toBe('shift')
    expect(s.shiftsWorked).toBe(0)
    expect(s.lastSeenAt).toBe(SERVER_NOW + 1_000)
  })

  test('a citizen created after the measurement is trusted from the start', async () => {
    vi.setSystemTime(SERVER_NOW + HOUR)
    await syncServerClock(serverSays(SERVER_NOW) as never)
    useGame.getState().createCitizen('Ada', null)
    expect(useGame.getState().clockTrusted).toBe(true)
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW)
  })

  test('on a trusted save, time played ahead of the real clock is paid back, not re-anchored away', () => {
    vi.setSystemTime(SERVER_NOW)
    useGame.getState().createCitizen('Ada', null)
    useGame.setState({ clockTrusted: true, lastSeenAt: SERVER_NOW + 2 * HOUR, money: 1_000 })
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(SERVER_NOW + 2 * HOUR)
    expect(useGame.getState().money).toBe(1_000)

    // A small backwards step is ordinary clock discipline.
    useGame.setState({ lastSeenAt: SERVER_NOW + MIN })
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
