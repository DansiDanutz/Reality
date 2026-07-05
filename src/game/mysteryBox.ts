/**
 * Mystery boxes — the gacha "just one more" loop.
 *
 * The single most addictive mechanic in gaming (loot boxes, gacha, card packs):
 * pay for a sealed box, get a random reward you can't see until you open it.
 * Variable-ratio reinforcement at its purest — the player never knows if the
 * next box is the big one, so they keep opening "just one more."
 *
 * Design:
 *   - Three box tiers: Standard ($500), Premium ($2,500), Legendary ($10,000).
 *   - Each tier has a reward pool with weighted drops: cash, XP, a rare
 *     "jackpot" multiplier, and occasional duds (the variance that makes
 *     the wins feel earned).
 *   - EV is slightly below cost (the house edge) so it's a money sink, but
 *     the variance creates big wins that keep players chasing.
 *   - The opening animation (in the UI) builds anticipation before revealing
 *     the reward — the dopamine is in the reveal, not the reward.
 *
 * Balance (computed from the pools below — keep in sync when tuning):
 *   Standard: cost $500,  EV $460   (92.0%) — small daily flutter
 *   Premium:  cost $2.5k, EV $2,361 (94.4%) — real risk/reward
 *   Legendary:cost $10k,  EV $9,420 (94.2%) — high roller, occasional 5x
 *
 * The ~6-8% house edge sinks cash from the economy while the rare jackpots
 * (up to 5x cost) create stories worth sharing. A player who hits a 5x on
 * their first Standard box is hooked. (Audit 2026-07-05: the header used to
 * claim a 15-16% edge that never matched the pools — these are the real
 * numbers, and every pool's weights must sum to exactly 100.)
 *
 * Pure: takes a box tier, rolls a reward with an injectable RNG.
 */

export type BoxTier = 'standard' | 'premium' | 'legendary'

export interface BoxReward {
  /** Display name for the reward, e.g. "Cash Drop", "Jackpot!" */
  label: string
  /** Cash reward. */
  cash: number
  /** XP reward. */
  xp: number
  /** Rarity for the reveal animation. */
  rarity: 'dud' | 'common' | 'rare' | 'jackpot'
  /** Emoji shown on reveal. */
  icon: string
}

export interface BoxDef {
  id: BoxTier
  name: string
  cost: number
  emoji: string
  /** The reward pool: each entry has a weight and a reward-generator. */
  pool: { weight: number; roll: () => Omit<BoxReward, 'rarity'> & { rarity: BoxReward['rarity'] } }[]
}

