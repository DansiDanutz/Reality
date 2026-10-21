import { afterEach, describe, expect, test, vi } from 'vitest'
import { resetServerClockForTest, simulationNow, useGame } from './gameStore'

/**
 * Rule #1 — real time — is enforced by the server's clock once seen, and by
 * a no-rewind policy offline (src/lib/serverClock.ts). These tests pin the
 * store-level consequences: what the tick does with a skewed device clock,
 * and that a finished shift reaches the server ledger.
 */

const NOW = new Date('2026-10-21T12:00:00.000Z').getTime()
const DAY = 86_400_000

function liveCitizen(online: boolean) {
  useGame.setState({
    citizen: { name: 'Ada', founderNumber: 1, createdAt: NOW - DAY, citizenId: 'ada', online },
    jobId: 'barista',
    money: 1_000,
    needs: { hunger: 95, hydration: 95, energy: 95, hygiene: 95, fun: 95 },
    health: 100,
    level: 1,
    xp: 0,
    activity: null,
    assets: [],
    lastSeenAt: NOW,
    log: [],
    toasts: [],
  })
}

function advanceLiveTo(endAt: number, stepMs = 15 * 60_000) {
  let cursor = Date.now()
  while (cursor < endAt) {
    cursor = Math.min(cursor + stepMs, endAt)
    vi.setSystemTime(cursor)
    useGame.getState().tick()
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetServerClockForTest()
  useGame.getState().reset()
})

describe('tick — device clock rewinds', () => {
  test('a large backwards move freezes accrual instead of re-anchoring lastSeenAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    liveCitizen(false)
    const before = useGame.getState()

    vi.setSystemTime(NOW - 30 * DAY)
    useGame.getState().tick()

    const after = useGame.getState()
    expect(after.lastSeenAt).toBe(NOW) // the evidence of a forward jump is kept
    expect(after.money).toBe(before.money)
    expect(after.needs).toEqual(before.needs)
  })

  test('an NTP-sized backwards move is re-anchored and simulates nothing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    liveCitizen(false)

    vi.setSystemTime(NOW - 60_000)
    useGame.getState().tick()

    expect(useGame.getState().lastSeenAt).toBe(NOW - 60_000)
    expect(useGame.getState().money).toBe(1_000)
  })

  test('a frozen clock resumes once real time passes the last simulated instant', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW - 30 * DAY)
    liveCitizen(false)
    useGame.getState().tick() // frozen
    expect(useGame.getState().lastSeenAt).toBe(NOW)

    vi.setSystemTime(NOW + 60_000)
    useGame.getState().tick()
    expect(useGame.getState().lastSeenAt).toBe(NOW + 60_000)
  })
})

describe('server clock', () => {
  test('the Date header of any API response corrects the simulation clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, citizenId: 'ada', name: 'Ada', founderNumber: 1, createdAt: NOW - DAY }),
      { status: 200, headers: { date: 'Wed, 21 Oct 2026 13:00:00 GMT' } }, // server is an hour ahead of this device
    )))
    liveCitizen(false)

    expect(simulationNow()).toBe(NOW)
    await useGame.getState().registerOnline()

    expect(useGame.getState().citizen?.online).toBe(true)
    expect(simulationNow()).toBe(NOW + 3_600_000)
  })

  test('a device clock set a month ahead is paid for the server day, not the device day', async () => {
    vi.useFakeTimers()
    const device = NOW + 30 * DAY
    vi.setSystemTime(device)
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ ok: true, citizenId: 'ada' }),
      { status: 200, headers: { date: new Date(NOW).toUTCString() } },
    )))
    liveCitizen(false)
    useGame.setState({ lastSeenAt: NOW - 60_000 })

    await useGame.getState().registerOnline()
    useGame.getState().tick()

    // One minute of life was simulated, not thirty days.
    expect(useGame.getState().lastSeenAt).toBe(NOW)
  })
})

describe('tick — the shift reaches the ledger', () => {
  test('a finished shift is reported as a workShift intent keyed on its start', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    liveCitizen(true)

    useGame.getState().startShift()
    const startedAt = useGame.getState().activity!.startedAt
    advanceLiveTo(useGame.getState().activity!.endsAt)

    const intentCall = fetchMock.mock.calls.find(([url]) => url === '/api/intent') as [string, RequestInit] | undefined
    expect(intentCall).toBeDefined()
    expect(JSON.parse(String(intentCall![1].body))).toEqual({
      intent: { type: 'workShift', jobId: 'barista' },
      idempotencyKey: `shift:ada:${startedAt}`,
    })
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/intent')).toHaveLength(1)
  })

  test('an offline citizen keeps their wages locally and reports nothing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    liveCitizen(false)

    useGame.getState().startShift()
    advanceLiveTo(useGame.getState().activity!.endsAt)

    expect(useGame.getState().money).toBeGreaterThan(1_000)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/intent')).toBe(false)
  })
})
