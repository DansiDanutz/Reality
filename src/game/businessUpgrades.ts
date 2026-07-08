/**
 * Business upgrades — the incremental-depth hook.
 *
 * Reality's legacy local businesses earn collectable revenue, but once bought
 * they're static: there's nothing to spend on, no compounding curve. Upgrades
 * fix that by letting players pay cash to improve a business's earning
 * capacity. The server economy still requires customer demand and ledger
 * events before revenue exists.
 *
 * Cost curve (geometric — the hallmark of idle games):
 *   cost(level → level+1) = round(baseIncome × COST_MULT^level)
 * where COST_MULT = 4. So each tier costs 4× the previous. This makes early
 * upgrades cheap (instant gratification) and late upgrades a long-term goal.
 *
 * Income curve (linear per level, multiplied by the upgrade count):
 *   incomePerDay(level) = baseIncome × level
 * So a level-5 cart earns 5× its base. The cost outpaces income (4^level vs
 * level), so the player can never go infinite — each tier takes longer to
 * afford, the classic idle deceleration that keeps the curve engaging.
 *
 * Payback analysis: at level L, the upgrade costs base×4^(L-1) and adds
 * base/day. Payback = 4^(L-1) days. L1→L2 = 1 day, L2→L3 = 4 days, L3→L4 =
 * 16 days... by L6 it's 1024 days (the soft cap). In practice players will
 * naturally settle around level 4-6 per business, which is exactly the
 * "always something to save for" sweet spot.
 *
 * Pure: takes base income + level, returns cost + new income. The store owns
 * the side effect (deducting cash, updating the asset).
 */

/** Cost multiplier per level — the geometric curve's slope. */
export const UPGRADE_COST_MULT = 4

/** Maximum upgrade level — a soft cap beyond which the cost is astronomical. */
export const MAX_BUSINESS_LEVEL = 10

/**
 * Cost to upgrade from `level` to `level+1`, given the business's base
 * (level-1) income. Returns null at the cap (no further upgrades possible).
 */
export function upgradeCost(baseIncome: number, level: number): number | null {
  if (level >= MAX_BUSINESS_LEVEL) return null
  if (level < 1) return null
  // cost(1→2) = base × 4^1 = 4×base. cost(2→3) = base × 4^2 = 16×base.
  return Math.round(baseIncome * Math.pow(UPGRADE_COST_MULT, level))
}

/**
 * Income per day at a given level, given the base (level-1) income.
 * Linear: level N earns N × base.
 */
export function incomeAtLevel(baseIncome: number, level: number): number {
  return baseIncome * Math.max(1, level)
}

/**
 * The full upgrade outcome: cost, new level, new income, and the delta for
 * the UI ("+$X/day"). Returns null if already at the cap.
 */
export interface UpgradeOutcome {
  cost: number
  newLevel: number
  newIncome: number
  incomeDelta: number
}

export function upgradeOutcome(baseIncome: number, currentLevel: number): UpgradeOutcome | null {
  const cost = upgradeCost(baseIncome, currentLevel)
  if (cost === null) return null
  const newLevel = currentLevel + 1
  const newIncome = incomeAtLevel(baseIncome, newLevel)
  return {
    cost,
    newLevel,
    newIncome,
    incomeDelta: newIncome - incomeAtLevel(baseIncome, currentLevel),
  }
}

/**
 * Total cash invested in a business at its current level (sum of all upgrade
 * costs paid so far). Useful for the net-worth calculation and for showing
 * "you've invested $X into this business" in the UI.
 */
export function totalInvested(baseIncome: number, level: number): number {
  let sum = 0
  for (let l = 1; l < level; l++) {
    const c = upgradeCost(baseIncome, l)
    if (c !== null) sum += c
  }
  return sum
}
