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
 *   - Fires randomly during live play (~every 8-15 min of active ticks).
 *   - 15-second window. If tapped: reward. If missed: vanishes silently.
 *   - Rewards: cash + XP, slightly better than the chaos events, because
 *     the player had to DO something.
 *   - Variety: 5 opportunity types (coin rain, lost wallet, market tip,
 *     lucky find, street performance) so they don't feel repetitive.
 *
 * Pure: takes a snapshot + RNG, returns whether to spawn one. The store
 * owns the timer + reward side effects.
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
  { label: 'A $20 bill drifts by — grab it!', cash: 80, xp: 10, icon: '💵' },
  { label: 'Someone dropped coins on the sidewalk!', cash: 120, xp: 15, icon: '🪙' },
  { label: 'A street musician is killing it — tip them back!', cash: 50, xp: 25, icon: '🎵' },
  { label: 'Flash sale at the corner store — cash in!', cash: 200, xp: 20, icon: '🏷️' },
  { label: 'A tourist asks for directions, tips you!', cash: 90, xp: 30, icon: '🧭' },
  { label: 'Your favorite song comes on everywhere.', cash: 30, xp: 40, icon: '🎶' },
  { label: 'Found a gift card someone left behind!', cash: 150, xp: 15, icon: '🎁' },
]

/** Chance per tick to spawn an opportunity. ~0.012% → ~every 12 min at 1 tick/sec. */
export const OPPORTUNITY_CHANCE = 0.00012

/** How long the opportunity stays available (ms). */
export const OPPORTUNITY_WINDOW_MS = 15_000

/**
 * Roll for a golden opportunity. Returns null most of the time; occasionally
 * returns a fully-formed opportunity. The store sets a timer to auto-expire
 * if not tapped.
 */
export function rollOpportunity(rng: () => number = Math.random): GoldenOpportunity | null {
  if (rng() > OPPORTUNITY_CHANCE) return null
  const def = OPPORTUNITY_POOL[Math.floor(rng() * OPPORTUNITY_POOL.length)]
  return { ...def, id: `opp-${Date.now()}` }
}
