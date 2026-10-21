/**
 * Rule #1 — real time — used to be enforced by nothing but the device clock:
 * `tick()` trusted `Date.now()` alone and, when the clock went backwards,
 * silently re-anchored `lastSeenAt`, so jump-forward → collect → rewind
 * farmed shifts, till, streaks and daily bonuses without bound.
 *
 * Every same-origin API response carries a `Date` header (second precision).
 * The offset between it and the device clock is remembered and applied to
 * the simulation's "now", so a device clock set forward or back no longer
 * moves the economy while the citizen is online. Offline, the device clock
 * is the only clock there is — but a backwards move beyond NTP-sized
 * discipline is no longer re-anchored; accrual freezes until real time
 * catches up, so the evidence of a forward jump is never erased.
 */

/** An offset bigger than this is a garbage header, not a skewed clock. */
const MAX_REASONABLE_OFFSET_MS = 10 * 365 * 24 * 3_600_000

/** The header has second precision and rides a network round trip: anything inside this is noise. */
export const CLOCK_NOISE_MS = 2_000

/** Backwards moves up to this much are clock discipline (NTP) and are re-anchored silently. */
export const CLOCK_REWIND_TOLERANCE_MS = 5 * 60_000

/** server − device, in ms, from a response's `Date` header; null when there is nothing usable. */
export function offsetFromDateHeader(header: string | null | undefined, deviceNowMs: number): number | null {
  if (!header) return null
  const serverMs = Date.parse(header)
  if (!Number.isFinite(serverMs)) return null
  const offset = serverMs - deviceNowMs
  return Math.abs(offset) > MAX_REASONABLE_OFFSET_MS ? null : offset
}

/** The simulation's "now": the device clock corrected by the last known server offset. */
export function correctedNow(deviceNowMs: number, offsetMs: number | null): number {
  if (offsetMs === null || Math.abs(offsetMs) <= CLOCK_NOISE_MS) return deviceNowMs
  return deviceNowMs + offsetMs
}

export type RewindPolicy = 'advance' | 'reanchor' | 'freeze'

/**
 * What the tick does when `now` is not ahead of the last simulated instant.
 * `advance`: simulate the span. `reanchor`: a small backwards move — accept
 * the new clock and simulate nothing. `freeze`: a large backwards move —
 * simulate nothing and keep `lastSeenAt` where it is.
 */
export function rewindPolicy(nowMs: number, lastSeenAtMs: number): RewindPolicy {
  if (nowMs > lastSeenAtMs) return 'advance'
  return lastSeenAtMs - nowMs <= CLOCK_REWIND_TOLERANCE_MS ? 'reanchor' : 'freeze'
}
