/**
 * Golden Opportunities — time-limited tap events that reward quick clicking.
 *
 * The FOMO mechanic: occasionally a golden prompt appears ("💰 Quick! Tap for
 * a bonus!") and the player has ~15 seconds to click it before it vanishes.
 * This creates urgency, rewards attention, and generates the "I almost missed
 * it!" excitement that keeps players from tabbing away.
 *
 * Distinct from lucky moments (which fire automatically) and mystery boxes
 * (which the player initiates). Golden opportunities are REACTIVE — they
 * appear without warning and demand a response. The player who's paying
 * attention gets rewarded; the one who tabbed away misses out.
 *
 * Design:
 *   - Fires randomly during live play (~every 28 min of active ticks).
 *   - 15-second window. If tapped: reward. If missed: vanishes silently.
 *   - Rewards: small cash + XP that MATCH the story (Rule #1: a $20 bill
 *     pays $20 — the 2026-07-05 audit found labels paying 4-8x their own
 *     text, e.g. "dropped coins" paying $120). The thrill is the catch,
 *     not the amount.
 *   - Variety: 7 opportunity types so they don't feel repetitive.
 *
 * Pure: takes caller-owned time + RNG, returns whether to spawn one. The
 * store/server owns the timer + reward side effects.
 */

export interface GoldenOpportunity {
  id: string
  /** Display text for the prompt. */
  label: string
  /** Cash reward on tap. */
  cash: number
  /** XP reward on tap. */
  xp: number
  /** Emoji shown on the prompt button. */
  icon: string
}

const OPPORTUNITY_POOL: Omit<GoldenOpportunity, 'id'>[] = [
  { label: 'A $20 bill drifts by — grab it!', cash: 20, xp: 10, icon: '💵' },
  { label: 'Someone dropped coins on the sidewalk!', cash: 8, xp: 10, icon: '🪙' },
  { label: 'You help a street musician pack up — they tip you!', cash: 15, xp: 25, icon: '🎵' },
  { label: 'Flash sale at the corner store — you save on essentials!', cash: 30, xp: 20, icon: '🏷️' },
  { label: 'A tourist asks for directions, tips you!', cash: 15, xp: 30, icon: '🧭' },
  { label: 'An old friend repays a forgotten loan.', cash: 40, xp: 20, icon: '🤝' },
  { label: 'Found a gift card someone left behind!', cash: 50, xp: 15, icon: '🎁' },
]

/** Chance per tick to spawn an opportunity. 0.06% → ~every 28 min at 1 tick/sec. */
export const OPPORTUNITY_CHANCE = 0.0006

/** How long the opportunity stays available (ms). */
export const OPPORTUNITY_WINDOW_MS = 15_000

/**
 * Roll for a golden opportunity. Returns null most of the time; occasionally
 * returns a fully-formed opportunity. The store sets a timer to auto-expire
 * if not tapped.
 */
export function rollOpportunity(now: number, rng: () => number = Math.random): GoldenOpportunity | null {
  if (!Number.isFinite(now) || now < 0) return null
  if (rng() > OPPORTUNITY_CHANCE) return null
  const def = OPPORTUNITY_POOL[Math.floor(rng() * OPPORTUNITY_POOL.length)]
  return { ...def, id: `opp-${Math.floor(now)}` }
}
