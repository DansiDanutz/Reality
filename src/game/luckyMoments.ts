/**
 * Rare lucky moments — the variable-ratio dopamine engine.
 *
 * This is the slot-machine hook: rare, unpredictable, BIG rewards that fire
 * without warning during live play. It is deliberately distinct from the
 * existing chaos layer (catalog.ts LIFE_EVENTS, ~0.4%/tick, $20-200):
 *
 *   ┌──────────────┬──────────────┬──────────────┬──────────────────┐
 *   │ Layer        │ Chance/tick  │ Reward range │ Purpose          │
 *   ├──────────────┼──────────────┼──────────────┼──────────────────┤
 *   │ rollEvent    │ 0.4%         │ $-140..+200  │ texture, life    │
 *   │ luckyMoment  │ 0.02%        │ $100..$5k    │ jackpot, story   │
 *   └──────────────┴──────────────┴──────────────┴──────────────────┘
 *
 * At one tick per real second, 0.02% ≈ one lucky moment every ~83 minutes of
 * ACTIVE play (away spans never roll — see tick integration). Rare enough to
 * feel special, frequent enough that a regular player still chases it.
 *
 * Rebalanced in the 2026-07-05 audit (Rule #1: rewards must make real-life
 * sense against $15-26/h wages). The original table paid $1k-50k at 0.05%/tick
 * ≈ $11,300/hour of PASSIVE income for keeping the tab open — the optimal
 * strategy was AFK, not working. Now a "found cash" envelope pays $100-500,
 * the legendary lottery/inheritance tops out at $5k, and windfalls no longer
 * count toward "earned today" challenges.
 *
 * Architecture: pure functions, framework-free. `rng` is injectable for tests
 * (matching the rollEvent pattern in engine.ts). The store owns the only
 * side effect: applying money + firing the celebratory toast.
 */

/**
 * Per-tick chance of a lucky moment firing. Tuned so the expected wait is
 * ~83 minutes of active play (1 / (0.0002 × 3600 ticks/hour) ≈ 1.4 hours).
 */
export const LUCKY_MOMENT_CHANCE = 0.0002

export interface LuckyMoment {
  /** Stable id — used for analytics deduping and future "seen" tracking. */
  id: string
  /** The story text shown in the toast + log. Present tense, second person. */
  text: string
  /** Cash reward. Always positive (these are the good moments). */
  money: number
  /** XP reward — proportional to cash, rounded. */
  xp: number
  /** Rarity tier — drives the toast styling and the "legendary" feel. */
  rarity: 'lucky' | 'rare' | 'legendary'
}

/**
 * Internal pool: (id, text template, cashMin, cashMax, rarity). The store
 * rolls cash uniformly in [min, max], then xp = round(cash / 50).
 *
 * Balance audit (against $15-26/h wages and the $2,500 citizen grant):
 *   - Tier 1 (lucky, $100-500): a week's groceries — a real-life windfall.
 *   - Tier 2 (rare, $600-2.5k): a month of rent — story-worthy.
 *   - Tier 3 (legendary, $2.6k-5k): the citizen grant again — once ever.
 *
 * Expected value per roll across the weighted pool:
 *   Σ weight_i * (cashMin_i + cashMax_i) / 2  /  Σ weight_i  ≈  $630
 * Multiplied by LUCKY_MOMENT_CHANCE (0.0002) → EV/tick ≈ $0.13.
 * Active hourly value ≈ $450 — a bonus on top of play, never a
 * replacement for working (and excluded from "earned today" challenges).
 */
interface MomentDef {
  id: string
  text: string
  cashMin: number
  cashMax: number
  rarity: LuckyMoment['rarity']
  /** Sampling weight inside the pool. Higher = more common. */
  weight: number
}

