/**
 * Boosters — temporary multipliers the player buys.
 *
 * The consumable cash sink with urgency: buy a booster, get a temporary
 * multiplier (2x wages, 2x XP, 2x income) for a limited time. The player
 * feels compelled to USE the booster's window actively — "I have 2x wages
 * for 30 minutes, I need to start a shift NOW."
 *
 * This drives:
 *   1. Cash sink (removes money from the economy)
 *   2. Session extension (the player stays to use the booster)
 *   3. Engagement (they take actions they might otherwise delay)
 *
 * Three boosters, each with a cost, duration, and multiplier:
 *   Wage Boost:  2x shift wages for 30 min,  $1,000
 *   XP Surge:    2x all XP for 30 min,       $800
 *   Income Rush: 2x business income for 30m, $2,000
 *
 * Only one of each type active at a time. Stackable across types (wage + XP
 * both active = both doubled). The multipliers are applied in the tick when
 * computing wages, XP gains, and business pending income.
 */

export type BoosterType = 'wage' | 'xp' | 'income'

export interface BoosterDef {
  id: BoosterType
  name: string
  emoji: string
  cost: number
  multiplier: number
  durationMs: number
  description: string
}

export const BOOSTERS: Record<BoosterType, BoosterDef> = {
  wage: {
    id: 'wage',
    name: 'Wage Boost',
    emoji: '💪',
    cost: 1_000,
    multiplier: 2,
    durationMs: 30 * 60_000,
    description: '2x shift wages for 30 minutes.',
  },
  xp: {
    id: 'xp',
    name: 'XP Surge',
    emoji: '⚡',
    cost: 800,
    multiplier: 2,
    durationMs: 30 * 60_000,
    description: '2x all XP for 30 minutes.',
  },
  income: {
    id: 'income',
    name: 'Income Rush',
    emoji: '🚀',
    cost: 2_000,
    multiplier: 2,
    durationMs: 30 * 60_000,
    description: '2x business income for 30 minutes.',
  },
}

export const BOOSTER_LIST: BoosterType[] = ['wage', 'xp', 'income']

/**
 * Check if a booster is active at the given time. The store tracks
 * `activeBoosters: { type: BoosterType; expiresAt: number }[]`.
 */
export function isBoosterActive(
  active: { type: BoosterType; expiresAt: number }[],
  type: BoosterType,
  now: number = Date.now(),
): boolean {
  return active.some((b) => b.type === type && b.expiresAt > now)
}

/** Get the multiplier for a booster type (1 if not active). */
export function boosterMultiplier(
  active: { type: BoosterType; expiresAt: number }[],
  type: BoosterType,
  now: number = Date.now(),
): number {
  return isBoosterActive(active, type, now) ? BOOSTERS[type].multiplier : 1
}

/** Remove expired boosters. Returns the cleaned array. */
export function cleanExpiredBoosters(
  active: { type: BoosterType; expiresAt: number }[],
  now: number = Date.now(),
): { type: BoosterType; expiresAt: number }[] {
  return active.filter((b) => b.expiresAt > now)
}

/** Remaining time (ms) for a booster type, 0 if not active. */
export function boosterRemaining(
  active: { type: BoosterType; expiresAt: number }[],
  type: BoosterType,
  now: number = Date.now(),
): number {
  const b = active.find((a) => a.type === type)
  return b ? Math.max(0, b.expiresAt - now) : 0
}
