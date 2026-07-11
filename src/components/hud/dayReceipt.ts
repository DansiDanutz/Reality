/**
 * The day-close receipt (today-plan item 5): when a life-day rolls over
 * while the player is around, one quiet line settles it — "Day 3 closed,
 * net +$188". Pure ledger logic so the boundary cases are testable:
 * multi-day gaps belong to the away report, not a stack of stale receipts.
 */

export interface DayLedgerSnapshot {
  day: number
  startMoney: number
}

export interface DayReceiptDecision {
  /** A receipt to show, or null (fresh citizens, same day, long gaps). */
  receipt: { day: number; net: number } | null
  /** The snapshot to persist for the (possibly new) current day. */
  next: DayLedgerSnapshot
}

export function settleDayLedger(
  stored: DayLedgerSnapshot | null,
  currentDay: number,
  money: number,
): DayReceiptDecision {
  // Nothing stored (first run) or nonsense (clock moved backwards): start
  // a fresh ledger for today, no receipt.
  if (!stored || stored.day > currentDay || !Number.isFinite(stored.startMoney)) {
    return { receipt: null, next: { day: currentDay, startMoney: money } }
  }
  if (stored.day === currentDay) return { receipt: null, next: stored }
  // The day advanced. A single-day step gets its receipt; a longer gap is an
  // absence — the away report owns that story.
  const receipt =
    currentDay - stored.day === 1 ? { day: stored.day, net: Math.round(money - stored.startMoney) } : null
  return { receipt, next: { day: currentDay, startMoney: money } }
}
