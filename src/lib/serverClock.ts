import { gameClockOffset, setGameClockOffset } from '../game/time'

/**
 * Learns the server's time so the simulation (src/game/time.ts) runs on it.
 *
 * The offset is measured against /api/time at the round-trip midpoint and
 * remembered per device, so an offline session keeps the last trusted
 * correction. At startup the tick waits briefly for the first measurement:
 * a device clock set forward while the app was closed must not be simulated
 * before the server has had a chance to correct it.
 */

const STORAGE_KEY = 'reality-clock-v1'
/** A slower round trip makes the midpoint too uncertain to trust. */
const MAX_ROUND_TRIP_MS = 5_000
/** An offset bigger than this is a broken response, not a skewed clock. */
const MAX_REASONABLE_OFFSET_MS = 10 * 365 * 24 * 3_600_000
/** Re-measurements inside this band are jitter: the offset stays put. */
export const CLOCK_NOISE_MS = 2_000
/** How long the tick waits for the first measurement before running offline. */
export const CLOCK_READY_TIMEOUT_MS = 5_000

let pending = false
let measured = false
let readyTimer: ReturnType<typeof setTimeout> | null = null

/** False only between `beginServerClock()` and the first measurement (or its timeout). */
export function serverClockReady(): boolean {
  return !pending
}

/** True once this session has measured the server's time. */
export function serverTimeMeasured(): boolean {
  return measured
}

/** Start of a session: restore this device's last offset and hold the tick until it is confirmed. */
export function beginServerClock(timeoutMs = CLOCK_READY_TIMEOUT_MS): void {
  setGameClockOffset(readPersistedOffset() ?? 0)
  pending = true
  if (readyTimer) clearTimeout(readyTimer)
  readyTimer = setTimeout(() => {
    pending = false
    readyTimer = null
  }, timeoutMs)
}

/** server − device from one /api/time exchange; null when it cannot be trusted. */
export function offsetFromExchange(serverNow: unknown, sentAt: number, receivedAt: number): number | null {
  if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return null
  if (receivedAt < sentAt || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return null
  const offset = Math.round(serverNow - (sentAt + receivedAt) / 2)
  return Math.abs(offset) > MAX_REASONABLE_OFFSET_MS ? null : offset
}

export interface ClockMeasurement {
  /** The offset the game ran on before this measurement. */
  previous: number
  /** The offset it runs on now. */
  offset: number
}

/** Measure the server's time and adopt it. Null when the server could not be reached or trusted. */
export async function syncServerClock(
  fetchImpl: typeof fetch = fetch,
  deviceNow: () => number = Date.now,
): Promise<ClockMeasurement | null> {
  const sentAt = deviceNow()
  let serverNow: unknown
  try {
    const res = await fetchImpl('/api/time', { cache: 'no-store' })
    serverNow = res.ok ? ((await res.json()) as { now?: unknown }).now : null
  } catch {
    serverNow = null
  }
  const offset = offsetFromExchange(serverNow, sentAt, deviceNow())
  if (offset === null) {
    // No answer is coming: stop holding the tick and run on the last offset.
    // The wait is only for a server that is reachable but slow.
    settle()
    return null
  }
  const previous = gameClockOffset()
  if (!measured || Math.abs(offset - previous) > CLOCK_NOISE_MS) {
    setGameClockOffset(offset)
    persistOffset(offset)
  }
  measured = true
  settle()
  return { previous, offset: gameClockOffset() }
}

function settle(): void {
  pending = false
  if (readyTimer) clearTimeout(readyTimer)
  readyTimer = null
}

function readPersistedOffset(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = (JSON.parse(raw) as { offsetMs?: unknown }).offsetMs
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_REASONABLE_OFFSET_MS ? value : null
  } catch {
    return null
  }
}

function persistOffset(offsetMs: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ offsetMs }))
  } catch {
    /* storage blocked: the offset still applies for this session */
  }
}

/** Test seam: forget everything this module learned. */
export function resetServerClockForTest(): void {
  pending = false
  measured = false
  if (readyTimer) clearTimeout(readyTimer)
  readyTimer = null
  setGameClockOffset(0)
}
