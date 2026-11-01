import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushShiftReports, useGame } from './gameStore'
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
    const key = shiftIntentKey(g().citizen!.createdAt, startedAt)
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

  const worked = (hours10min: number) => {
    for (let i = 0; i < hours10min; i++) {
      vi.setSystemTime(Date.now() + 10 * MIN)
      g().tick()
    }
  }
  const fullBody = { hunger: 90, hydration: 90, energy: 95, hygiene: 90, fun: 70 }

  test('a shift finished BEFORE registration is reported once the citizen is online', async () => {
    useGame.setState({ citizen: { ...g().citizen!, citizenId: undefined, online: false } })
    g().takeJob('barista')
    useGame.setState({ needs: fullBody, health: 100 })
    g().startShift()
    worked(49)
    await flushMicrotasks()
    expect(sent).toEqual([]) // offline: nothing can be sent yet…
    expect(outboxEntries()).toHaveLength(1) // …but the report is not lost
    useGame.setState({ citizen: { ...g().citizen!, citizenId: 'late-1', online: true } })
    await flushShiftReports()
    expect(sent).toHaveLength(1)
    expect(outboxEntries()).toEqual([])
  })

  test("citizen A's pending report is never sent under citizen B's session", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    g().takeJob('barista')
    useGame.setState({ needs: fullBody, health: 100 })
    g().startShift()
    worked(49)
    await flushMicrotasks()
    expect(outboxEntries()).toHaveLength(1)
    // Switch to a different citizen on the same browser; the queue survives.
    g().reset()
    g().createCitizen('Other', null)
    vi.setSystemTime(Date.now() + 1_000)
    useGame.setState({ citizen: { ...g().citizen!, citizenId: 'other-1', online: true } })
    const spy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await flushShiftReports()
    expect(spy).not.toHaveBeenCalled()
    expect(outboxEntries()).toHaveLength(1)
  })

  test('the report names the job the shift STARTED as, even if the player switches jobs mid-shift', async () => {
    g().takeJob('barista')
    useGame.setState({ needs: fullBody, health: 100 })
    g().startShift()
    g().takeJob('courier')
    worked(49)
    await flushMicrotasks()
    expect(sent.map((s) => s.body.intent)).toEqual([{ type: 'workShift', jobId: 'barista' }])
  })

  test('a 30-minute gig is never reported as an employer shift', async () => {
    g().takeJob('barista')
    g().startGig()
    worked(4)
    await flushMicrotasks()
    expect(g().activity).toBeNull()
    expect(sent).toEqual([])
    expect(outboxEntries()).toEqual([])
  })

  test('a clock correction that moves createdAt does not strand queued reports', async () => {
    // Offline-created citizen on a device 2h fast; a full shift finishes before the first server measurement.
    useGame.setState({ citizen: { ...g().citizen!, citizenId: undefined, online: false } })
    g().takeJob('barista')
    useGame.setState({ needs: fullBody, health: 100 })
    g().startShift()
    worked(49)
    await flushMicrotasks()
    const queued = outboxEntries()
    expect(queued).toHaveLength(1)
    const oldOwner = queued[0].owner
    const oldKey = queued[0].key
    // The tick's one-time hand-off to the trusted clock shifts every timestamp, createdAt included.
    const { beginServerClock, syncServerClock } = await import('../lib/serverClock')
    beginServerClock()
    const serverNow = Date.now() - 2 * 3_600_000
    await syncServerClock((async () => new Response(JSON.stringify({ ok: true, now: serverNow }))) as never)
    useGame.setState({ clockTrusted: false })
    g().tick()
    const moved = g().citizen!.createdAt
    expect(moved).not.toBe(oldOwner)
    expect(outboxEntries()[0].owner).toBe(moved) // re-owned…
    expect(outboxEntries()[0].key).toBe(oldKey) // …with its idempotency key untouched
    // …and its own timestamp moved onto the corrected clock, so it cannot look expired.
    expect(outboxEntries()[0].createdAt - queued[0].createdAt).toBe(moved - oldOwner)
    useGame.setState({ citizen: { ...g().citizen!, citizenId: 'late-2', online: true } })
    await flushShiftReports()
    expect(sent.map((x) => x.body.idempotencyKey)).toEqual([oldKey])
  })
})
