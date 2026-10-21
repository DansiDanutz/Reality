/**
 * The simulation's clock. Rule #1 (real time) used to rest on the device
 * clock alone: set it forward, collect, set it back. The client now learns
 * the server's time and keeps it here, so every reading of "now" in the
 * game — the tick, activity timers, day boundaries, the countdowns on
 * screen — agrees on one trusted clock.
 *
 * No I/O: the server's time is supplied from outside (src/lib/serverClock.ts).
 */

/**
 * Once anchored, game time advances on the monotonic clock
 * (`performance.now()`), which changing the device's date and time cannot
 * move. Before any anchor (tests, pure callers) it is the device clock.
 */
let anchor: { gameMs: number; monoMs: number } | null = null

const monotonicNow = (): number => performance.now()

/** Real time as the server tells it. */
export function gameNow(): number {
  return anchor ? anchor.gameMs + (monotonicNow() - anchor.monoMs) : Date.now()
}

/** Pin game time to `gameMs` at the monotonic instant `monoMs`; it advances from there. */
export function anchorGameClock(gameMs: number, monoMs: number = monotonicNow()): void {
  if (Number.isFinite(gameMs) && Number.isFinite(monoMs)) anchor = { gameMs, monoMs }
}

/** Forget the anchor: game time is the device clock again. */
export function resetGameClock(): void {
  anchor = null
}

/** Backwards moves up to this much are ordinary clock discipline (NTP): accepted silently. */
export const CLOCK_REWIND_TOLERANCE_MS = 5 * 60_000

export type RewindPolicy = 'advance' | 'reanchor' | 'freeze'

/**
 * What a tick does with the span since the last simulated instant.
 * `advance`: simulate it. `reanchor`: a small backwards move — accept the
 * clock and simulate nothing. `freeze`: a large backwards move — simulate
 * nothing and keep the last instant, so time that was played ahead of the
 * real clock is paid back instead of re-anchored away.
 */
export function rewindPolicy(nowMs: number, lastSeenAtMs: number): RewindPolicy {
  if (nowMs > lastSeenAtMs) return 'advance'
  return lastSeenAtMs - nowMs <= CLOCK_REWIND_TOLERANCE_MS ? 'reanchor' : 'freeze'
}

const TIMESTAMP_KEY = /(At|Until)$/
/** Epoch ms after 2001-09-09: anything smaller under a timestamp key is not a timestamp. */
const MIN_EPOCH_MS = 1e12

/**
 * Shift every timestamp in a saved state by `deltaMs`: the one-time hand-off
 * from the device's clock to the trusted one. A save stamped by a device an
 * hour fast would otherwise sit an hour in the future — its activities
 * would run an hour long and the tick would freeze for an hour. Timestamps
 * are the numeric fields named `…At` / `…Until`, and the values of a map
 * so named; everything else (day indices, durations, money) is left alone.
 * Returns the same object when nothing moves.
 */
export function rebaseTimestamps<T>(value: T, deltaMs: number): T {
  if (!deltaMs) return value
  return shift(value, deltaMs) as T
}

function shift(value: unknown, deltaMs: number, timestampMap = false): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const out = value.map((item) => {
      const next = shift(item, deltaMs)
      if (next !== item) changed = true
      return next
    })
    return changed ? out : value
  }
  if (value === null || typeof value !== 'object') return value
  let changed = false
  const out: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    let next = field
    const timestampKey = timestampMap || TIMESTAMP_KEY.test(key)
    if (typeof field === 'number') {
      if (timestampKey && field > MIN_EPOCH_MS) next = field + deltaMs
    } else {
      // `groceryRestockedAt: { bread: <ms> }` — a map named like a timestamp
      // holds timestamps under arbitrary keys.
      next = shift(field, deltaMs, TIMESTAMP_KEY.test(key) && !Array.isArray(field))
    }
    if (next !== field) changed = true
    out[key] = next
  }
  return changed ? out : value
}