export const MYSTERY_BOXES: Record<BoxTier, BoxDef> = {
  standard: {
    id: 'standard',
    name: 'Standard Box',
    cost: 500,
    emoji: '📦',
    pool: [
      // Below-cost outcomes (44%) — the variance that makes wins feel earned.
      // Weights sum to exactly 100 so each weight reads as a percentage.
      { weight: 30, roll: () => ({ label: 'Small drop', cash: 100, xp: 5, rarity: 'dud', icon: '🪙' }) },
      { weight: 14, roll: () => ({ label: 'Modest find', cash: 200, xp: 10, rarity: 'common', icon: '💵' }) },
      // Common wins (36%)
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 350, xp: 20, rarity: 'common', icon: '💰' }) },
      { weight: 14, roll: () => ({ label: 'Good haul', cash: 550, xp: 30, rarity: 'common', icon: '💎' }) },
      // Rare (18%)
      { weight: 12, roll: () => ({ label: 'Rare find!', cash: 900, xp: 60, rarity: 'rare', icon: '🎁' }) },
      { weight: 6, roll: () => ({ label: 'Big win!', cash: 1_500, xp: 100, rarity: 'rare', icon: '⭐' }) },
      // Jackpot (2%)
      { weight: 2, roll: () => ({ label: 'JACKPOT! 5x!', cash: 2_500, xp: 250, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium Box',
    cost: 2_500,
    emoji: '🎁',
    pool: [
      { weight: 24, roll: () => ({ label: 'Small drop', cash: 600, xp: 15, rarity: 'dud', icon: '🪙' }) },
      { weight: 16, roll: () => ({ label: 'Modest find', cash: 1_200, xp: 30, rarity: 'common', icon: '💵' }) },
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 1_800, xp: 50, rarity: 'common', icon: '💰' }) },
      { weight: 15, roll: () => ({ label: 'Good haul', cash: 2_500, xp: 80, rarity: 'common', icon: '💎' }) },
      { weight: 13, roll: () => ({ label: 'Rare find!', cash: 3_800, xp: 150, rarity: 'rare', icon: '🎁' }) },
      { weight: 7, roll: () => ({ label: 'Big win!', cash: 5_500, xp: 250, rarity: 'rare', icon: '⭐' }) },
      { weight: 3, roll: () => ({ label: 'JACKPOT! 5x!', cash: 12_500, xp: 600, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
  legendary: {
    id: 'legendary',
    name: 'Legendary Box',
    cost: 10_000,
    emoji: '🎰',
    pool: [
      { weight: 24, roll: () => ({ label: 'Small drop', cash: 2_500, xp: 40, rarity: 'dud', icon: '🪙' }) },
      { weight: 16, roll: () => ({ label: 'Modest find', cash: 5_000, xp: 80, rarity: 'common', icon: '💵' }) },
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 7_500, xp: 150, rarity: 'common', icon: '💰' }) },
      { weight: 16, roll: () => ({ label: 'Good haul', cash: 10_000, xp: 250, rarity: 'common', icon: '💎' }) },
      { weight: 13, roll: () => ({ label: 'Rare find!', cash: 15_000, xp: 500, rarity: 'rare', icon: '🎁' }) },
      { weight: 6, roll: () => ({ label: 'Big win!', cash: 22_000, xp: 800, rarity: 'rare', icon: '⭐' }) },
      { weight: 3, roll: () => ({ label: 'LEGENDARY JACKPOT!', cash: 50_000, xp: 2_000, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
}

/**
 * Open a mystery box. Returns the rolled reward. The caller (store) handles
 * the side effects: deducting cost, granting cash + XP, firing the reveal.
 *
 * @param tier   Which box to open.
 * @param rng    Injectable RNG for testing.
 */
export function openBox(tier: BoxTier, rng: () => number = Math.random): BoxReward {
  const def = MYSTERY_BOXES[tier]
  const totalWeight = def.pool.reduce((s, e) => s + e.weight, 0)
  let roll = rng() * totalWeight
  for (const entry of def.pool) {
    roll -= entry.weight
    if (roll <= 0) {
      const r = entry.roll()
      return { label: r.label, cash: r.cash, xp: r.xp, rarity: r.rarity, icon: r.icon }
    }
  }
  // Fallback (shouldn't reach): return a common.
  const fb = def.pool[2].roll()
  return { label: fb.label, cash: fb.cash, xp: fb.xp, rarity: fb.rarity, icon: fb.icon }
}

/** The reward for the reveal animation's expected-value display ("~$420 avg").
 *  Computes from the fixed cash values (each pool entry's roll is deterministic
 *  in cash — only the selection is random). */
export function boxEV(tier: BoxTier): number {
  const def = MYSTERY_BOXES[tier]
  const totalWeight = def.pool.reduce((s, e) => s + e.weight, 0)
  let ev = 0
  for (const entry of def.pool) {
    // Each entry's roll returns fixed cash — sample once to get it.
    const sample = entry.roll()
    ev += (entry.weight / totalWeight) * sample.cash
  }
  return Math.round(ev)
}

/** For tests: computes EV from the pool weights + a reference roll each. */
export function boxEVPrecise(tier: BoxTier, samples = 10000): number {
  const def = MYSTERY_BOXES[tier]
  const totalWeight = def.pool.reduce((s, e) => s + e.weight, 0)
  let ev = 0
  for (const entry of def.pool) {
    // Average multiple rolls to handle any per-roll variance.
    let sum = 0
    for (let i = 0; i < samples; i++) sum += entry.roll().cash
    ev += (entry.weight / totalWeight) * (sum / samples)
  }
  return Math.round(ev)
}

/** Total boxes opened (for lifetime stats + an achievement). */
export function MYSTERY_BOX_TIERS(): BoxTier[] {
  return ['standard', 'premium', 'legendary']
}
