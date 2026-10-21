import { anchorGameClock, gameNow, resetGameClock } from '../game/time'

/**
 * Learns the server's time so the simulation (src/game/time.ts) runs on it.
 *
 * Each measurement against /api/time pins game time to the server's clock
 * at the round-trip midpoint, timed on the monotonic clock, and game time
 * advances on that monotonic clock until the next one: changing the
 * device's date and time mid-session moves nothing. The device→server
 * difference is remembered per device, so an offline session starts from
 * the last trusted correction. At startup the tick waits briefly for the
 * first measurement: a device clock set forward while the app was closed
 * must not be simulated before the server has had a chance to correct it.
 */

const STORAGE_KEY = 'reality-clock-v1'
/** A slower round trip makes the midpoint too uncertain to trust. */
const MAX_ROUND_TRIP_MS = 5_000
/** A server time this far from the device clock is a broken response, not a skewed clock. */
const MAX_REASONABLE_OFFSET_MS = 10 * 365 * 24 * 3_600_000
/** Re-measurements inside this band are jitter: game time stays put. */
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

/**
 * Start of a session: run on the device clock plus this device's last known
 * correction (from now on advancing monotonically), and hold the tick until
 * a measurement confirms it.
 */
export function beginServerClock(timeoutMs = CLOCK_READY_TIMEOUT_MS): void {
  anchorGameClock(Date.now() + (readPersistedOffset() ?? 0))
  pending = true
  if (readyTimer) clearTimeout(readyTimer)
  readyTimer = setTimeout(settle, timeoutMs)
}

/** The server's time at `receivedAt` from one exchange timed on the monotonic clock; null when it cannot be trusted. */
export function serverTimeAtReceipt(serverNow: unknown, sentAt: number, receivedAt: number): number | null {
  if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return null
  if (receivedAt < sentAt || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return null
  return Math.round(serverNow + (receivedAt - sentAt) / 2)
}

/** Measure the server's time and run the game on it. False when the server could not be reached or trusted. */
export async function syncServerClock(
  fetchImpl: typeof fetch = fetch,
  monotonicNow: () => number = () => performance.now(),
): Promise<boolean> {
  const sentAt = monotonicNow()
  let serverNow: unknown
  try {
    const res = await fetchImpl('/api/time', { cache: 'no-store' })
    serverNow = res.ok ? ((await res.json()) as { now?: unknown }).now : null
  } catch {
    serverNow = null
  }
  const receivedAt = monotonicNow()
  const serverAtReceipt = serverTimeAtReceipt(serverNow, sentAt, receivedAt)
  const offset = serverAtReceipt === null ? null : serverAtReceipt - Date.now()
  if (serverAtReceipt === null || offset === null || Math.abs(offset) > MAX_REASONABLE_OFFSET_MS) {
    // No answer is coming: stop holding the tick and run on what we have.
    // The wait is only for a server that is reachable but slow.
    settle()
    return false
  }
  const drift = serverAtReceipt - (gameNow() - (monotonicNow() - receivedAt))
  if (!measured || Math.abs(drift) > CLOCK_NOISE_MS) anchorGameClock(serverAtReceipt, receivedAt)
  persistOffset(offset)
  measured = true
  settle()
  return true
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
    /* storage blocked: the measurement still applies for this session */
  }
}

/** Test seam: forget everything this module learned. */
export function resetServerClockForTest(): void {
  settle()
  measured = false
  resetGameClock()
}
