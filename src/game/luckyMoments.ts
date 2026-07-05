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
 *   │ luckyMoment  │ 0.05%        │ $1k..$50k    │ jackpot, story   │
 *   └──────────────┴──────────────┴──────────────┴──────────────────┘
 *
 * At one tick per real second, 0.05% ≈ one lucky moment every ~33 minutes of
 * ACTIVE play (away spans never roll — see tick integration). A daily player
 * who opens the game for 20-40 minutes will see 1-2/day; that's the sweet
 * spot: rare enough to feel special, frequent enough to chase.
 *
 * The reward curve escalates with rarity inside the pool — a "found cash"
 * moment pays $1k-5k, while a "lottery" moment pays $25k-50k and the
 * legendary "distant relative" inheritance tops out at $50k. The expected
 * value per tick is ~$15 — comparable to a low-end shift, but lump-sum and
 * unpredictable, which is what makes it sticky.
 *
 * Architecture: pure functions, framework-free. `rng` is injectable for tests
 * (matching the rollEvent pattern in engine.ts). The store owns the only
 * side effect: applying money + firing the celebratory toast.
 */

/**
 * Per-tick chance of a lucky moment firing. Tuned so the expected wait is
 * ~33 minutes of active play (1 / (CHANCE_PER_TICK * 60 ticks/min)).
 */
export const LUCKY_MOMENT_CHANCE = 0.0005

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
 * Balance audit (against the $200k founder economy):
 *   - Tier 1 (lucky, $1k-5k): pays for a couple of groceries or a small bill.
 *   - Tier 2 (rare, $5k-25k): pays for a car or a business expansion.
 *   - Tier 3 (legendary, $25k-50k): game-changing — half a home deposit.
 *
 * Expected value per roll across the uniform mix of weights:
 *   Σ weight_i * (cashMin_i + cashMax_i) / 2  /  Σ weight_i  ≈  $11.5k
 * Multiplied by LUCKY_MOMENT_CHANCE (0.0005) → EV/tick ≈ $5.75.
 * Active hourly value ≈ $20.7k — meaningful but not economy-breaking.
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
  // ── Tier 1: lucky ($1k-5k) — the bread-and-butter jackpots ──────────────
  {
    id: 'found_cash',
    text: 'You found an envelope of cash on the bus seat. Nobody claimed it.',
    cashMin: 1_000,
    cashMax: 5_000,
    rarity: 'lucky',
    weight: 24,
  },
  {
    id: 'scratch_ticket',
    text: 'A scratch ticket someone tossed turned out to be a winner.',
    cashMin: 1_500,
    cashMax: 4_500,
    rarity: 'lucky',
    weight: 22,
  },
  {
    id: 'refund_windfall',
    text: 'A years-old overcharge got refunded — with interest.',
    cashMin: 1_200,
    cashMax: 4_800,
    rarity: 'lucky',
    weight: 20,
  },
  {
    id: 'sold_clutter',
    text: 'That old listing finally sold. Collectors pay surprisingly well.',
    cashMin: 1_000,
    cashMax: 3_500,
    rarity: 'lucky',
    weight: 22,
  },

  // ── Tier 2: rare ($6k-25k) — story-worthy, screenshot moments ───────────
  {
    id: 'viral_post',
    text: 'A video you forgot you posted went viral overnight. The ad share landed.',
    cashMin: 6_000,
    cashMax: 18_000,
    rarity: 'rare',
    weight: 8,
  },
  {
    id: 'freelance_jackpot',
    text: 'A client paid triple your rate just to skip the line. Worth every minute.',
    cashMin: 6_500,
    cashMax: 15_000,
    rarity: 'rare',
    weight: 8,
  },
  {
    id: 'class_action',
    text: 'A class-action settlement you forgot signing finally paid out.',
    cashMin: 7_500,
    cashMax: 22_000,
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'art_flip',
    text: 'A painting from a yard sale turned out to be listed. The gallery cut a check.',
    cashMin: 8_000,
    cashMax: 25_000,
    rarity: 'rare',
    weight: 5,
  },

  // ── Tier 3: legendary ($26k-50k) — once-in-a-lifetime ───────────────────
  {
    id: 'lottery',
    text: 'Your numbers came up. The lottery office confirmed it this morning.',
    cashMin: 26_000,
    cashMax: 50_000,
    rarity: 'legendary',
    weight: 2,
  },
  {
    id: 'inheritance',
    text: 'A distant relative you never met left you something in their will. It cleared today.',
    cashMin: 26_000,
    cashMax: 45_000,
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
