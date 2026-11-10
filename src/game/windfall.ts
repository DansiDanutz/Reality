/**
 * Windfall governor — luck may top up an honest day, never replace it.
 *
 * Lucky moments, golden opportunities and good life events are random cash
 * that needs no labor. Left ungoverned they were measured paying a
 * tab-open idle citizen ~$2k–$16k a day against $120 for an 8h barista
 * shift (src/store/economy.sim.test.ts). Every windfall now draws on one
 * small daily budget: a floor, plus a share of what the citizen actually
 * EARNED today (wages + business income). Doing nothing earns almost no
 * luck; working a lot earns room for more.
 *
 * Pure: no store, no clock.
 */

/** Cash of luck available on a day with no labor at all. */
export const WINDFALL_DAILY_FLOOR = 100
/** Extra luck budget per $1 earned from labor that day. */
export const WINDFALL_LABOR_SHARE = 0.5

/** Cash of luck still available today. Never negative. */
export function windfallRoom(windfallToday: number, earnedToday: number): number {
  const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
  const budget = WINDFALL_DAILY_FLOOR + clean(earnedToday) * WINDFALL_LABOR_SHARE
  return Math.max(0, Math.floor(budget - clean(windfallToday)))
}

/** Fraction of a windfall that fits the remaining room (1 = all of it, 0 = none). */
export function windfallFit(cash: number, room: number): number {
  if (cash <= 0) return 1
  return Math.min(1, Math.max(0, room) / cash)
}

/** Live-tick scale for per-tick odds: 1 at the 1 Hz foreground cadence, never above 5 (throttled tabs), 0 for sub-100ms bursts. */
export function tickChanceScale(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 100) return 0
  return Math.min(elapsedMs, 5_000) / 1_000
}