const MOMENT_POOL: readonly MomentDef[] = [
  // ── Tier 1: lucky ($100-500) — the bread-and-butter windfalls ──────────────
  {
    id: 'found_cash',
    text: 'You found an envelope of cash on the bus seat. Nobody claimed it.',
    cashMin: 100,
    cashMax: 500,
    rarity: 'lucky',
    weight: 24,
  },
  {
    id: 'scratch_ticket',
    text: 'A scratch ticket someone tossed turned out to be a winner.',
    cashMin: 150,
    cashMax: 450,
    rarity: 'lucky',
    weight: 22,
  },
  {
    id: 'refund_windfall',
    text: 'A years-old overcharge got refunded — with interest.',
    cashMin: 120,
    cashMax: 480,
    rarity: 'lucky',
    weight: 20,
  },
  {
    id: 'sold_clutter',
    text: 'That old listing finally sold. Collectors pay surprisingly well.',
    cashMin: 100,
    cashMax: 350,
    rarity: 'lucky',
    weight: 22,
  },

  // ── Tier 2: rare ($600-2.5k) — story-worthy, screenshot moments ───────────
  {
    id: 'viral_post',
    text: 'A video you forgot you posted went viral overnight. The ad share landed.',
    cashMin: 600,
    cashMax: 1800,
    rarity: 'rare',
    weight: 8,
  },
  {
    id: 'freelance_jackpot',
    text: 'A client paid triple your rate just to skip the line. Worth every minute.',
    cashMin: 650,
    cashMax: 1500,
    rarity: 'rare',
    weight: 8,
  },
  {
    id: 'class_action',
    text: 'A class-action settlement you forgot signing finally paid out.',
    cashMin: 750,
    cashMax: 2200,
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'art_flip',
    text: 'A painting from a yard sale turned out to be listed. The gallery cut a check.',
    cashMin: 800,
    cashMax: 2500,
    rarity: 'rare',
    weight: 5,
  },

  // ── Tier 3: legendary ($2.6k-5k) — once-in-a-lifetime ───────────────────
  {
    id: 'lottery',
    text: 'Your numbers came up. The lottery office confirmed it this morning.',
    cashMin: 2600,
    cashMax: 5000,
    rarity: 'legendary',
    weight: 2,
  },
  {
    id: 'inheritance',
    text: 'A distant relative you never met left you something in their will. It cleared today.',
    cashMin: 2600,
    cashMax: 4500,
    rarity: 'legendary',
    weight: 2,
  },
] as const

/** Total weight across the pool — precomputed for the sampler. */
const TOTAL_WEIGHT = MOMENT_POOL.reduce((s, d) => s + d.weight, 0)

/**
 * Pick a moment from the pool using weighted sampling, then roll its cash.
 * Exported separately from {@link rollLuckyMoment} so tests can exercise the
 * distribution directly without fighting the chance-gate statistics.
 *
 * @param rng  Injectable RNG (default Math.random).
 */
export function pickLuckyMoment(rng: () => number = Math.random): LuckyMoment {
  // Weighted pick across the pool.
  let roll = rng() * TOTAL_WEIGHT
  let def = MOMENT_POOL[0]
  for (const d of MOMENT_POOL) {
    roll -= d.weight
    if (roll <= 0) {
      def = d
      break
    }
  }
  // Uniform cash in [min, max], rounded to the nearest $50 for tidiness.
  const cash = Math.round((def.cashMin + rng() * (def.cashMax - def.cashMin)) / 50) * 50
  const xp = Math.round(cash / 50)
  return { id: def.id, text: def.text, money: cash, xp, rarity: def.rarity }
}

/**
 * Roll for a lucky moment. Returns `null` most of the time (the chance gate
 * fails); otherwise returns a fully-formed {@link LuckyMoment} with a rolled
 * cash amount.
 *
 * @param rng  Injectable RNG (default Math.random) — matches rollEvent's API.
 */
export function rollLuckyMoment(rng: () => number = Math.random): LuckyMoment | null {
  // Chance gate — the rare-event filter.
  if (rng() > LUCKY_MOMENT_CHANCE) return null
  return pickLuckyMoment(rng)
}

/**
 * Total number of distinct moments in the pool — exposed for tests and any
 * future "have you seen them all?" collector achievement.
 */
export const LUCKY_MOMENT_COUNT = MOMENT_POOL.length

/**
 * The full pool, read-only — exposed for the future collection-completion
 * view (Loop E) and for tests asserting the balance invariants.
 */
export const LUCKY_MOMENT_DEFS: readonly MomentDef[] = MOMENT_POOL

/** Rarity → emoji for the toast prefix and the collection view. */
export const RARITY_META: Record<LuckyMoment['rarity'], { icon: string; label: string }> = {
  lucky: { icon: '🍀', label: 'Lucky' },
  rare: { icon: '✨', label: 'Rare' },
  legendary: { icon: '🌟', label: 'Legendary' },
}
