/**
 * Earned mystery boxes — transparent community/daily reward envelopes.
 *
 * This keeps the reveal moment while removing the cash-random loop that
 * conflicts with Reality's values. A box can only be opened with an earned
 * credit from real behavior such as a perfect day or community action.
 * Cash is never spent here, and the average reward is shown plainly.
 *
 * Pure: takes a box tier, rolls a reward with an injectable RNG.
 */

export type BoxTier = 'standard' | 'premium' | 'legendary'

export interface BoxReward {
  /** Display name for the reward, e.g. "Community grant". */
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
  creditsRequired: number
  emoji: string
  /** The reward pool: each entry has a weight and a reward-generator. */
  pool: { weight: number; roll: () => Omit<BoxReward, 'rarity'> & { rarity: BoxReward['rarity'] } }[]
}

export type MysteryBoxCredits = Record<BoxTier, number>

export function freshMysteryBoxCredits(partial: Partial<Record<BoxTier, number>> = {}): MysteryBoxCredits {
  return {
    standard: Math.max(0, Math.floor(partial.standard ?? 0)),
    premium: Math.max(0, Math.floor(partial.premium ?? 0)),
    legendary: Math.max(0, Math.floor(partial.legendary ?? 0)),
  }
}

export function creditTierForSeriousWorkStreak(streak: number): BoxTier | null {
  const wholeStreak = Math.max(0, Math.floor(streak))
  if (wholeStreak > 0 && wholeStreak % 20 === 0) return 'legendary'
  if (wholeStreak > 0 && wholeStreak % 5 === 0) return 'premium'
  return null
}

export const MYSTERY_BOXES: Record<BoxTier, BoxDef> = {
  standard: {
    id: 'standard',
    name: 'Standard Envelope',
    creditsRequired: 1,
    emoji: '📦',
    pool: [
      // Weights sum to exactly 100 so each weight reads as a percentage.
      { weight: 30, roll: () => ({ label: 'Small grant', cash: 100, xp: 5, rarity: 'dud', icon: '🪙' }) },
      { weight: 14, roll: () => ({ label: 'Modest grant', cash: 200, xp: 10, rarity: 'common', icon: '💵' }) },
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 350, xp: 20, rarity: 'common', icon: '💰' }) },
      { weight: 14, roll: () => ({ label: 'Good haul', cash: 550, xp: 30, rarity: 'common', icon: '💎' }) },
      { weight: 12, roll: () => ({ label: 'Rare grant!', cash: 900, xp: 60, rarity: 'rare', icon: '🎁' }) },
      { weight: 6, roll: () => ({ label: 'Community boost!', cash: 1_500, xp: 100, rarity: 'rare', icon: '⭐' }) },
      { weight: 2, roll: () => ({ label: 'Breakthrough grant!', cash: 2_500, xp: 250, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium Envelope',
    creditsRequired: 1,
    emoji: '🎁',
    pool: [
      { weight: 24, roll: () => ({ label: 'Small grant', cash: 600, xp: 15, rarity: 'dud', icon: '🪙' }) },
      { weight: 16, roll: () => ({ label: 'Modest grant', cash: 1_200, xp: 30, rarity: 'common', icon: '💵' }) },
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 1_800, xp: 50, rarity: 'common', icon: '💰' }) },
      { weight: 15, roll: () => ({ label: 'Good haul', cash: 2_500, xp: 80, rarity: 'common', icon: '💎' }) },
      { weight: 13, roll: () => ({ label: 'Rare grant!', cash: 3_800, xp: 150, rarity: 'rare', icon: '🎁' }) },
      { weight: 7, roll: () => ({ label: 'Community boost!', cash: 5_500, xp: 250, rarity: 'rare', icon: '⭐' }) },
      { weight: 3, roll: () => ({ label: 'Breakthrough grant!', cash: 12_500, xp: 600, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
  legendary: {
    id: 'legendary',
    name: 'Legendary Envelope',
    creditsRequired: 1,
    emoji: '🏛️',
    pool: [
      { weight: 24, roll: () => ({ label: 'Small grant', cash: 2_500, xp: 40, rarity: 'dud', icon: '🪙' }) },
      { weight: 16, roll: () => ({ label: 'Modest grant', cash: 5_000, xp: 80, rarity: 'common', icon: '💵' }) },
      { weight: 22, roll: () => ({ label: 'Nice return', cash: 7_500, xp: 150, rarity: 'common', icon: '💰' }) },
      { weight: 16, roll: () => ({ label: 'Good haul', cash: 10_000, xp: 250, rarity: 'common', icon: '💎' }) },
      { weight: 13, roll: () => ({ label: 'Rare grant!', cash: 15_000, xp: 500, rarity: 'rare', icon: '🎁' }) },
      { weight: 6, roll: () => ({ label: 'Community boost!', cash: 22_000, xp: 800, rarity: 'rare', icon: '⭐' }) },
      { weight: 3, roll: () => ({ label: 'Legendary grant!', cash: 50_000, xp: 2_000, rarity: 'jackpot', icon: '🏆' }) },
    ],
  },
}

/**
 * Open a mystery box. Returns the rolled reward. The caller (store) handles
 * the side effects: consuming an earned credit, granting cash + XP, firing the reveal.
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

/** The reward for the reveal animation's average-value display ("~$420 avg").
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
